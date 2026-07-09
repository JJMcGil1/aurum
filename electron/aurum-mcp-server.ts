/**
 * Aurum MCP Server
 *
 * Stdio JSON-RPC server implementing the Model Context Protocol so the
 * Claude CLI (spawned with `--mcp-config`) can read the user's expense data
 * directly when answering finance questions in the Aurum chat.
 *
 * Spawned by `electron/claude-cli.ts` via `ELECTRON_RUN_AS_NODE=1` so we
 * don't depend on the user having `node` installed. Reads the SQLite path
 * from the AURUM_DB_PATH env var. SQLite is opened readonly with WAL — the
 * main app's writer is never blocked.
 */

import BetterSqlite3 from 'better-sqlite3'

interface JsonRpcRequest {
  jsonrpc: '2.0'
  id?: string | number | null
  method: string
  params?: any
}

interface ToolDef {
  name: string
  description: string
  inputSchema: Record<string, any>
  handler: (args: any) => any
}

const dbPath = process.env.AURUM_DB_PATH
if (!dbPath) {
  process.stderr.write('AURUM_DB_PATH not set\n')
  process.exit(1)
}

const db = new BetterSqlite3(dbPath, { readonly: true, fileMustExist: true })
db.pragma('journal_mode = WAL')

// ---- Helpers --------------------------------------------------------------

function clampLimit(n: any, def = 25, max = 200): number {
  const v = typeof n === 'number' ? n : parseInt(n, 10)
  if (!Number.isFinite(v) || v <= 0) return def
  return Math.min(max, v)
}

function monthRange(year: number, month: number): { start: string; end: string } {
  const start = `${year}-${String(month).padStart(2, '0')}-01 00:00:00`
  const next = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 }
  const end = `${next.y}-${String(next.m).padStart(2, '0')}-01 00:00:00`
  return { start, end }
}

function parseMonthArg(s: string | undefined): { start: string; end: string; label: string } {
  const now = new Date()
  if (!s || s === 'current') {
    const { start, end } = monthRange(now.getFullYear(), now.getMonth() + 1)
    return { start, end, label: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}` }
  }
  if (s === 'last' || s === 'previous') {
    const d = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const { start, end } = monthRange(d.getFullYear(), d.getMonth() + 1)
    return { start, end, label: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }
  }
  const m = /^(\d{4})-(\d{1,2})$/.exec(s)
  if (m) {
    const y = parseInt(m[1], 10)
    const mo = parseInt(m[2], 10)
    if (mo >= 1 && mo <= 12) {
      const { start, end } = monthRange(y, mo)
      return { start, end, label: `${y}-${String(mo).padStart(2, '0')}` }
    }
  }
  throw new Error(`Invalid month "${s}". Use "current", "last", or "YYYY-MM".`)
}

function loadExpenseMembers(expenseId: number) {
  return db
    .prepare(
      `SELECT em.role, em.amount,
              TRIM(fm.first_name || ' ' || fm.last_name) AS member_name,
              fm.id AS member_id
         FROM expense_members em
         JOIN family_members fm ON em.member_id = fm.id
        WHERE em.expense_id = ?`,
    )
    .all(expenseId) as { role: string; amount: number | null; member_name: string; member_id: number }[]
}

function shapeExpense(row: any) {
  const members = loadExpenseMembers(row.id)
  return {
    id: row.id,
    name: row.name,
    amount: row.amount,
    notes: row.notes,
    expense_date: row.expense_date ?? null,
    due_date: row.due_date ?? null,
    recurrence: row.recurrence ?? 'once',
    end_date: row.end_date ?? null,
    created_at: row.created_at,
    payers: members
      .filter(m => m.role === 'payer')
      .map(m => ({ member_id: m.member_id, name: m.member_name, amount: m.amount })),
    beneficiaries: members
      .filter(m => m.role === 'beneficiary')
      .map(m => ({ member_id: m.member_id, name: m.member_name })),
  }
}

// ---- Tool implementations -------------------------------------------------

const tools: ToolDef[] = [
  {
    name: 'list_family_members',
    description:
      "List the family members in this Aurum profile (the people whose finances are being tracked). Use this when the user asks 'who am I', 'who is in my family', or you need member ids/names to call other tools.",
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => {
      const rows = db
        .prepare(
          `SELECT id, TRIM(first_name || ' ' || last_name) AS name, role, email,
                  avatar_color, avatar_image
             FROM family_members
            ORDER BY created_at`,
        )
        .all()
      return { members: rows, count: rows.length }
    },
  },

  {
    name: 'list_expenses',
    description:
      "List recorded expenses, newest first. Filter by family member (payer or beneficiary), name substring, or month. Returns each expense with its name, amount, payers (who paid and how much) and beneficiaries (who it was for).",
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max rows. Default 25, max 200.' },
        name_contains: { type: 'string', description: 'Case-insensitive substring match on the expense name.' },
        member_name: {
          type: 'string',
          description: "Filter to expenses involving this family member by name (matches either payer or beneficiary).",
        },
        member_role: {
          type: 'string',
          enum: ['payer', 'beneficiary', 'any'],
          description: "When member_name is set, restrict to this role. Default 'any'.",
        },
        month: {
          type: 'string',
          description: "Restrict to a month: 'current', 'last', or 'YYYY-MM'.",
        },
      },
      additionalProperties: false,
    },
    handler: args => {
      const limit = clampLimit(args?.limit, 25, 200)
      const where: string[] = []
      const params: any[] = []

      if (args?.name_contains) {
        where.push('LOWER(e.name) LIKE ?')
        params.push(`%${String(args.name_contains).toLowerCase()}%`)
      }
      if (args?.month) {
        const { start, end } = parseMonthArg(args.month)
        where.push('e.created_at >= ? AND e.created_at < ?')
        params.push(start, end)
      }
      if (args?.member_name) {
        const role = args?.member_role && args.member_role !== 'any' ? args.member_role : null
        const roleClause = role ? 'AND em.role = ?' : ''
        where.push(
          `EXISTS (SELECT 1 FROM expense_members em
                     JOIN family_members fm ON em.member_id = fm.id
                    WHERE em.expense_id = e.id
                      AND LOWER(TRIM(fm.first_name || ' ' || fm.last_name)) LIKE ?
                      ${roleClause})`,
        )
        params.push(`%${String(args.member_name).toLowerCase()}%`)
        if (role) params.push(role)
      }

      const sql = `SELECT * FROM expenses e ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
                   ORDER BY e.created_at DESC LIMIT ?`
      const rows = db.prepare(sql).all(...params, limit) as any[]
      return { expenses: rows.map(shapeExpense), count: rows.length, limit }
    },
  },

  {
    name: 'get_expense',
    description: "Fetch a single expense by id with full payer/beneficiary breakdown.",
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'number', description: 'Expense id.' } },
      required: ['id'],
      additionalProperties: false,
    },
    handler: args => {
      const row = db.prepare('SELECT * FROM expenses WHERE id = ?').get(args.id)
      if (!row) return { error: `No expense with id ${args.id}` }
      return { expense: shapeExpense(row) }
    },
  },

  {
    name: 'expense_summary',
    description:
      "High-level totals across all expenses: lifetime total, current-month total, last-month total, expense count, and average size. Use this for 'how much have we spent overall' or month-over-month framing.",
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => {
      const totals = db
        .prepare('SELECT COALESCE(SUM(amount),0) AS total, COUNT(*) AS count FROM expenses')
        .get() as { total: number; count: number }
      const cur = parseMonthArg('current')
      const prev = parseMonthArg('last')
      const monthTotal = (range: { start: string; end: string }) =>
        (db
          .prepare('SELECT COALESCE(SUM(amount),0) AS t FROM expenses WHERE created_at >= ? AND created_at < ?')
          .get(range.start, range.end) as { t: number }).t
      return {
        lifetime_total: totals.total,
        expense_count: totals.count,
        average_expense: totals.count ? totals.total / totals.count : 0,
        current_month: { label: cur.label, total: monthTotal(cur) },
        previous_month: { label: prev.label, total: monthTotal(prev) },
      }
    },
  },

  {
    name: 'spending_by_member',
    description:
      "Breakdown of who paid how much (sum of payer contributions) over a window. Optionally filter by month. Use this for 'who spent the most' or 'how does X's spending compare to Y'.",
    inputSchema: {
      type: 'object',
      properties: {
        month: { type: 'string', description: "'current', 'last', 'YYYY-MM', or omit for all-time." },
      },
      additionalProperties: false,
    },
    handler: args => {
      let where = ''
      const params: any[] = []
      let label = 'all_time'
      if (args?.month) {
        const { start, end, label: l } = parseMonthArg(args.month)
        where = 'WHERE e.created_at >= ? AND e.created_at < ?'
        params.push(start, end)
        label = l
      }
      const rows = db
        .prepare(
          `SELECT fm.id AS member_id,
                  TRIM(fm.first_name || ' ' || fm.last_name) AS name,
                  fm.role AS family_role,
                  fm.avatar_color,
                  fm.avatar_image,
                  COALESCE(SUM(em.amount), 0) AS total,
                  COUNT(DISTINCT e.id) AS expense_count
             FROM expense_members em
             JOIN expenses e ON em.expense_id = e.id
             JOIN family_members fm ON em.member_id = fm.id
            ${where ? where + ' AND' : 'WHERE'} em.role = 'payer'
            GROUP BY fm.id
            ORDER BY total DESC`,
        )
        .all(...params)
      return { window: label, by_member: rows }
    },
  },

  {
    name: 'spending_for_member',
    description:
      "Total amount spent ON BEHALF OF a specific beneficiary (where they were tagged as a beneficiary, regardless of who paid). Useful for 'how much did we spend on the kids' or 'on Sarah this year'.",
    inputSchema: {
      type: 'object',
      properties: {
        member_name: { type: 'string', description: 'Family member name (case-insensitive substring match).' },
        month: { type: 'string', description: "'current', 'last', 'YYYY-MM', or omit for all-time." },
        limit: { type: 'number', description: 'Max individual expenses to return. Default 25.' },
      },
      required: ['member_name'],
      additionalProperties: false,
    },
    handler: args => {
      const limit = clampLimit(args?.limit, 25, 200)
      let timeWhere = ''
      const params: any[] = [`%${String(args.member_name).toLowerCase()}%`]
      let label = 'all_time'
      if (args?.month) {
        const { start, end, label: l } = parseMonthArg(args.month)
        timeWhere = 'AND e.created_at >= ? AND e.created_at < ?'
        params.push(start, end)
        label = l
      }
      const totalRow = db
        .prepare(
          `SELECT COALESCE(SUM(e.amount), 0) AS total, COUNT(DISTINCT e.id) AS expense_count
             FROM expenses e
             JOIN expense_members em ON em.expense_id = e.id
             JOIN family_members fm ON em.member_id = fm.id
            WHERE em.role = 'beneficiary'
              AND LOWER(TRIM(fm.first_name || ' ' || fm.last_name)) LIKE ?
              ${timeWhere}`,
        )
        .get(...params) as { total: number; expense_count: number }
      const rows = db
        .prepare(
          `SELECT DISTINCT e.*
             FROM expenses e
             JOIN expense_members em ON em.expense_id = e.id
             JOIN family_members fm ON em.member_id = fm.id
            WHERE em.role = 'beneficiary'
              AND LOWER(TRIM(fm.first_name || ' ' || fm.last_name)) LIKE ?
              ${timeWhere}
            ORDER BY e.created_at DESC
            LIMIT ?`,
        )
        .all(...params, limit) as any[]
      return {
        window: label,
        member_query: args.member_name,
        total: totalRow.total,
        expense_count: totalRow.expense_count,
        expenses: rows.map(shapeExpense),
      }
    },
  },

  {
    name: 'monthly_trend',
    description:
      "Total expenses per month for the last N months (default 6). Returns chronologically oldest → newest so trends are easy to read.",
    inputSchema: {
      type: 'object',
      properties: {
        months: { type: 'number', description: 'How many months back, including current. Default 6, max 36.' },
      },
      additionalProperties: false,
    },
    handler: args => {
      const months = clampLimit(args?.months, 6, 36)
      const now = new Date()
      const out: { month: string; total: number; count: number }[] = []
      for (let i = months - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const { start, end } = monthRange(d.getFullYear(), d.getMonth() + 1)
        const r = db
          .prepare(
            `SELECT COALESCE(SUM(amount),0) AS total, COUNT(*) AS count
               FROM expenses WHERE created_at >= ? AND created_at < ?`,
          )
          .get(start, end) as { total: number; count: number }
        out.push({
          month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
          total: r.total,
          count: r.count,
        })
      }
      return { trend: out }
    },
  },

  {
    name: 'top_expenses',
    description:
      "Largest individual expenses by amount, optionally scoped to a month. Use for 'what were our biggest expenses' or 'top 5 in October'.",
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Default 10, max 50.' },
        month: { type: 'string', description: "Optional 'current', 'last', or 'YYYY-MM'." },
      },
      additionalProperties: false,
    },
    handler: args => {
      const limit = clampLimit(args?.limit, 10, 50)
      let where = ''
      const params: any[] = []
      if (args?.month) {
        const { start, end } = parseMonthArg(args.month)
        where = 'WHERE created_at >= ? AND created_at < ?'
        params.push(start, end)
      }
      const rows = db
        .prepare(`SELECT * FROM expenses ${where} ORDER BY amount DESC LIMIT ?`)
        .all(...params, limit) as any[]
      return { expenses: rows.map(shapeExpense), count: rows.length, limit }
    },
  },
]

const toolMap = new Map(tools.map(t => [t.name, t]))

// ---- JSON-RPC plumbing ----------------------------------------------------

function send(payload: Record<string, unknown>) {
  process.stdout.write(JSON.stringify(payload) + '\n')
}

function reply(id: any, result: any) {
  send({ jsonrpc: '2.0', id, result })
}

function replyError(id: any, code: number, message: string) {
  send({ jsonrpc: '2.0', id, error: { code, message } })
}

function handleRequest(req: JsonRpcRequest) {
  const { id, method, params } = req
  switch (method) {
    case 'initialize':
      reply(id, {
        protocolVersion: params?.protocolVersion ?? '2025-06-18',
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'aurum', version: '1.0.0' },
      })
      return

    case 'notifications/initialized':
      // notification — no response
      return

    case 'tools/list':
      reply(id, {
        tools: tools.map(t => ({ name: t.name, description: t.description, inputSchema: t.inputSchema })),
      })
      return

    case 'tools/call': {
      const name = params?.name
      const tool = toolMap.get(name)
      if (!tool) {
        replyError(id, -32601, `Unknown tool: ${name}`)
        return
      }
      try {
        const result = tool.handler(params?.arguments ?? {})
        reply(id, {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        })
      } catch (err: any) {
        reply(id, {
          isError: true,
          content: [{ type: 'text', text: `Error: ${err?.message ?? String(err)}` }],
        })
      }
      return
    }

    case 'ping':
      reply(id, {})
      return

    default:
      if (id !== undefined && id !== null) {
        replyError(id, -32601, `Method not found: ${method}`)
      }
  }
}

// Line-buffered stdin
let buf = ''
process.stdin.setEncoding('utf8')
process.stdin.on('data', chunk => {
  buf += chunk
  let nl: number
  while ((nl = buf.indexOf('\n')) !== -1) {
    const line = buf.slice(0, nl).trim()
    buf = buf.slice(nl + 1)
    if (!line) continue
    try {
      const msg = JSON.parse(line)
      if (Array.isArray(msg)) {
        for (const m of msg) handleRequest(m)
      } else {
        handleRequest(msg)
      }
    } catch (err: any) {
      process.stderr.write(`parse error: ${err?.message ?? err}\n`)
    }
  }
})

process.stdin.on('end', () => {
  try { db.close() } catch { /* ignore */ }
  process.exit(0)
})

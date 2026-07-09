import BetterSqlite3 from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import { app } from 'electron'

export class Database {
  private db: BetterSqlite3.Database
  public profileImagesDir: string
  public dbPath: string

  constructor() {
    const dbPath = path.join(app.getPath('userData'), 'aurum.db')
    this.dbPath = dbPath
    this.profileImagesDir = path.join(app.getPath('userData'), 'profile-images')
    if (!fs.existsSync(this.profileImagesDir)) {
      fs.mkdirSync(this.profileImagesDir, { recursive: true })
    }
    this.db = new BetterSqlite3(dbPath)
    this.db.pragma('journal_mode = WAL')
    this.db.pragma('foreign_keys = ON')
    this.init()
  }

  private init() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS family_members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL DEFAULT '',
        email TEXT,
        role TEXT NOT NULL DEFAULT 'member',
        avatar_color TEXT NOT NULL DEFAULT '#6366f1',
        avatar_image TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('checking', 'savings', 'credit_card', 'investment', 'cash', 'loan')),
        balance REAL NOT NULL DEFAULT 0,
        currency TEXT NOT NULL DEFAULT 'USD',
        institution TEXT,
        owner_id INTEGER REFERENCES family_members(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
        icon TEXT,
        color TEXT NOT NULL DEFAULT '#6366f1'
      );

      CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        amount REAL NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('income', 'expense', 'transfer')),
        description TEXT NOT NULL,
        date TEXT NOT NULL,
        account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
        family_member_id INTEGER REFERENCES family_members(id) ON DELETE SET NULL,
        notes TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
      CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions(account_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id);

      CREATE TABLE IF NOT EXISTS expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        amount REAL NOT NULL,
        notes TEXT,
        expense_date TEXT,
        due_date TEXT,
        recurrence TEXT NOT NULL DEFAULT 'once' CHECK(recurrence IN ('once','weekly','biweekly','monthly','quarterly','yearly')),
        end_date TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS expense_members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        expense_id INTEGER NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
        member_id INTEGER NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
        role TEXT NOT NULL CHECK(role IN ('beneficiary', 'payer')),
        amount REAL
      );

      CREATE INDEX IF NOT EXISTS idx_expense_members_expense ON expense_members(expense_id);
      CREATE INDEX IF NOT EXISTS idx_expense_members_member ON expense_members(member_id);

      CREATE TABLE IF NOT EXISTS bills (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        amount REAL NOT NULL,
        due_date TEXT NOT NULL,
        recurrence TEXT NOT NULL DEFAULT 'monthly' CHECK(recurrence IN ('once','weekly','biweekly','monthly','quarterly','yearly')),
        category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
        account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
        notes TEXT,
        is_paid INTEGER NOT NULL DEFAULT 0,
        last_paid_date TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_bills_due_date ON bills(due_date);

      CREATE TABLE IF NOT EXISTS budgets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category_id INTEGER NOT NULL UNIQUE REFERENCES categories(id) ON DELETE CASCADE,
        amount REAL NOT NULL,
        period TEXT NOT NULL DEFAULT 'monthly' CHECK(period IN ('weekly','monthly','yearly')),
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS goals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        target_amount REAL NOT NULL,
        current_amount REAL NOT NULL DEFAULT 0,
        target_date TEXT,
        color TEXT NOT NULL DEFAULT '#d4a843',
        notes TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS net_worth_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL UNIQUE,
        assets REAL NOT NULL,
        liabilities REAL NOT NULL,
        net_worth REAL NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS chat_threads (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL DEFAULT 'New chat',
        claude_session_id TEXT,
        model TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_chat_threads_updated ON chat_threads(updated_at DESC);

      CREATE TABLE IF NOT EXISTS chat_messages (
        id TEXT PRIMARY KEY,
        thread_id TEXT NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
        role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
        status TEXT NOT NULL DEFAULT 'done',
        blocks_json TEXT NOT NULL,
        meta_json TEXT,
        error TEXT,
        created_at_ms INTEGER NOT NULL,
        ord INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_chat_messages_thread ON chat_messages(thread_id, ord);
    `)

    // Migrate old schema: if 'name' column exists but 'first_name' doesn't, migrate
    const cols = this.db.prepare("PRAGMA table_info(family_members)").all() as any[]
    const hasFirstName = cols.some((c: any) => c.name === 'first_name')
    const hasOldName = cols.some((c: any) => c.name === 'name')
    const hasEmail = cols.some((c: any) => c.name === 'email')
    if (!hasEmail) {
      this.db.exec(`ALTER TABLE family_members ADD COLUMN email TEXT`)
    }
    if (hasOldName && hasFirstName) {
      // Previous migration added first_name/last_name but didn't drop name — fix it
      this.db.exec('ALTER TABLE family_members DROP COLUMN name')
    } else if (hasOldName && !hasFirstName) {
      this.db.exec(`ALTER TABLE family_members ADD COLUMN first_name TEXT NOT NULL DEFAULT ''`)
      this.db.exec(`ALTER TABLE family_members ADD COLUMN last_name TEXT NOT NULL DEFAULT ''`)
      this.db.exec(`ALTER TABLE family_members ADD COLUMN avatar_image TEXT`)
      // Split old name into first/last
      const rows = this.db.prepare('SELECT id, name FROM family_members').all() as any[]
      const update = this.db.prepare('UPDATE family_members SET first_name = ?, last_name = ? WHERE id = ?')
      for (const row of rows) {
        const parts = row.name.trim().split(/\s+/)
        const first = parts[0] || ''
        const last = parts.slice(1).join(' ')
        update.run(first, last, row.id)
      }
      // Drop the old name column so INSERTs don't fail on NOT NULL
      this.db.exec('ALTER TABLE family_members DROP COLUMN name')
    }

    // Migrate expenses: if old schema has 'date' column, recreate without it
    const expCols = this.db.prepare("PRAGMA table_info(expenses)").all() as any[]
    const hasDate = expCols.some((c: any) => c.name === 'date')
    if (hasDate) {
      this.db.exec(`
        DROP TABLE IF EXISTS expense_members;
        DROP TABLE IF EXISTS expenses;
        CREATE TABLE expenses (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          amount REAL NOT NULL,
          notes TEXT,
          expense_date TEXT,
          due_date TEXT,
          recurrence TEXT NOT NULL DEFAULT 'once' CHECK(recurrence IN ('once','weekly','biweekly','monthly','quarterly','yearly')),
          end_date TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE TABLE expense_members (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          expense_id INTEGER NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
          member_id INTEGER NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
          role TEXT NOT NULL CHECK(role IN ('beneficiary', 'payer')),
          amount REAL
        );
        CREATE INDEX idx_expense_members_expense ON expense_members(expense_id);
        CREATE INDEX idx_expense_members_member ON expense_members(member_id);
      `)
    } else {
      // Add expense_date / due_date / recurrence / end_date columns if missing
      const hasExpenseDate = expCols.some((c: any) => c.name === 'expense_date')
      const hasDueDate = expCols.some((c: any) => c.name === 'due_date')
      const hasRecurrence = expCols.some((c: any) => c.name === 'recurrence')
      const hasEndDate = expCols.some((c: any) => c.name === 'end_date')
      if (!hasExpenseDate) {
        this.db.exec(`ALTER TABLE expenses ADD COLUMN expense_date TEXT`)
      }
      if (!hasDueDate) {
        this.db.exec(`ALTER TABLE expenses ADD COLUMN due_date TEXT`)
      }
      if (!hasRecurrence) {
        this.db.exec(`ALTER TABLE expenses ADD COLUMN recurrence TEXT NOT NULL DEFAULT 'once'`)
      }
      if (!hasEndDate) {
        this.db.exec(`ALTER TABLE expenses ADD COLUMN end_date TEXT`)
      }
    }

    // Seed default categories if empty
    const count = this.db.prepare('SELECT COUNT(*) as c FROM categories').get() as any
    if (count.c === 0) {
      const insert = this.db.prepare('INSERT INTO categories (name, type, color) VALUES (?, ?, ?)')
      const defaults = [
        ['Salary', 'income', '#22c55e'],
        ['Freelance', 'income', '#10b981'],
        ['Investments', 'income', '#06b6d4'],
        ['Gifts Received', 'income', '#8b5cf6'],
        ['Groceries', 'expense', '#ef4444'],
        ['Dining Out', 'expense', '#f97316'],
        ['Transportation', 'expense', '#eab308'],
        ['Utilities', 'expense', '#64748b'],
        ['Entertainment', 'expense', '#ec4899'],
        ['Shopping', 'expense', '#a855f7'],
        ['Healthcare', 'expense', '#14b8a6'],
        ['Education', 'expense', '#3b82f6'],
        ['Housing', 'expense', '#78716c'],
        ['Insurance', 'expense', '#6366f1'],
        ['Subscriptions', 'expense', '#f43f5e'],
      ]
      const insertMany = this.db.transaction((items: string[][]) => {
        for (const item of items) insert.run(...item)
      })
      insertMany(defaults)
    }
  }

  // Family Members
  getFamilyMembers() {
    return this.db.prepare(`
      SELECT *, (first_name || ' ' || last_name) AS name FROM family_members ORDER BY created_at
    `).all().map((m: any) => ({ ...m, name: m.name.trim() }))
  }

  addFamilyMember(member: { first_name: string; last_name: string; email?: string | null; role: string; avatar_color: string; avatar_image?: string }) {
    const stmt = this.db.prepare('INSERT INTO family_members (first_name, last_name, email, role, avatar_color, avatar_image) VALUES (?, ?, ?, ?, ?, ?)')
    const result = stmt.run(member.first_name, member.last_name || '', member.email || null, member.role, member.avatar_color, member.avatar_image || null)
    return this.db.prepare('SELECT *, (first_name || \' \' || last_name) AS name FROM family_members WHERE id = ?').get(result.lastInsertRowid)
  }

  updateFamilyMember(id: number, member: { first_name?: string; last_name?: string; email?: string | null; role?: string; avatar_color?: string; avatar_image?: string | null }) {
    const fields: string[] = []
    const values: any[] = []
    if (member.first_name !== undefined) { fields.push('first_name = ?'); values.push(member.first_name) }
    if (member.last_name !== undefined) { fields.push('last_name = ?'); values.push(member.last_name) }
    if (member.email !== undefined) { fields.push('email = ?'); values.push(member.email) }
    if (member.role !== undefined) { fields.push('role = ?'); values.push(member.role) }
    if (member.avatar_color !== undefined) { fields.push('avatar_color = ?'); values.push(member.avatar_color) }
    if (member.avatar_image !== undefined) { fields.push('avatar_image = ?'); values.push(member.avatar_image) }
    if (fields.length === 0) return this.db.prepare('SELECT *, (first_name || \' \' || last_name) AS name FROM family_members WHERE id = ?').get(id)
    values.push(id)
    this.db.prepare(`UPDATE family_members SET ${fields.join(', ')} WHERE id = ?`).run(...values)
    return this.db.prepare('SELECT *, (first_name || \' \' || last_name) AS name FROM family_members WHERE id = ?').get(id)
  }

  deleteFamilyMember(id: number) {
    // Clean up profile image if it exists
    const member = this.db.prepare('SELECT avatar_image FROM family_members WHERE id = ?').get(id) as any
    if (member?.avatar_image && fs.existsSync(member.avatar_image)) {
      fs.unlinkSync(member.avatar_image)
    }
    this.db.prepare('DELETE FROM family_members WHERE id = ?').run(id)
  }

  // Accounts
  getAccounts() {
    return this.db.prepare(`
      SELECT a.*, TRIM(fm.first_name || ' ' || fm.last_name) as owner_name
      FROM accounts a
      LEFT JOIN family_members fm ON a.owner_id = fm.id
      ORDER BY a.type, a.name
    `).all()
  }

  addAccount(account: { name: string; type: string; balance: number; currency: string; institution?: string; owner_id?: number }) {
    const stmt = this.db.prepare('INSERT INTO accounts (name, type, balance, currency, institution, owner_id) VALUES (?, ?, ?, ?, ?, ?)')
    const result = stmt.run(account.name, account.type, account.balance, account.currency, account.institution || null, account.owner_id || null)
    return { id: result.lastInsertRowid, ...account }
  }

  updateAccount(id: number, account: Partial<{ name: string; type: string; balance: number; currency: string; institution: string; owner_id: number }>) {
    const fields: string[] = []
    const values: any[] = []
    for (const [key, val] of Object.entries(account)) {
      if (val !== undefined) { fields.push(`${key} = ?`); values.push(val) }
    }
    values.push(id)
    this.db.prepare(`UPDATE accounts SET ${fields.join(', ')} WHERE id = ?`).run(...values)
    return this.db.prepare('SELECT * FROM accounts WHERE id = ?').get(id)
  }

  deleteAccount(id: number) {
    this.db.prepare('DELETE FROM accounts WHERE id = ?').run(id)
  }

  // Transactions
  getTransactions(filters?: { account_id?: number; category_id?: number; family_member_id?: number; type?: string; from_date?: string; to_date?: string; limit?: number; offset?: number }) {
    let where = 'WHERE 1=1'
    const params: any[] = []

    if (filters?.account_id) { where += ' AND t.account_id = ?'; params.push(filters.account_id) }
    if (filters?.category_id) { where += ' AND t.category_id = ?'; params.push(filters.category_id) }
    if (filters?.family_member_id) { where += ' AND t.family_member_id = ?'; params.push(filters.family_member_id) }
    if (filters?.type) { where += ' AND t.type = ?'; params.push(filters.type) }
    if (filters?.from_date) { where += ' AND t.date >= ?'; params.push(filters.from_date) }
    if (filters?.to_date) { where += ' AND t.date <= ?'; params.push(filters.to_date) }

    const limit = filters?.limit || 100
    const offset = filters?.offset || 0

    const rows = this.db.prepare(`
      SELECT t.*, a.name as account_name, c.name as category_name, c.color as category_color, TRIM(fm.first_name || ' ' || fm.last_name) as family_member_name
      FROM transactions t
      LEFT JOIN accounts a ON t.account_id = a.id
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN family_members fm ON t.family_member_id = fm.id
      ${where}
      ORDER BY t.date DESC, t.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset)

    const total = this.db.prepare(`SELECT COUNT(*) as c FROM transactions t ${where}`).get(...params) as any

    return { rows, total: total.c }
  }

  addTransaction(tx: { amount: number; type: string; description: string; date: string; account_id: number; category_id?: number; family_member_id?: number; notes?: string }) {
    const stmt = this.db.prepare('INSERT INTO transactions (amount, type, description, date, account_id, category_id, family_member_id, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    const result = stmt.run(tx.amount, tx.type, tx.description, tx.date, tx.account_id, tx.category_id || null, tx.family_member_id || null, tx.notes || null)

    // Update account balance
    if (tx.type === 'expense') {
      this.db.prepare('UPDATE accounts SET balance = balance - ? WHERE id = ?').run(tx.amount, tx.account_id)
    } else if (tx.type === 'income') {
      this.db.prepare('UPDATE accounts SET balance = balance + ? WHERE id = ?').run(tx.amount, tx.account_id)
    }

    return { id: result.lastInsertRowid, ...tx }
  }

  updateTransaction(id: number, tx: Partial<{ amount: number; type: string; description: string; date: string; account_id: number; category_id: number; family_member_id: number; notes: string }>) {
    // Get old transaction to reverse balance
    const old = this.db.prepare('SELECT * FROM transactions WHERE id = ?').get(id) as any
    if (old) {
      if (old.type === 'expense') {
        this.db.prepare('UPDATE accounts SET balance = balance + ? WHERE id = ?').run(old.amount, old.account_id)
      } else if (old.type === 'income') {
        this.db.prepare('UPDATE accounts SET balance = balance - ? WHERE id = ?').run(old.amount, old.account_id)
      }
    }

    const fields: string[] = []
    const values: any[] = []
    for (const [key, val] of Object.entries(tx)) {
      if (val !== undefined) { fields.push(`${key} = ?`); values.push(val) }
    }
    values.push(id)
    this.db.prepare(`UPDATE transactions SET ${fields.join(', ')} WHERE id = ?`).run(...values)

    // Apply new balance
    const updated = this.db.prepare('SELECT * FROM transactions WHERE id = ?').get(id) as any
    if (updated) {
      if (updated.type === 'expense') {
        this.db.prepare('UPDATE accounts SET balance = balance - ? WHERE id = ?').run(updated.amount, updated.account_id)
      } else if (updated.type === 'income') {
        this.db.prepare('UPDATE accounts SET balance = balance + ? WHERE id = ?').run(updated.amount, updated.account_id)
      }
    }

    return updated
  }

  deleteTransaction(id: number) {
    const tx = this.db.prepare('SELECT * FROM transactions WHERE id = ?').get(id) as any
    if (tx) {
      if (tx.type === 'expense') {
        this.db.prepare('UPDATE accounts SET balance = balance + ? WHERE id = ?').run(tx.amount, tx.account_id)
      } else if (tx.type === 'income') {
        this.db.prepare('UPDATE accounts SET balance = balance - ? WHERE id = ?').run(tx.amount, tx.account_id)
      }
    }
    this.db.prepare('DELETE FROM transactions WHERE id = ?').run(id)
  }

  // Categories
  getCategories() {
    return this.db.prepare('SELECT * FROM categories ORDER BY type, name').all()
  }

  addCategory(cat: { name: string; type: string; color: string }) {
    const stmt = this.db.prepare('INSERT INTO categories (name, type, color) VALUES (?, ?, ?)')
    const result = stmt.run(cat.name, cat.type, cat.color)
    return { id: result.lastInsertRowid, ...cat }
  }

  deleteCategory(id: number) {
    this.db.prepare('DELETE FROM categories WHERE id = ?').run(id)
  }

  // Expenses
  getExpenses() {
    const expenses = this.db.prepare(`
      SELECT * FROM expenses ORDER BY created_at DESC
    `).all() as any[]

    return expenses.map((exp: any) => {
      const members = this.db.prepare(`
        SELECT em.*, TRIM(fm.first_name || ' ' || fm.last_name) as member_name, fm.avatar_color, fm.avatar_image, fm.role as member_role
        FROM expense_members em
        JOIN family_members fm ON em.member_id = fm.id
        WHERE em.expense_id = ?
      `).all(exp.id)

      return {
        ...exp,
        beneficiaries: (members as any[]).filter((m: any) => m.role === 'beneficiary'),
        payers: (members as any[]).filter((m: any) => m.role === 'payer'),
      }
    })
  }

  addExpense(expense: { name: string; amount: number; notes?: string; expense_date?: string | null; due_date?: string | null; recurrence?: string | null; end_date?: string | null; beneficiary_ids: number[]; payers: { member_id: number; amount: number }[] }) {
    const insertExpense = this.db.prepare('INSERT INTO expenses (name, amount, notes, expense_date, due_date, recurrence, end_date) VALUES (?, ?, ?, ?, ?, ?, ?)')
    const insertMember = this.db.prepare('INSERT INTO expense_members (expense_id, member_id, role, amount) VALUES (?, ?, ?, ?)')

    const result = this.db.transaction(() => {
      const res = insertExpense.run(
        expense.name,
        expense.amount,
        expense.notes || null,
        expense.expense_date || null,
        expense.due_date || null,
        expense.recurrence || 'once',
        expense.end_date || null,
      )
      const expenseId = res.lastInsertRowid

      for (const id of expense.beneficiary_ids) {
        insertMember.run(expenseId, id, 'beneficiary', null)
      }
      for (const payer of expense.payers) {
        insertMember.run(expenseId, payer.member_id, 'payer', payer.amount)
      }

      return expenseId
    })()

    return this.getExpenseById(result as number)
  }

  updateExpense(id: number, expense: { name: string; amount: number; notes?: string; expense_date?: string | null; due_date?: string | null; recurrence?: string | null; end_date?: string | null; beneficiary_ids: number[]; payers: { member_id: number; amount: number }[] }) {
    const updateExp = this.db.prepare('UPDATE expenses SET name = ?, amount = ?, notes = ?, expense_date = ?, due_date = ?, recurrence = ?, end_date = ? WHERE id = ?')
    const deleteMembersStmt = this.db.prepare('DELETE FROM expense_members WHERE expense_id = ?')
    const insertMember = this.db.prepare('INSERT INTO expense_members (expense_id, member_id, role, amount) VALUES (?, ?, ?, ?)')

    this.db.transaction(() => {
      updateExp.run(
        expense.name,
        expense.amount,
        expense.notes || null,
        expense.expense_date || null,
        expense.due_date || null,
        expense.recurrence || 'once',
        expense.end_date || null,
        id,
      )
      deleteMembersStmt.run(id)

      for (const memberId of expense.beneficiary_ids) {
        insertMember.run(id, memberId, 'beneficiary', null)
      }
      for (const payer of expense.payers) {
        insertMember.run(id, payer.member_id, 'payer', payer.amount)
      }
    })()

    return this.getExpenseById(id)
  }

  deleteExpense(id: number) {
    this.db.prepare('DELETE FROM expenses WHERE id = ?').run(id)
  }

  private getExpenseById(id: number) {
    const exp = this.db.prepare('SELECT * FROM expenses WHERE id = ?').get(id) as any
    if (!exp) return null

    const members = this.db.prepare(`
      SELECT em.*, TRIM(fm.first_name || ' ' || fm.last_name) as member_name, fm.avatar_color, fm.avatar_image, fm.role as member_role
      FROM expense_members em
      JOIN family_members fm ON em.member_id = fm.id
      WHERE em.expense_id = ?
    `).all(id)

    return {
      ...exp,
      beneficiaries: (members as any[]).filter((m: any) => m.role === 'beneficiary'),
      payers: (members as any[]).filter((m: any) => m.role === 'payer'),
    }
  }

  getNonPetMembers() {
    return this.db.prepare(`
      SELECT *, (first_name || ' ' || last_name) AS name FROM family_members
      WHERE role != 'Pet'
      ORDER BY created_at
    `).all().map((m: any) => ({ ...m, name: m.name.trim() }))
  }

  // Dashboard — expenses-only
  getDashboardData() {
    const now = new Date()
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
    const monthEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-31`

    // Aggregate stats from expenses table
    const totals = this.db.prepare(
      `SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count FROM expenses`
    ).get() as any

    const monthlyTotal = this.db.prepare(
      `SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE created_at >= ? AND created_at < ?`
    ).get(monthStart + ' 00:00:00', monthEnd + ' 23:59:59') as any

    // Recent expenses with payer names
    const recentExpenses = this.db.prepare(`
      SELECT e.id, e.name, e.amount, e.created_at,
        GROUP_CONCAT(TRIM(fm.first_name || ' ' || fm.last_name), ', ') as payers
      FROM expenses e
      LEFT JOIN expense_members em ON em.expense_id = e.id AND em.role = 'payer'
      LEFT JOIN family_members fm ON em.member_id = fm.id
      GROUP BY e.id
      ORDER BY e.created_at DESC
      LIMIT 10
    `).all()

    // Monthly trend (last 6 months) — expenses only
    const monthlyTrend = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const start = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
      const end = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-31`

      const expenses = this.db.prepare(
        `SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE created_at >= ? AND created_at < ?`
      ).get(start + ' 00:00:00', end + ' 23:59:59') as any

      monthlyTrend.push({
        month: d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        expenses: expenses.total
      })
    }

    // Spending by family member (current month) — payers only
    const spendingByMember = this.db.prepare(`
      SELECT TRIM(fm.first_name || ' ' || fm.last_name) as name, fm.avatar_color, SUM(em.amount) as total
      FROM expense_members em
      JOIN expenses e ON em.expense_id = e.id
      JOIN family_members fm ON em.member_id = fm.id
      WHERE em.role = 'payer' AND e.created_at >= ? AND e.created_at < ?
      GROUP BY fm.id
      ORDER BY total DESC
    `).all(monthStart + ' 00:00:00', monthEnd + ' 23:59:59')

    return {
      totalExpenses: totals.total,
      monthlyExpenses: monthlyTotal.total,
      expenseCount: totals.count,
      averageExpense: totals.count > 0 ? totals.total / totals.count : 0,
      recentExpenses,
      monthlyTrend,
      spendingByMember
    }
  }

  // Bills
  getBills() {
    return this.db.prepare(`
      SELECT b.*, c.name as category_name, c.color as category_color, a.name as account_name
      FROM bills b
      LEFT JOIN categories c ON b.category_id = c.id
      LEFT JOIN accounts a ON b.account_id = a.id
      ORDER BY b.due_date ASC
    `).all()
  }

  addBill(bill: { name: string; amount: number; due_date: string; recurrence: string; category_id?: number; account_id?: number; notes?: string }) {
    const stmt = this.db.prepare(`
      INSERT INTO bills (name, amount, due_date, recurrence, category_id, account_id, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    const result = stmt.run(bill.name, bill.amount, bill.due_date, bill.recurrence, bill.category_id || null, bill.account_id || null, bill.notes || null)
    return this.db.prepare('SELECT * FROM bills WHERE id = ?').get(result.lastInsertRowid)
  }

  updateBill(id: number, bill: Partial<{ name: string; amount: number; due_date: string; recurrence: string; category_id: number | null; account_id: number | null; notes: string; is_paid: number }>) {
    const fields: string[] = []
    const values: any[] = []
    for (const [key, val] of Object.entries(bill)) {
      if (val !== undefined) { fields.push(`${key} = ?`); values.push(val) }
    }
    if (fields.length === 0) return this.db.prepare('SELECT * FROM bills WHERE id = ?').get(id)
    values.push(id)
    this.db.prepare(`UPDATE bills SET ${fields.join(', ')} WHERE id = ?`).run(...values)
    return this.db.prepare('SELECT * FROM bills WHERE id = ?').get(id)
  }

  deleteBill(id: number) {
    this.db.prepare('DELETE FROM bills WHERE id = ?').run(id)
  }

  payBill(id: number) {
    const bill = this.db.prepare('SELECT * FROM bills WHERE id = ?').get(id) as any
    if (!bill) return null
    const today = new Date().toISOString().slice(0, 10)

    // Create a transaction if account is linked
    if (bill.account_id) {
      const txStmt = this.db.prepare(`
        INSERT INTO transactions (amount, type, description, date, account_id, category_id)
        VALUES (?, 'expense', ?, ?, ?, ?)
      `)
      txStmt.run(bill.amount, bill.name, today, bill.account_id, bill.category_id || null)
      this.db.prepare('UPDATE accounts SET balance = balance - ? WHERE id = ?').run(bill.amount, bill.account_id)
    }

    // Advance due_date for recurring bills, otherwise mark paid
    const next = this.advanceDueDate(bill.due_date, bill.recurrence)
    if (next) {
      this.db.prepare('UPDATE bills SET due_date = ?, last_paid_date = ?, is_paid = 0 WHERE id = ?').run(next, today, id)
    } else {
      this.db.prepare('UPDATE bills SET is_paid = 1, last_paid_date = ? WHERE id = ?').run(today, id)
    }
    return this.db.prepare('SELECT * FROM bills WHERE id = ?').get(id)
  }

  private advanceDueDate(dateStr: string, recurrence: string): string | null {
    if (recurrence === 'once') return null
    const d = new Date(dateStr + 'T00:00:00')
    switch (recurrence) {
      case 'weekly': d.setDate(d.getDate() + 7); break
      case 'biweekly': d.setDate(d.getDate() + 14); break
      case 'monthly': d.setMonth(d.getMonth() + 1); break
      case 'quarterly': d.setMonth(d.getMonth() + 3); break
      case 'yearly': d.setFullYear(d.getFullYear() + 1); break
      default: return null
    }
    return d.toISOString().slice(0, 10)
  }

  // Budgets
  getBudgets() {
    const budgets = this.db.prepare(`
      SELECT b.*, c.name as category_name, c.color as category_color
      FROM budgets b
      JOIN categories c ON b.category_id = c.id
      ORDER BY c.name
    `).all() as any[]

    const now = new Date()
    return budgets.map(b => {
      const { start, end } = this.periodRange(b.period, now)
      const spent = this.db.prepare(`
        SELECT COALESCE(SUM(amount), 0) as total
        FROM transactions
        WHERE category_id = ? AND type = 'expense' AND date >= ? AND date <= ?
      `).get(b.category_id, start, end) as any
      return { ...b, spent: spent.total, period_start: start, period_end: end }
    })
  }

  addBudget(b: { category_id: number; amount: number; period: string }) {
    const stmt = this.db.prepare('INSERT INTO budgets (category_id, amount, period) VALUES (?, ?, ?)')
    const result = stmt.run(b.category_id, b.amount, b.period)
    return this.db.prepare('SELECT * FROM budgets WHERE id = ?').get(result.lastInsertRowid)
  }

  updateBudget(id: number, b: Partial<{ amount: number; period: string }>) {
    const fields: string[] = []
    const values: any[] = []
    for (const [key, val] of Object.entries(b)) {
      if (val !== undefined) { fields.push(`${key} = ?`); values.push(val) }
    }
    if (fields.length === 0) return this.db.prepare('SELECT * FROM budgets WHERE id = ?').get(id)
    values.push(id)
    this.db.prepare(`UPDATE budgets SET ${fields.join(', ')} WHERE id = ?`).run(...values)
    return this.db.prepare('SELECT * FROM budgets WHERE id = ?').get(id)
  }

  deleteBudget(id: number) {
    this.db.prepare('DELETE FROM budgets WHERE id = ?').run(id)
  }

  private periodRange(period: string, ref: Date): { start: string; end: string } {
    const y = ref.getFullYear()
    const m = ref.getMonth()
    const d = ref.getDate()
    const fmt = (date: Date) => date.toISOString().slice(0, 10)
    if (period === 'weekly') {
      const day = ref.getDay() // 0=Sun
      const offset = (day + 6) % 7 // distance back to Monday
      const start = new Date(y, m, d - offset)
      const end = new Date(y, m, d - offset + 6)
      return { start: fmt(start), end: fmt(end) }
    }
    if (period === 'yearly') {
      return { start: `${y}-01-01`, end: `${y}-12-31` }
    }
    // monthly default
    const start = new Date(y, m, 1)
    const end = new Date(y, m + 1, 0)
    return { start: fmt(start), end: fmt(end) }
  }

  // Goals
  getGoals() {
    return this.db.prepare('SELECT * FROM goals ORDER BY created_at DESC').all()
  }

  addGoal(g: { name: string; target_amount: number; current_amount?: number; target_date?: string; color?: string; notes?: string }) {
    const stmt = this.db.prepare(`
      INSERT INTO goals (name, target_amount, current_amount, target_date, color, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    const result = stmt.run(g.name, g.target_amount, g.current_amount || 0, g.target_date || null, g.color || '#d4a843', g.notes || null)
    return this.db.prepare('SELECT * FROM goals WHERE id = ?').get(result.lastInsertRowid)
  }

  updateGoal(id: number, g: Partial<{ name: string; target_amount: number; current_amount: number; target_date: string | null; color: string; notes: string | null }>) {
    const fields: string[] = []
    const values: any[] = []
    for (const [key, val] of Object.entries(g)) {
      if (val !== undefined) { fields.push(`${key} = ?`); values.push(val) }
    }
    if (fields.length === 0) return this.db.prepare('SELECT * FROM goals WHERE id = ?').get(id)
    values.push(id)
    this.db.prepare(`UPDATE goals SET ${fields.join(', ')} WHERE id = ?`).run(...values)
    return this.db.prepare('SELECT * FROM goals WHERE id = ?').get(id)
  }

  deleteGoal(id: number) {
    this.db.prepare('DELETE FROM goals WHERE id = ?').run(id)
  }

  contributeToGoal(id: number, amount: number) {
    this.db.prepare('UPDATE goals SET current_amount = current_amount + ? WHERE id = ?').run(amount, id)
    return this.db.prepare('SELECT * FROM goals WHERE id = ?').get(id)
  }

  // Net Worth
  getNetWorth() {
    const accounts = this.db.prepare('SELECT * FROM accounts').all() as any[]
    let assets = 0
    let liabilities = 0
    for (const a of accounts) {
      if (['credit_card', 'loan'].includes(a.type)) liabilities += Math.abs(a.balance)
      else assets += a.balance
    }
    const history = this.db.prepare('SELECT date, assets, liabilities, net_worth FROM net_worth_snapshots ORDER BY date ASC').all()
    const breakdown = this.db.prepare(`
      SELECT type, SUM(balance) as total, COUNT(*) as count
      FROM accounts
      GROUP BY type
    `).all()
    return {
      assets,
      liabilities,
      netWorth: assets - liabilities,
      history,
      breakdown,
    }
  }

  // Savings
  getSavingsData() {
    const accounts = this.db.prepare(`
      SELECT a.*, TRIM(fm.first_name || ' ' || fm.last_name) as owner_name
      FROM accounts a
      LEFT JOIN family_members fm ON a.owner_id = fm.id
      WHERE a.type = 'savings'
      ORDER BY a.balance DESC
    `).all() as any[]

    const totalSavings = accounts.reduce((s, a) => s + a.balance, 0)
    const accountIds = accounts.map(a => a.id)
    const idList = accountIds.length ? accountIds.join(',') : '0'

    const now = new Date()
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
    const monthEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-31`

    // Whole-portfolio income/expense for this month (used for savings rate)
    const monthIncome = this.db.prepare(
      `SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE type = 'income' AND date >= ? AND date <= ?`
    ).get(monthStart, monthEnd) as any
    const monthExpense = this.db.prepare(
      `SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE type = 'expense' AND date >= ? AND date <= ?`
    ).get(monthStart, monthEnd) as any

    const savingsRate = monthIncome.total > 0
      ? Math.max(0, (monthIncome.total - monthExpense.total) / monthIncome.total) * 100
      : 0

    // Trailing 6-month trend: net flow into savings accounts (income to them minus expense from them)
    const trend: { month: string; saved: number }[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const start = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
      const endD = new Date(d.getFullYear(), d.getMonth() + 1, 0)
      const end = `${endD.getFullYear()}-${String(endD.getMonth() + 1).padStart(2, '0')}-${String(endD.getDate()).padStart(2, '0')}`

      let saved = 0
      if (accountIds.length) {
        const inflow = this.db.prepare(
          `SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE type = 'income' AND account_id IN (${idList}) AND date >= ? AND date <= ?`
        ).get(start, end) as any
        const outflow = this.db.prepare(
          `SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE type = 'expense' AND account_id IN (${idList}) AND date >= ? AND date <= ?`
        ).get(start, end) as any
        saved = inflow.total - outflow.total
      }
      trend.push({ month: d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }), saved })
    }

    // Recent transactions on savings accounts
    let recent: any[] = []
    if (accountIds.length) {
      recent = this.db.prepare(`
        SELECT t.*, a.name as account_name
        FROM transactions t
        LEFT JOIN accounts a ON t.account_id = a.id
        WHERE t.account_id IN (${idList})
        ORDER BY t.date DESC, t.created_at DESC
        LIMIT 10
      `).all()
    }

    return {
      totalSavings,
      savingsRate,
      monthIncome: monthIncome.total,
      monthExpense: monthExpense.total,
      monthSaved: monthIncome.total - monthExpense.total,
      trend,
      accounts,
      recent,
    }
  }

  addSavingsContribution(payload: { account_id: number; amount: number; date: string; description?: string; notes?: string }) {
    return this.addTransaction({
      account_id: payload.account_id,
      amount: payload.amount,
      type: 'income',
      description: payload.description || 'Savings contribution',
      date: payload.date,
      notes: payload.notes,
    })
  }

  takeNetWorthSnapshot() {
    const accounts = this.db.prepare('SELECT * FROM accounts').all() as any[]
    let assets = 0
    let liabilities = 0
    for (const a of accounts) {
      if (['credit_card', 'loan'].includes(a.type)) liabilities += Math.abs(a.balance)
      else assets += a.balance
    }
    const today = new Date().toISOString().slice(0, 10)
    this.db.prepare(`
      INSERT INTO net_worth_snapshots (date, assets, liabilities, net_worth)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(date) DO UPDATE SET assets = excluded.assets, liabilities = excluded.liabilities, net_worth = excluded.net_worth
    `).run(today, assets, liabilities, assets - liabilities)
    return this.db.prepare('SELECT * FROM net_worth_snapshots WHERE date = ?').get(today)
  }

  // ===== Chat threads =====

  listChatThreads() {
    return this.db.prepare(`
      SELECT
        t.id,
        t.title,
        t.claude_session_id,
        t.model,
        t.created_at,
        t.updated_at,
        (SELECT COUNT(*) FROM chat_messages m WHERE m.thread_id = t.id) AS message_count
      FROM chat_threads t
      ORDER BY t.updated_at DESC
    `).all()
  }

  getChatThread(id: string) {
    const thread = this.db.prepare(`SELECT * FROM chat_threads WHERE id = ?`).get(id) as any
    if (!thread) return null
    const messages = this.db.prepare(`
      SELECT id, thread_id, role, status, blocks_json, meta_json, error, created_at_ms, ord
      FROM chat_messages WHERE thread_id = ? ORDER BY ord ASC
    `).all(id)
    return { thread, messages }
  }

  createChatThread(payload: { id: string; title: string; model: string | null }) {
    this.db.prepare(`
      INSERT INTO chat_threads (id, title, model) VALUES (?, ?, ?)
    `).run(payload.id, payload.title, payload.model ?? null)
    return this.db.prepare(`SELECT * FROM chat_threads WHERE id = ?`).get(payload.id)
  }

  updateChatThread(
    id: string,
    fields: { title?: string; claude_session_id?: string | null; model?: string | null; touch?: boolean },
  ) {
    const sets: string[] = []
    const values: any[] = []
    if (fields.title !== undefined) { sets.push('title = ?'); values.push(fields.title) }
    if (fields.claude_session_id !== undefined) {
      sets.push('claude_session_id = ?'); values.push(fields.claude_session_id)
    }
    if (fields.model !== undefined) { sets.push('model = ?'); values.push(fields.model) }
    if (fields.touch !== false) sets.push("updated_at = datetime('now')")
    if (sets.length === 0) return this.db.prepare(`SELECT * FROM chat_threads WHERE id = ?`).get(id)
    values.push(id)
    this.db.prepare(`UPDATE chat_threads SET ${sets.join(', ')} WHERE id = ?`).run(...values)
    return this.db.prepare(`SELECT * FROM chat_threads WHERE id = ?`).get(id)
  }

  deleteChatThread(id: string) {
    this.db.prepare(`DELETE FROM chat_threads WHERE id = ?`).run(id)
  }

  saveChatMessage(payload: {
    id: string
    thread_id: string
    role: 'user' | 'assistant'
    status: string
    blocks_json: string
    meta_json: string | null
    error: string | null
    created_at_ms: number
    ord: number
  }) {
    this.db.prepare(`
      INSERT INTO chat_messages (id, thread_id, role, status, blocks_json, meta_json, error, created_at_ms, ord)
      VALUES (@id, @thread_id, @role, @status, @blocks_json, @meta_json, @error, @created_at_ms, @ord)
      ON CONFLICT(id) DO UPDATE SET
        status = excluded.status,
        blocks_json = excluded.blocks_json,
        meta_json = excluded.meta_json,
        error = excluded.error,
        ord = excluded.ord
    `).run(payload)
    this.db.prepare(`UPDATE chat_threads SET updated_at = datetime('now') WHERE id = ?`).run(payload.thread_id)
  }
}

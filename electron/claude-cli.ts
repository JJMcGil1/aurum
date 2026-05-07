import { spawn, execFile, ChildProcess } from 'child_process'
import { promisify } from 'util'
import { shell, BrowserWindow } from 'electron'
import os from 'os'
import path from 'path'
import fs from 'fs'

const execFileP = promisify(execFile)

const OAUTH_URL_RE = /https:\/\/(?:claude\.ai|console\.anthropic\.com|auth\.anthropic\.com)\/[^\s'"]+/i

const CANDIDATE_DIRS = [
  path.join(os.homedir(), '.moxby/cli/bin'),
  path.join(os.homedir(), '.local/bin'),
  path.join(os.homedir(), '.npm-global/bin'),
  '/opt/homebrew/bin',
  '/usr/local/bin',
  path.join(os.homedir(), '.bun/bin'),
  path.join(os.homedir(), '.volta/bin'),
  '/usr/bin',
]

let cachedBinary: string | null = null
let activeLogin: { child: ChildProcess; cancel: () => void } | null = null

interface AurumToolContext {
  dbPath: string
  mcpServerPath: string
}
let toolContext: AurumToolContext | null = null

export function configureAurumTools(ctx: AurumToolContext) {
  toolContext = ctx
}

const AURUM_TOOL_NAMES = [
  'list_family_members',
  'list_expenses',
  'get_expense',
  'expense_summary',
  'spending_by_member',
  'spending_for_member',
  'monthly_trend',
  'top_expenses',
] as const

const AURUM_SYSTEM_PROMPT = `You are the in-app assistant for Aurum, a family finance tracker. \
You have a set of MCP tools (prefixed mcp__aurum__) that read the user's local SQLite finance \
database — list_family_members, list_expenses, get_expense, expense_summary, spending_by_member, \
spending_for_member, monthly_trend, top_expenses.

Rules:
- For ANY question about who the user is, who's in their family, expenses, spending, who paid, \
who benefited, monthly totals, trends, comparisons, or top items — call the relevant tool(s) FIRST \
and ground your answer in real data. Never guess or fabricate numbers.
- If the user asks "who am I" or "who's in my family", call list_family_members.
- Call multiple tools in parallel when independent.
- Be concise. Lead with the number or the answer, then a short explanation. Format currency as USD \
(e.g. $1,234.56). Use compact tables only when comparing 3+ items.
- If a tool returns no data, say so plainly — don't pad.`

export interface ClaudeStatus {
  installed: boolean
  authenticated: boolean
  binaryPath: string | null
  version: string | null
  error?: string
}

export async function resolveBinary(): Promise<string | null> {
  if (cachedBinary && fs.existsSync(cachedBinary)) return cachedBinary

  for (const dir of CANDIDATE_DIRS) {
    const candidate = path.join(dir, 'claude')
    if (fs.existsSync(candidate)) {
      cachedBinary = candidate
      return candidate
    }
  }

  // Fallback: ask the login shell where `claude` lives. GUI apps often have a
  // stale PATH that misses nvm/asdf/fnm, so a login+interactive shell is the
  // most reliable last resort.
  try {
    const shellPath = process.env.SHELL || '/bin/zsh'
    const { stdout } = await execFileP(shellPath, ['-l', '-i', '-c', 'command -v claude'], {
      timeout: 8000,
    })
    const found = stdout.trim().split('\n').pop()?.trim()
    if (found && fs.existsSync(found)) {
      cachedBinary = found
      return found
    }
  } catch {
    /* ignored */
  }

  return null
}

async function isAuthenticated(): Promise<boolean> {
  if (process.platform === 'darwin') {
    try {
      await execFileP('security', ['find-generic-password', '-s', 'Claude Code-credentials'], {
        timeout: 4000,
      })
      return true
    } catch {
      // fall through to file check (some installs still use file even on mac)
    }
  }
  const credPath = path.join(os.homedir(), '.claude/.credentials.json')
  try {
    const raw = fs.readFileSync(credPath, 'utf8')
    JSON.parse(raw)
    return true
  } catch {
    return false
  }
}

async function readVersion(binary: string): Promise<string | null> {
  try {
    const { stdout } = await execFileP(binary, ['--version'], { timeout: 4000 })
    return stdout.trim().split('\n')[0] || null
  } catch {
    return null
  }
}

export async function getStatus(): Promise<ClaudeStatus> {
  const binary = await resolveBinary()
  if (!binary) {
    return { installed: false, authenticated: false, binaryPath: null, version: null }
  }
  const [authed, version] = await Promise.all([isAuthenticated(), readVersion(binary)])
  return { installed: true, authenticated: authed, binaryPath: binary, version }
}

export async function signOut(): Promise<{ ok: boolean; message?: string }> {
  let removed = false
  if (process.platform === 'darwin') {
    try {
      await execFileP('security', ['delete-generic-password', '-s', 'Claude Code-credentials'], {
        timeout: 4000,
      })
      removed = true
    } catch {
      /* not present */
    }
  }
  const credPath = path.join(os.homedir(), '.claude/.credentials.json')
  try {
    fs.unlinkSync(credPath)
    removed = true
  } catch {
    /* not present */
  }
  return { ok: true, message: removed ? 'Signed out' : 'Already signed out' }
}

export function cancelLogin() {
  if (activeLogin) {
    try {
      activeLogin.cancel()
    } catch {
      /* ignore */
    }
    activeLogin = null
  }
}

export async function startLogin(window: BrowserWindow): Promise<void> {
  cancelLogin()

  const binary = await resolveBinary()
  if (!binary) {
    window.webContents.send('claude:login-event', {
      kind: 'error',
      message: 'claude CLI not found. Install it with `npm i -g @anthropic-ai/claude-code` and try again.',
    })
    return
  }

  // Spawn the CLI with the login slash command. Older versions accept this
  // as a positional arg; newer ones run it as a startup slash command.
  const child = spawn(binary, ['/login'], {
    env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1', TERM: 'dumb' },
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  let openedUrl = false
  let cancelled = false
  let pollTimer: NodeJS.Timeout | null = null
  let urlWatchdog: NodeJS.Timeout | null = null

  const cleanup = () => {
    if (pollTimer) clearInterval(pollTimer)
    if (urlWatchdog) clearTimeout(urlWatchdog)
    try {
      if (!child.killed) child.kill()
    } catch {
      /* ignore */
    }
    activeLogin = null
  }

  const send = (payload: Record<string, unknown>) => {
    if (window.isDestroyed()) return
    window.webContents.send('claude:login-event', payload)
  }

  activeLogin = {
    child,
    cancel: () => {
      cancelled = true
      cleanup()
      send({ kind: 'cancelled' })
    },
  }

  const handleChunk = (chunk: Buffer | string) => {
    const text = chunk.toString()
    if (!openedUrl) {
      const match = text.match(OAUTH_URL_RE)
      if (match) {
        openedUrl = true
        const url = match[0]
        send({ kind: 'url', url })
        shell.openExternal(url).catch(() => {
          send({ kind: 'error', message: `Couldn't open browser. Visit ${url} to sign in.` })
        })
      }
    }
  }

  child.stdout?.on('data', handleChunk)
  child.stderr?.on('data', handleChunk)

  child.on('error', err => {
    if (cancelled) return
    send({ kind: 'error', message: err.message })
    cleanup()
  })

  child.on('exit', () => {
    // Don't cleanup here — auth may complete after the child exits, and the
    // poller is what flips the UI. Watchdog will tear things down.
  })

  // Watchdog: if no OAuth URL printed within 8s, surface a fallback so the
  // user can sign in via their own terminal and click Recheck.
  urlWatchdog = setTimeout(() => {
    if (!openedUrl && !cancelled) {
      send({ kind: 'needs-terminal' })
    }
  }, 8000)

  // Poll auth every 2s, up to 120s total.
  let ticks = 0
  pollTimer = setInterval(async () => {
    ticks += 1
    if (cancelled) return
    if (await isAuthenticated()) {
      send({ kind: 'success' })
      cleanup()
      return
    }
    if (ticks >= 60) {
      send({ kind: 'timeout' })
      cleanup()
    }
  }, 2000)
}

export interface SendResult {
  text: string
  sessionId: string | null
  durationMs: number
  model: string | null
  costUsd: number | null
  inputTokens: number | null
  outputTokens: number | null
}

export interface SendOptions {
  sessionId?: string | null
  model?: string | null
}

function buildClaudeArgs(prompt: string, options: SendOptions, outputFormat: 'json' | 'stream-json'): string[] {
  const args = ['-p', prompt, '--output-format', outputFormat]
  if (outputFormat === 'stream-json') {
    // Required by the CLI when --print + stream-json are combined.
    args.push('--verbose', '--include-partial-messages')
  }
  if (options.sessionId) args.push('--resume', options.sessionId)
  if (options.model) args.push('--model', options.model)

  if (toolContext) {
    const mcpConfig = {
      mcpServers: {
        aurum: {
          // process.execPath is the Electron binary; ELECTRON_RUN_AS_NODE
          // makes it behave like plain node, so users don't need a separate
          // node install for the MCP subprocess.
          command: process.execPath,
          args: [toolContext.mcpServerPath],
          env: {
            ELECTRON_RUN_AS_NODE: '1',
            AURUM_DB_PATH: toolContext.dbPath,
            ELECTRON_NO_ATTACH_CONSOLE: '1',
          },
        },
      },
    }
    args.push('--mcp-config', JSON.stringify(mcpConfig))
    args.push('--strict-mcp-config')
    args.push('--permission-mode', 'bypassPermissions')
    // Disable all built-in tools so the model goes straight to MCP. Without
    // this the new CLI's tool-deferral path makes Claude burn a turn calling
    // ToolSearch before our tools become callable.
    args.push('--tools', '')
    args.push('--allowedTools', AURUM_TOOL_NAMES.map(n => `mcp__aurum__${n}`).join(','))
    args.push('--append-system-prompt', AURUM_SYSTEM_PROMPT)
  }
  return args
}

export async function sendMessage(prompt: string, options: SendOptions = {}): Promise<SendResult> {
  const binary = await resolveBinary()
  if (!binary) throw new Error('claude CLI not found')

  const args = buildClaudeArgs(prompt, options, 'json')
  const childEnv: NodeJS.ProcessEnv = { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' }

  const startedAt = Date.now()

  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, {
      env: childEnv,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''
    child.stdout.on('data', d => { stdout += d.toString() })
    child.stderr.on('data', d => { stderr += d.toString() })

    child.on('error', err => reject(err))
    child.on('close', code => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || `claude exited with code ${code}`))
        return
      }
      try {
        const trimmed = stdout.trim()
        const parsed = JSON.parse(trimmed)
        const text =
          parsed.result ??
          parsed.text ??
          (Array.isArray(parsed.content)
            ? parsed.content.map((c: any) => c?.text ?? '').join('')
            : '') ??
          ''
        // The CLI reports modelUsage as a map keyed by the model id(s) used.
        // The "primary" model is the one with the most output tokens.
        let primaryModel: string | null = parsed.model ?? null
        let inTok = 0
        let outTok = 0
        if (parsed.modelUsage && typeof parsed.modelUsage === 'object') {
          let bestOut = -1
          for (const [name, usage] of Object.entries<any>(parsed.modelUsage)) {
            inTok += usage?.inputTokens ?? 0
            outTok += usage?.outputTokens ?? 0
            if ((usage?.outputTokens ?? 0) > bestOut) {
              bestOut = usage?.outputTokens ?? 0
              primaryModel = name
            }
          }
        }
        resolve({
          text: typeof text === 'string' ? text : String(text),
          sessionId: parsed.session_id ?? parsed.sessionId ?? null,
          durationMs: Date.now() - startedAt,
          model: primaryModel,
          costUsd: typeof parsed.total_cost_usd === 'number' ? parsed.total_cost_usd : null,
          inputTokens: inTok || null,
          outputTokens: outTok || null,
        })
      } catch {
        resolve({
          text: stdout.trim(),
          sessionId: null,
          durationMs: Date.now() - startedAt,
          model: null,
          costUsd: null,
          inputTokens: null,
          outputTokens: null,
        })
      }
    })
  })
}

// ---- Streaming -----------------------------------------------------------
//
// Streaming flow: the renderer calls claude:streamMessage with a requestId.
// We spawn `claude -p --output-format stream-json --include-partial-messages`,
// parse line-delimited JSON, translate the wire format into a clean event
// schema, and forward each event over `claude:stream-event` tagged with the
// requestId. The renderer correlates and renders.
//
// Per-message block index resets on every `message_start`. We keep a small
// per-stream state machine to map (messageIndex → block kind / json scratch).

export type ClaudeStreamPayload =
  | { type: 'session_init'; sessionId: string; model: string | null }
  | { type: 'message_start'; messageId: string }
  | {
      type: 'block_open'
      messageId: string
      index: number
      block:
        | { kind: 'text' }
        | { kind: 'thinking' }
        | { kind: 'tool_use'; id: string; name: string; input: any }
        | { kind: 'unknown'; raw: any }
    }
  | { type: 'text_delta'; messageId: string; index: number; text: string }
  | { type: 'tool_input_delta'; messageId: string; index: number; partialJson: string }
  | { type: 'block_close'; messageId: string; index: number; finalInput?: any }
  | { type: 'message_stop'; messageId: string }
  | { type: 'tool_result'; toolUseId: string; text: string; isError?: boolean }
  | {
      type: 'result'
      sessionId: string | null
      durationMs: number
      model: string | null
      costUsd: number | null
      inputTokens: number | null
      outputTokens: number | null
    }
  | { type: 'error'; message: string }
  | { type: 'closed' }

const activeStreams = new Map<string, ChildProcess>()

// ---- Tool discovery -------------------------------------------------------
//
// Spawns the local Aurum MCP server, runs the JSON-RPC handshake, asks for
// tools/list, then kills the child. Cached after the first call so repeated
// renderer requests are free.

interface AurumToolMeta {
  name: string
  description: string
}

let cachedAurumTools: AurumToolMeta[] | null = null

export async function listAurumTools(): Promise<AurumToolMeta[]> {
  if (cachedAurumTools) return cachedAurumTools
  if (!toolContext) return []

  return new Promise<AurumToolMeta[]>((resolve, reject) => {
    const child = spawn(process.execPath, [toolContext!.mcpServerPath], {
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: '1',
        AURUM_DB_PATH: toolContext!.dbPath,
        ELECTRON_NO_ATTACH_CONSOLE: '1',
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    let resolved = false
    const finish = (fn: () => void) => {
      if (resolved) return
      resolved = true
      clearTimeout(timeout)
      try { child.kill() } catch { /* ignore */ }
      fn()
    }

    const timeout = setTimeout(() => {
      finish(() => reject(new Error('listAurumTools timed out')))
    }, 5000)

    const send = (msg: Record<string, unknown>) => {
      try {
        child.stdin.write(JSON.stringify(msg) + '\n')
      } catch {
        /* child may have died */
      }
    }

    let buf = ''
    child.stdout.setEncoding('utf8')
    child.stdout.on('data', (d: string) => {
      buf += d
      let nl: number
      while ((nl = buf.indexOf('\n')) !== -1) {
        const line = buf.slice(0, nl).trim()
        buf = buf.slice(nl + 1)
        if (!line) continue
        try {
          const m = JSON.parse(line)
          if (m.id === 2 && m.result?.tools) {
            const tools: AurumToolMeta[] = m.result.tools.map((t: any) => ({
              name: t.name,
              description: t.description ?? '',
            }))
            cachedAurumTools = tools
            finish(() => resolve(tools))
            return
          }
        } catch {
          /* ignore malformed line */
        }
      }
    })

    child.on('error', err => finish(() => reject(err)))
    child.on('exit', () => finish(() => reject(new Error('MCP server exited before tools/list'))))

    send({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { protocolVersion: '2025-06-18', capabilities: {} },
    })
    send({ jsonrpc: '2.0', method: 'notifications/initialized' })
    send({ jsonrpc: '2.0', id: 2, method: 'tools/list' })
  })
}

export function cancelStream(requestId: string) {
  const child = activeStreams.get(requestId)
  if (child && !child.killed) {
    try { child.kill() } catch { /* ignore */ }
  }
  activeStreams.delete(requestId)
}

export async function startStream(
  window: BrowserWindow,
  requestId: string,
  prompt: string,
  options: SendOptions = {},
): Promise<void> {
  const binary = await resolveBinary()
  const send = (payload: ClaudeStreamPayload) => {
    if (window.isDestroyed()) return
    window.webContents.send('claude:stream-event', { requestId, payload })
  }

  if (!binary) {
    send({ type: 'error', message: 'claude CLI not found' })
    send({ type: 'closed' })
    return
  }

  const args = buildClaudeArgs(prompt, options, 'stream-json')
  const childEnv: NodeJS.ProcessEnv = { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' }
  const startedAt = Date.now()

  const child = spawn(binary, args, {
    env: childEnv,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  activeStreams.set(requestId, child)

  // Per-message block scratch so we can interpret deltas without the renderer
  // needing to know the wire format. Index → block descriptor.
  let currentMessageId: string | null = null
  const blockScratch = new Map<number, { kind: string; jsonBuf: string }>()

  // Aggregate model+cost from `assistant` snapshot events; final `result` event
  // has the totals we forward in the `result` payload.
  let stderr = ''

  const handleEvent = (evt: any) => {
    if (!evt || typeof evt !== 'object') return
    switch (evt.type) {
      case 'system': {
        if (evt.subtype === 'init' && typeof evt.session_id === 'string') {
          send({ type: 'session_init', sessionId: evt.session_id, model: evt.model ?? null })
        }
        return
      }

      case 'stream_event': {
        const e = evt.event
        if (!e) return
        switch (e.type) {
          case 'message_start': {
            currentMessageId = e.message?.id ?? `msg_${Date.now()}`
            blockScratch.clear()
            send({ type: 'message_start', messageId: currentMessageId! })
            return
          }
          case 'content_block_start': {
            if (currentMessageId == null) return
            const idx: number = e.index
            const cb = e.content_block ?? {}
            blockScratch.set(idx, { kind: cb.type, jsonBuf: '' })
            let block: ClaudeStreamPayload extends infer _ ? any : any
            if (cb.type === 'text') {
              block = { kind: 'text' }
            } else if (cb.type === 'thinking') {
              block = { kind: 'thinking' }
            } else if (cb.type === 'tool_use') {
              block = { kind: 'tool_use', id: cb.id, name: cb.name, input: cb.input ?? {} }
            } else {
              block = { kind: 'unknown', raw: cb }
            }
            send({ type: 'block_open', messageId: currentMessageId, index: idx, block })
            return
          }
          case 'content_block_delta': {
            if (currentMessageId == null) return
            const idx: number = e.index
            const d = e.delta
            if (!d) return
            if (d.type === 'text_delta' && typeof d.text === 'string') {
              send({ type: 'text_delta', messageId: currentMessageId, index: idx, text: d.text })
            } else if (d.type === 'input_json_delta' && typeof d.partial_json === 'string') {
              const scratch = blockScratch.get(idx)
              if (scratch) scratch.jsonBuf += d.partial_json
              send({
                type: 'tool_input_delta',
                messageId: currentMessageId,
                index: idx,
                partialJson: d.partial_json,
              })
            } else if (d.type === 'thinking_delta' && typeof d.thinking === 'string') {
              send({ type: 'thinking_delta', messageId: currentMessageId, index: idx, text: d.thinking })
            }
            // signature_delta (thinking) intentionally ignored.
            return
          }
          case 'content_block_stop': {
            if (currentMessageId == null) return
            const idx: number = e.index
            const scratch = blockScratch.get(idx)
            let finalInput: any = undefined
            if (scratch && scratch.kind === 'tool_use' && scratch.jsonBuf) {
              try { finalInput = JSON.parse(scratch.jsonBuf) } catch { /* leave undefined */ }
            }
            send({ type: 'block_close', messageId: currentMessageId, index: idx, finalInput })
            return
          }
          case 'message_stop': {
            if (currentMessageId == null) return
            send({ type: 'message_stop', messageId: currentMessageId })
            return
          }
          // message_delta etc. ignored — `result` event has authoritative totals.
        }
        return
      }

      case 'user': {
        // Tool results come in here; one user event can carry multiple.
        const content = evt.message?.content
        if (!Array.isArray(content)) return
        for (const part of content) {
          if (part?.type !== 'tool_result') continue
          const text = Array.isArray(part.content)
            ? part.content
                .map((c: any) => (typeof c?.text === 'string' ? c.text : ''))
                .filter(Boolean)
                .join('\n')
            : typeof part.content === 'string'
              ? part.content
              : ''
          send({
            type: 'tool_result',
            toolUseId: part.tool_use_id,
            text,
            isError: !!part.is_error,
          })
        }
        return
      }

      case 'result': {
        let primaryModel: string | null = evt.model ?? null
        let inTok = 0
        let outTok = 0
        if (evt.modelUsage && typeof evt.modelUsage === 'object') {
          let bestOut = -1
          for (const [name, usage] of Object.entries<any>(evt.modelUsage)) {
            inTok += usage?.inputTokens ?? 0
            outTok += usage?.outputTokens ?? 0
            if ((usage?.outputTokens ?? 0) > bestOut) {
              bestOut = usage?.outputTokens ?? 0
              primaryModel = name
            }
          }
        }
        send({
          type: 'result',
          sessionId: evt.session_id ?? null,
          durationMs: typeof evt.duration_ms === 'number' ? evt.duration_ms : Date.now() - startedAt,
          model: primaryModel,
          costUsd: typeof evt.total_cost_usd === 'number' ? evt.total_cost_usd : null,
          inputTokens: inTok || null,
          outputTokens: outTok || null,
        })
        return
      }

      // assistant snapshot, rate_limit_event, etc. — already covered by stream_event deltas.
    }
  }

  let buf = ''
  child.stdout.setEncoding('utf8')
  child.stdout.on('data', chunk => {
    buf += chunk
    let nl: number
    while ((nl = buf.indexOf('\n')) !== -1) {
      const line = buf.slice(0, nl).trim()
      buf = buf.slice(nl + 1)
      if (!line) continue
      try {
        handleEvent(JSON.parse(line))
      } catch {
        // ignore malformed line
      }
    }
  })
  child.stderr.on('data', d => { stderr += d.toString() })

  child.on('error', err => {
    send({ type: 'error', message: err.message })
    send({ type: 'closed' })
    activeStreams.delete(requestId)
  })

  child.on('close', code => {
    if (code !== 0 && code !== null) {
      send({ type: 'error', message: stderr.trim() || `claude exited with code ${code}` })
    }
    send({ type: 'closed' })
    activeStreams.delete(requestId)
  })
}

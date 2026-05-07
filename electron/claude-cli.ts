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

export async function sendMessage(prompt: string, options: SendOptions = {}): Promise<SendResult> {
  const binary = await resolveBinary()
  if (!binary) throw new Error('claude CLI not found')

  const args = ['-p', prompt, '--output-format', 'json']
  if (options.sessionId) args.push('--resume', options.sessionId)
  if (options.model) args.push('--model', options.model)

  const startedAt = Date.now()

  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, {
      env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
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

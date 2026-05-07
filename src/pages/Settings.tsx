import { useEffect, useState } from 'react'
import {
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  ExternalLink,
  LogOut,
  Cpu,
} from 'lucide-react'
import type { ClaudeLoginEvent, ClaudeStatus } from '@/types'
import { CLAUDE_MODELS, loadModel, saveModel } from '@/lib/claudeModels'

type LoginPhase = 'idle' | 'starting' | 'awaiting-browser' | 'needs-terminal' | 'polling'

export function Settings() {
  const [status, setStatus] = useState<ClaudeStatus | null>(null)
  const [model, setModel] = useState<string>(() => loadModel())
  const [phase, setPhase] = useState<LoginPhase>('idle')
  const [oauthUrl, setOauthUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [signingOut, setSigningOut] = useState(false)

  const refresh = async () => {
    const next = await window.claude.getStatus()
    setStatus(next)
  }

  useEffect(() => { refresh() }, [])

  useEffect(() => {
    const off = window.claude.onLoginEvent((evt: ClaudeLoginEvent) => {
      switch (evt.kind) {
        case 'url':
          setOauthUrl(evt.url)
          setPhase('polling')
          break
        case 'needs-terminal':
          setPhase('needs-terminal')
          break
        case 'success':
          setPhase('idle')
          setError(null)
          setOauthUrl(null)
          refresh()
          break
        case 'cancelled':
          setPhase('idle')
          setOauthUrl(null)
          break
        case 'timeout':
          setPhase('idle')
          setOauthUrl(null)
          setError('Sign-in timed out. Try again.')
          break
        case 'error':
          setPhase('idle')
          setOauthUrl(null)
          setError(evt.message)
          break
      }
    })
    return off
  }, [])

  const startLogin = async () => {
    setError(null)
    setOauthUrl(null)
    setPhase('starting')
    try {
      await window.claude.startLogin()
      setPhase(prev => (prev === 'starting' ? 'awaiting-browser' : prev))
    } catch (err: any) {
      setPhase('idle')
      setError(err?.message ?? 'Failed to start sign-in')
    }
  }

  const cancelLogin = async () => {
    await window.claude.cancelLogin()
    setPhase('idle')
    setOauthUrl(null)
  }

  const signOut = async () => {
    setSigningOut(true)
    try {
      await window.claude.signOut()
      await refresh()
    } finally {
      setSigningOut(false)
    }
  }

  const onModelChange = (next: string) => {
    setModel(next)
    saveModel(next)
  }

  const authed = !!status?.authenticated
  const installed = !!status?.installed
  const busy = phase !== 'idle'

  return (
    <div className="settings-page">
      <header className="settings-header">
        <h1>Settings</h1>
        <p>Manage your Claude account and chat preferences.</p>
      </header>

      <section className="settings-section">
        <div className="settings-section-head">
          <Sparkles size={18} />
          <h2>Claude account</h2>
        </div>

        <div className="settings-card">
          {!status ? (
            <div className="settings-row">
              <Loader2 className="chat-spinner-sm" />
              <span>Checking…</span>
            </div>
          ) : !installed ? (
            <>
              <div className="settings-row">
                <span className={`settings-badge settings-badge-warn`}>
                  <AlertCircle size={12} /> CLI not found
                </span>
              </div>
              <p className="settings-help">
                Install the Claude Code CLI to enable chat:
              </p>
              <pre className="chat-code-block">npm install -g @anthropic-ai/claude-code</pre>
              <div className="settings-actions">
                <button className="chat-secondary-btn" onClick={refresh} type="button">
                  <RefreshCw size={14} /> Recheck
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="settings-row">
                {authed ? (
                  <span className="settings-badge settings-badge-ok">
                    <CheckCircle2 size={12} /> Authenticated
                  </span>
                ) : (
                  <span className="settings-badge settings-badge-warn">
                    <AlertCircle size={12} /> Not signed in
                  </span>
                )}
                {status.version && (
                  <span className="settings-meta-pill">{status.version}</span>
                )}
              </div>

              {status.binaryPath && (
                <dl className="settings-defs">
                  <div>
                    <dt>Binary</dt>
                    <dd className="settings-mono">{status.binaryPath}</dd>
                  </div>
                  <div>
                    <dt>Credential store</dt>
                    <dd className="settings-mono"><DarwinHint /></dd>
                  </div>
                </dl>
              )}

              {phase === 'idle' && (
                <div className="settings-actions">
                  {!authed && (
                    <button className="chat-primary-btn" onClick={startLogin} type="button">
                      Sign in with Claude
                    </button>
                  )}
                  {authed && (
                    <button
                      className="chat-secondary-btn"
                      onClick={signOut}
                      type="button"
                      disabled={signingOut}
                    >
                      <LogOut size={14} /> {signingOut ? 'Signing out…' : 'Sign out'}
                    </button>
                  )}
                  <button className="chat-secondary-btn" onClick={refresh} type="button">
                    <RefreshCw size={14} /> Recheck
                  </button>
                </div>
              )}

              {phase === 'starting' && (
                <div className="chat-login-status"><Loader2 className="chat-spinner-sm" /> Starting sign-in…</div>
              )}
              {phase === 'awaiting-browser' && (
                <div className="chat-login-status"><Loader2 className="chat-spinner-sm" /> Waiting for the OAuth URL…</div>
              )}
              {phase === 'polling' && (
                <div className="chat-login-status">
                  <Loader2 className="chat-spinner-sm" /> Browser opened — waiting for sign-in to complete…
                  {oauthUrl && (
                    <a className="chat-link" href={oauthUrl} target="_blank" rel="noreferrer">
                      <ExternalLink size={12} /> Reopen sign-in URL
                    </a>
                  )}
                </div>
              )}
              {phase === 'needs-terminal' && (
                <div className="chat-login-status">
                  <p>Couldn't capture the OAuth URL automatically. Run this in your terminal:</p>
                  <pre className="chat-code-block">claude /login</pre>
                  <p>Then click Recheck.</p>
                </div>
              )}
              {busy && (
                <div className="settings-actions">
                  <button className="chat-secondary-btn" onClick={refresh} type="button">
                    <RefreshCw size={14} /> Recheck
                  </button>
                  <button className="chat-secondary-btn" onClick={cancelLogin} type="button">
                    Cancel
                  </button>
                </div>
              )}

              {error && <div className="chat-login-error">{error}</div>}
            </>
          )}
        </div>
      </section>

      <section className="settings-section">
        <div className="settings-section-head">
          <Cpu size={18} />
          <h2>Default model</h2>
        </div>
        <div className="settings-card">
          <p className="settings-help">
            Choose which Claude model handles your prompts. Saved locally; takes effect on the next message.
          </p>
          <div className="settings-radio-grid">
            {CLAUDE_MODELS.map(m => (
              <label
                key={m.id}
                className={`settings-radio ${model === m.id ? 'is-active' : ''}`}
              >
                <input
                  type="radio"
                  name="claude-model"
                  value={m.id}
                  checked={model === m.id}
                  onChange={() => onModelChange(m.id)}
                />
                <div className="settings-radio-body">
                  <div className="settings-radio-label">{m.label}</div>
                  <div className="settings-radio-desc">{m.description}</div>
                </div>
              </label>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}

function DarwinHint() {
  // navigator.platform is deprecated but still usable as a hint in renderer.
  const isMac = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform)
  return <>{isMac ? 'macOS keychain · "Claude Code-credentials"' : '~/.claude/.credentials.json'}</>
}

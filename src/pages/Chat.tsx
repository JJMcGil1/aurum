import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import {
  ArrowUp,
  Sparkles,
  AlertCircle,
  Loader2,
  ExternalLink,
  RefreshCw,
} from 'lucide-react'
import type { ClaudeLoginEvent, ClaudeStatus } from '@/types'
import { loadModel, modelArg, prettyModelId, saveModel } from '@/lib/claudeModels'
import { ChatModelPicker } from '@/components/ChatModelPicker'

type Role = 'user' | 'assistant'

interface ReplyMeta {
  model: string | null
  durationMs: number
  inputTokens: number | null
  outputTokens: number | null
  costUsd: number | null
}

interface Message {
  id: string
  role: Role
  content: string
  createdAt: number
  error?: boolean
  meta?: ReplyMeta
}

const SUGGESTIONS = [
  'How much did we spend on groceries last month?',
  'Show me a breakdown of subscriptions',
  'Which family member spent the most this week?',
  'Forecast next month based on current trends',
]

type LoginPhase = 'idle' | 'starting' | 'awaiting-browser' | 'needs-terminal' | 'polling'

export function Chat() {
  const [status, setStatus] = useState<ClaudeStatus | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [draft, setDraft] = useState('')
  const [isThinking, setIsThinking] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [loginPhase, setLoginPhase] = useState<LoginPhase>('idle')
  const [loginError, setLoginError] = useState<string | null>(null)
  const [oauthUrl, setOauthUrl] = useState<string | null>(null)
  const [model, setModel] = useState<string>(() => loadModel())
  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const refreshStatus = async () => {
    const next = await window.claude.getStatus()
    setStatus(next)
    return next
  }

  useEffect(() => {
    refreshStatus()
    const onFocus = () => { refreshStatus() }
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'aurum.claudeModel' && e.newValue) setModel(e.newValue)
    }
    window.addEventListener('focus', onFocus)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  useEffect(() => {
    const off = window.claude.onLoginEvent((evt: ClaudeLoginEvent) => {
      switch (evt.kind) {
        case 'url':
          setOauthUrl(evt.url)
          setLoginPhase('polling')
          break
        case 'needs-terminal':
          setLoginPhase('needs-terminal')
          break
        case 'success':
          setLoginPhase('idle')
          setLoginError(null)
          setOauthUrl(null)
          refreshStatus()
          break
        case 'cancelled':
          setLoginPhase('idle')
          setOauthUrl(null)
          break
        case 'timeout':
          setLoginPhase('idle')
          setOauthUrl(null)
          setLoginError('Sign-in timed out. Try again.')
          break
        case 'error':
          setLoginPhase('idle')
          setOauthUrl(null)
          setLoginError(evt.message)
          break
      }
    })
    return off
  }, [])

  useEffect(() => {
    if (!scrollRef.current) return
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages, isThinking])

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }, [draft])

  const startLogin = async () => {
    setLoginError(null)
    setOauthUrl(null)
    setLoginPhase('starting')
    try {
      await window.claude.startLogin()
      setLoginPhase(prev => (prev === 'starting' ? 'awaiting-browser' : prev))
    } catch (err: any) {
      setLoginPhase('idle')
      setLoginError(err?.message ?? 'Failed to start sign-in')
    }
  }

  const cancelLogin = async () => {
    await window.claude.cancelLogin()
    setLoginPhase('idle')
    setOauthUrl(null)
  }

  const onModelChange = (id: string) => {
    setModel(id)
    saveModel(id)
  }

  const send = async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || isThinking) return
    if (!status?.authenticated) return

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: trimmed,
      createdAt: Date.now(),
    }
    setMessages(prev => [...prev, userMsg])
    setDraft('')
    setIsThinking(true)

    try {
      const reply = await window.claude.sendMessage(trimmed, {
        sessionId,
        model: modelArg(model),
      })
      if (reply.sessionId) setSessionId(reply.sessionId)
      const replyMsg: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: reply.text || '(empty response)',
        createdAt: Date.now(),
        meta: {
          model: reply.model,
          durationMs: reply.durationMs,
          inputTokens: reply.inputTokens,
          outputTokens: reply.outputTokens,
          costUsd: reply.costUsd,
        },
      }
      setMessages(prev => [...prev, replyMsg])
    } catch (err: any) {
      const replyMsg: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: err?.message ?? 'Failed to reach Claude',
        createdAt: Date.now(),
        error: true,
      }
      setMessages(prev => [...prev, replyMsg])
    } finally {
      setIsThinking(false)
    }
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    send(draft)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send(draft)
    }
  }

  const isEmpty = messages.length === 0
  const authed = !!status?.authenticated
  const installed = !!status?.installed

  return (
    <div className="chat-page">
      <div className="chat-scroll" ref={scrollRef}>
        {!status ? (
          <div className="chat-empty">
            <Loader2 className="chat-spinner" />
          </div>
        ) : !authed ? (
          <ConnectPanel
            installed={installed}
            phase={loginPhase}
            error={loginError}
            oauthUrl={oauthUrl}
            onConnect={startLogin}
            onCancel={cancelLogin}
            onRecheck={refreshStatus}
          />
        ) : isEmpty ? (
          <div className="chat-empty">
            <div className="chat-empty-icon">
              <Sparkles />
            </div>
            <h2 className="chat-empty-title">Ask Aurum anything</h2>
            <p className="chat-empty-subtitle">
              Get insights about spending, budgets, and family finances.
            </p>
            <div className="chat-suggestions">
              {SUGGESTIONS.map(s => (
                <button
                  key={s}
                  className="chat-suggestion"
                  onClick={() => send(s)}
                  type="button"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="chat-thread">
            {messages.map(m => (
              <div key={m.id} className={`chat-message chat-message-${m.role}`}>
                <div className={`chat-bubble${m.error ? ' chat-bubble-error' : ''}`}>{m.content}</div>
                {m.role === 'assistant' && m.meta && <ReplyMetaLine meta={m.meta} />}
              </div>
            ))}
            {isThinking && (
              <div className="chat-message chat-message-assistant">
                <div className="chat-bubble chat-typing">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <form className="chat-composer" onSubmit={handleSubmit}>
        <div className="chat-composer-card">
          <div className="chat-composer-inner">
            <textarea
              ref={textareaRef}
              className="chat-input"
              placeholder={authed ? 'Message Aurum...' : 'Connect Claude to start chatting'}
              rows={1}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={!authed}
            />
          </div>
          <div className="chat-composer-toolbar">
            <ChatModelPicker
              model={model}
              onChange={onModelChange}
              cliVersion={status?.version ?? null}
              connected={authed}
              disabled={!authed}
            />
            <button
              type="submit"
              className="chat-send"
              disabled={!authed || !draft.trim() || isThinking}
              aria-label="Send message"
            >
              <ArrowUp strokeWidth={2.5} />
            </button>
          </div>
        </div>
        <p className="chat-hint">
          {authed
            ? 'Press Enter to send, Shift+Enter for newline'
            : 'Sign in with your Claude account to send prompts'}
        </p>
      </form>
    </div>
  )
}

function ReplyMetaLine({ meta }: { meta: ReplyMeta }) {
  const parts: string[] = []
  if (meta.model) parts.push(prettyModelId(meta.model))
  if (meta.outputTokens != null && meta.inputTokens != null) {
    parts.push(`${meta.inputTokens.toLocaleString()} in · ${meta.outputTokens.toLocaleString()} out`)
  }
  if (meta.durationMs) parts.push(`${(meta.durationMs / 1000).toFixed(1)}s`)
  if (meta.costUsd != null) parts.push(`$${meta.costUsd.toFixed(4)}`)
  if (parts.length === 0) return null
  return <div className="chat-reply-meta">{parts.join(' · ')}</div>
}

interface ConnectPanelProps {
  installed: boolean
  phase: LoginPhase
  error: string | null
  oauthUrl: string | null
  onConnect: () => void
  onCancel: () => void
  onRecheck: () => void
}

function ConnectPanel({ installed, phase, error, oauthUrl, onConnect, onCancel, onRecheck }: ConnectPanelProps) {
  if (!installed) {
    return (
      <div className="chat-empty">
        <div className="chat-empty-icon">
          <AlertCircle />
        </div>
        <h2 className="chat-empty-title">Claude CLI not found</h2>
        <p className="chat-empty-subtitle">
          Install the Claude Code CLI, then come back.
        </p>
        <pre className="chat-code-block">npm install -g @anthropic-ai/claude-code</pre>
        <button className="chat-primary-btn" onClick={onRecheck} type="button">
          <RefreshCw size={14} /> Recheck
        </button>
      </div>
    )
  }

  return (
    <div className="chat-empty">
      <div className="chat-empty-icon">
        <Sparkles />
      </div>
      <h2 className="chat-empty-title">Connect your Claude account</h2>
      <p className="chat-empty-subtitle">
        Aurum uses your Claude Code login — your credentials stay in your CLI's keychain.
      </p>

      {phase === 'idle' && (
        <button className="chat-primary-btn" onClick={onConnect} type="button">
          Sign in with Claude
        </button>
      )}

      {phase === 'starting' && (
        <div className="chat-login-status">
          <Loader2 className="chat-spinner-sm" /> Starting sign-in…
        </div>
      )}

      {phase === 'awaiting-browser' && (
        <div className="chat-login-status">
          <Loader2 className="chat-spinner-sm" /> Waiting for the OAuth URL…
        </div>
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
          <p>Then click Recheck below.</p>
        </div>
      )}

      {(phase === 'polling' || phase === 'awaiting-browser' || phase === 'needs-terminal') && (
        <div className="chat-login-actions">
          <button className="chat-secondary-btn" onClick={onRecheck} type="button">
            <RefreshCw size={14} /> Recheck
          </button>
          <button className="chat-secondary-btn" onClick={onCancel} type="button">
            Cancel
          </button>
        </div>
      )}

      {error && <div className="chat-login-error">{error}</div>}
    </div>
  )
}

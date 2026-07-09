import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import {
  ArrowUp,
  Sparkles,
  AlertCircle,
  Loader2,
  ExternalLink,
  RefreshCw,
  Brain,
  ChevronDown,
} from 'lucide-react'
import type {
  ChatMessageRow,
  ChatThreadSummary,
  ClaudeLoginEvent,
  ClaudeStatus,
  ClaudeStreamPayload,
  FamilyMember,
} from '@/types'
import { loadModel, modelArg, prettyModelId, saveModel } from '@/lib/claudeModels'
import { ChatModelPicker } from '@/components/ChatModelPicker'
import { ChatToolsPicker } from '@/components/ChatToolsPicker'
import { ChatThreadHeader } from '@/components/ChatThreadHeader'
import { ToolCallCard, type ToolCall } from '@/components/chat/ToolCallCard'
import { MarkdownText } from '@/components/chat/MarkdownText'
import { initials } from '@/components/chat/tools/format'
import { AurumLogo } from '@/components/AurumLogo'

const ACTIVE_THREAD_KEY = 'aurum.activeChatThreadId'

interface ReplyMeta {
  model: string | null
  durationMs: number
  inputTokens: number | null
  outputTokens: number | null
  costUsd: number | null
}

type Block =
  | { kind: 'text'; text: string }
  | { kind: 'thinking'; text: string; done: boolean }
  | { kind: 'tool'; tool: ToolCall }

type TurnStatus = 'streaming' | 'done' | 'error'

interface Turn {
  id: string
  role: 'user' | 'assistant'
  blocks: Block[]
  meta?: ReplyMeta
  status: TurnStatus
  error?: string
  createdAt: number
}

const SUGGESTIONS = [
  'Who is in my family?',
  'What expenses do I have this month?',
  'Show me a breakdown of who paid the most',
  'What were our biggest expenses?',
]

type LoginPhase = 'idle' | 'starting' | 'awaiting-browser' | 'needs-terminal' | 'polling'

export function Chat({ onClose }: { onClose?: () => void } = {}) {
  const [status, setStatus] = useState<ClaudeStatus | null>(null)
  const [turns, setTurns] = useState<Turn[]>([])
  const [draft, setDraft] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [loginPhase, setLoginPhase] = useState<LoginPhase>('idle')
  const [loginError, setLoginError] = useState<string | null>(null)
  const [oauthUrl, setOauthUrl] = useState<string | null>(null)
  const [model, setModel] = useState<string>(() => loadModel())
  const [profile, setProfile] = useState<FamilyMember | null>(null)
  const [threads, setThreads] = useState<ChatThreadSummary[]>([])
  const [activeThreadId, setActiveThreadId] = useState<string | null>(() => {
    try { return localStorage.getItem(ACTIVE_THREAD_KEY) } catch { return null }
  })
  const [activeTitle, setActiveTitle] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  // Mirror of `turns` for sync reads from event handlers — React's setState
  // updater lambdas are not guaranteed to run before the next statement, so
  // we can't rely on closure-capturing the "final" turn from inside one.
  const turnsRef = useRef<Turn[]>([])
  // Counter for chat_messages.ord — set when a thread loads, then incremented
  // monotonically as messages are persisted.
  const ordCounterRef = useRef(0)
  // We persist messages by id (stable per Turn), so this maps Turn.id → ord
  // to keep updates idempotent across stream restarts.
  const persistedOrdRef = useRef<Map<string, number>>(new Map())

  // Stream-correlation state. Refs because we mutate per-event without
  // wanting to re-render and we need stable lookups across rapid deltas.
  const activeRequestIdRef = useRef<string | null>(null)
  const activeTurnIdRef = useRef<string | null>(null)
  const activeThreadOnSendRef = useRef<string | null>(null)
  const indexMapRef = useRef<Map<number, number>>(new Map()) // current claude msg block index → turn.blocks index
  const toolIdMapRef = useRef<Map<string, number>>(new Map()) // tool_use id → turn.blocks index

  const refreshStatus = async () => {
    const next = await window.claude.getStatus()
    setStatus(next)
    return next
  }

  useEffect(() => {
    refreshStatus()
    const loadProfile = () => {
      window.api.getFamilyMembers().then(members => {
        const owner = members.find(m => m.role === 'Owner') ?? members[0] ?? null
        setProfile(owner)
      }).catch(() => { /* non-fatal */ })
    }
    loadProfile()
    refreshThreads()
    const onFocus = () => { refreshStatus(); loadProfile(); refreshThreads() }
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'aurum.claudeModel' && e.newValue) setModel(e.newValue)
    }
    window.addEventListener('focus', onFocus)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('storage', onStorage)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const refreshThreads = async () => {
    try {
      const list = await window.api.listChatThreads()
      setThreads(list)
    } catch { /* non-fatal */ }
  }

  // On first mount, hydrate the active thread if one is remembered.
  useEffect(() => {
    if (!activeThreadId) return
    let cancelled = false
    ;(async () => {
      const data = await window.api.getChatThread(activeThreadId).catch(() => null)
      if (cancelled) return
      if (!data) {
        // Thread was deleted out-of-band; clear the pointer.
        setActiveThreadId(null)
        try { localStorage.removeItem(ACTIVE_THREAD_KEY) } catch { /* noop */ }
        return
      }
      hydrateThread(data.thread, data.messages)
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Wire stream-event listener once. Routes events to whichever assistant
  // turn is currently active.
  useEffect(() => {
    const off = window.claude.onStreamEvent(({ requestId, payload }) => {
      if (requestId !== activeRequestIdRef.current) return
      handleStreamEvent(payload)
    })
    return off
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const updateActiveTurn = (mut: (turn: Turn) => Turn) => {
    const turnId = activeTurnIdRef.current
    if (!turnId) return
    setTurns(prev => prev.map(t => (t.id === turnId ? mut(t) : t)))
  }

  const hydrateThread = (thread: { id: string; title: string; claude_session_id: string | null; model: string | null }, messages: ChatMessageRow[]) => {
    const restored: Turn[] = messages.map(m => ({
      id: m.id,
      role: m.role,
      blocks: safeParse<Block[]>(m.blocks_json) ?? [],
      meta: m.meta_json ? safeParse<ReplyMeta>(m.meta_json) ?? undefined : undefined,
      status: (m.status as TurnStatus) ?? 'done',
      error: m.error ?? undefined,
      createdAt: m.created_at_ms,
    }))
    setTurns(restored)
    setSessionId(thread.claude_session_id)
    setActiveThreadId(thread.id)
    setActiveTitle(thread.title)
    try { localStorage.setItem(ACTIVE_THREAD_KEY, thread.id) } catch { /* noop */ }
    persistedOrdRef.current = new Map(messages.map(m => [m.id, m.ord]))
    ordCounterRef.current = messages.length > 0 ? Math.max(...messages.map(m => m.ord)) + 1 : 0
    setLoginError(null)
  }

  const persistTurn = (threadId: string, turn: Turn) => {
    const existingOrd = persistedOrdRef.current.get(turn.id)
    const ord = existingOrd ?? ordCounterRef.current++
    persistedOrdRef.current.set(turn.id, ord)
    const payload: ChatMessageRow = {
      id: turn.id,
      thread_id: threadId,
      role: turn.role,
      status: turn.status,
      blocks_json: JSON.stringify(turn.blocks),
      meta_json: turn.meta ? JSON.stringify(turn.meta) : null,
      error: turn.error ?? null,
      created_at_ms: turn.createdAt,
      ord,
    }
    window.api.saveChatMessage(payload).catch(err => {
      console.warn('saveChatMessage failed', err)
    })
  }

  const handleNewChat = () => {
    if (streaming) return
    setTurns([])
    setSessionId(null)
    setActiveThreadId(null)
    setActiveTitle(null)
    persistedOrdRef.current = new Map()
    ordCounterRef.current = 0
    try { localStorage.removeItem(ACTIVE_THREAD_KEY) } catch { /* noop */ }
  }

  const handleSelectThread = async (id: string) => {
    if (streaming) return
    if (id === activeThreadId) return
    const data = await window.api.getChatThread(id).catch(() => null)
    if (!data) return
    hydrateThread(data.thread, data.messages)
  }

  const handleDeleteThread = async (id: string) => {
    await window.api.deleteChatThread(id).catch(() => { /* noop */ })
    if (id === activeThreadId) handleNewChat()
    refreshThreads()
  }

  const handleStreamEvent = (payload: ClaudeStreamPayload) => {
    switch (payload.type) {
      case 'session_init':
        setSessionId(payload.sessionId)
        return

      case 'message_start':
        // New claude message in this same request — reset block index map.
        indexMapRef.current = new Map()
        return

      case 'block_open': {
        const { index, block } = payload
        if (block.kind === 'unknown') return
        updateActiveTurn(turn => {
          const blocks = [...turn.blocks]
          if (block.kind === 'text') {
            blocks.push({ kind: 'text', text: '' })
          } else if (block.kind === 'thinking') {
            blocks.push({ kind: 'thinking', text: '', done: false })
          } else if (block.kind === 'tool_use') {
            const tool: ToolCall = {
              id: block.id,
              name: block.name,
              input: block.input ?? {},
              status: 'running',
            }
            blocks.push({ kind: 'tool', tool })
            toolIdMapRef.current.set(block.id, blocks.length - 1)
          }
          indexMapRef.current.set(index, blocks.length - 1)
          return { ...turn, blocks }
        })
        return
      }

      case 'text_delta': {
        const blockIdx = indexMapRef.current.get(payload.index)
        if (blockIdx == null) return
        updateActiveTurn(turn => {
          const blocks = turn.blocks.slice()
          const b = blocks[blockIdx]
          if (b?.kind === 'text') {
            blocks[blockIdx] = { kind: 'text', text: b.text + payload.text }
          }
          return { ...turn, blocks }
        })
        return
      }

      case 'thinking_delta': {
        const blockIdx = indexMapRef.current.get(payload.index)
        if (blockIdx == null) return
        updateActiveTurn(turn => {
          const blocks = turn.blocks.slice()
          const b = blocks[blockIdx]
          if (b?.kind === 'thinking') {
            blocks[blockIdx] = { kind: 'thinking', text: b.text + payload.text, done: false }
          }
          return { ...turn, blocks }
        })
        return
      }

      case 'tool_input_delta':
        // Visible "live args" not implemented — final input arrives on block_close.
        return

      case 'block_close': {
        const blockIdx = indexMapRef.current.get(payload.index)
        if (blockIdx == null) return
        updateActiveTurn(turn => {
          const blocks = turn.blocks.slice()
          const b = blocks[blockIdx]
          if (b?.kind === 'tool' && payload.finalInput != null) {
            blocks[blockIdx] = { kind: 'tool', tool: { ...b.tool, input: payload.finalInput } }
          } else if (b?.kind === 'thinking') {
            blocks[blockIdx] = { kind: 'thinking', text: b.text, done: true }
          }
          return { ...turn, blocks }
        })
        return
      }

      case 'message_stop':
        return

      case 'tool_result': {
        const blockIdx = toolIdMapRef.current.get(payload.toolUseId)
        if (blockIdx == null) return
        let resultJson: any = undefined
        try { resultJson = JSON.parse(payload.text) } catch { /* leave undefined */ }
        updateActiveTurn(turn => {
          const blocks = turn.blocks.slice()
          const b = blocks[blockIdx]
          if (b?.kind === 'tool') {
            blocks[blockIdx] = {
              kind: 'tool',
              tool: {
                ...b.tool,
                status: payload.isError ? 'error' : 'done',
                resultText: payload.text,
                resultJson,
              },
            }
          }
          return { ...turn, blocks }
        })
        return
      }

      case 'result': {
        if (payload.sessionId) {
          setSessionId(payload.sessionId)
          const tid = activeThreadOnSendRef.current
          if (tid) {
            window.api.updateChatThread(tid, { claude_session_id: payload.sessionId })
              .catch(() => { /* noop */ })
          }
        }
        updateActiveTurn(turn => ({
          ...turn,
          status: 'done',
          meta: {
            model: payload.model,
            durationMs: payload.durationMs,
            inputTokens: payload.inputTokens,
            outputTokens: payload.outputTokens,
            costUsd: payload.costUsd,
          },
        }))
        return
      }

      case 'error':
        updateActiveTurn(turn => ({
          ...turn,
          status: 'error',
          error: payload.message,
        }))
        return

      case 'closed': {
        const turnId = activeTurnIdRef.current
        const tid = activeThreadOnSendRef.current
        // Read latest turn from the ref (mirrors `turns` after each render).
        // Apply final-state transforms here so persistence sees the same
        // value React renders, instead of relying on a setState updater
        // that may not have run synchronously.
        const current = turnId
          ? turnsRef.current.find(t => t.id === turnId)
          : undefined
        if (current) {
          const blocks = current.blocks.map(b => {
            if (b.kind === 'tool' && b.tool.status === 'running') {
              return {
                kind: 'tool' as const,
                tool: { ...b.tool, status: 'error' as const, resultText: 'No result returned' },
              }
            }
            if (b.kind === 'thinking' && !b.done) {
              return { kind: 'thinking' as const, text: b.text, done: true }
            }
            return b
          })
          const newStatus: TurnStatus = current.status === 'streaming' ? 'done' : current.status
          const finalTurn: Turn = { ...current, blocks, status: newStatus }
          setTurns(prev => prev.map(t => t.id === turnId ? finalTurn : t))
          turnsRef.current = turnsRef.current.map(t => t.id === turnId ? finalTurn : t)
          if (tid) {
            persistTurn(tid, finalTurn)
            refreshThreads()
          }
        }
        activeRequestIdRef.current = null
        activeTurnIdRef.current = null
        activeThreadOnSendRef.current = null
        indexMapRef.current.clear()
        toolIdMapRef.current.clear()
        setStreaming(false)
        return
      }
    }
  }

  useEffect(() => {
    turnsRef.current = turns
    if (!scrollRef.current) return
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [turns])

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
    if (!trimmed || streaming) return
    if (!status?.authenticated) return

    const now = Date.now()
    const userTurn: Turn = {
      id: crypto.randomUUID(),
      role: 'user',
      blocks: [{ kind: 'text', text: trimmed }],
      status: 'done',
      createdAt: now,
    }
    const assistantTurn: Turn = {
      id: crypto.randomUUID(),
      role: 'assistant',
      blocks: [],
      status: 'streaming',
      createdAt: now,
    }
    setTurns(prev => [...prev, userTurn, assistantTurn])
    setDraft('')
    setStreaming(true)

    // Ensure we have a thread to write into. If this is the first message
    // of a new chat, mint a thread now so the user message is persisted
    // even if the response fails.
    let threadId = activeThreadId
    if (!threadId) {
      threadId = crypto.randomUUID()
      const title = makeThreadTitle(trimmed)
      try {
        await window.api.createChatThread({ id: threadId, title, model: modelArg(model) ?? null })
        setActiveThreadId(threadId)
        setActiveTitle(title)
        try { localStorage.setItem(ACTIVE_THREAD_KEY, threadId) } catch { /* noop */ }
      } catch (err) {
        console.warn('createChatThread failed', err)
      }
    }

    if (threadId) {
      persistTurn(threadId, userTurn)
      persistTurn(threadId, assistantTurn)
      refreshThreads()
    }

    const requestId = crypto.randomUUID()
    activeRequestIdRef.current = requestId
    activeTurnIdRef.current = assistantTurn.id
    activeThreadOnSendRef.current = threadId
    indexMapRef.current = new Map()
    toolIdMapRef.current = new Map()

    try {
      await window.claude.streamMessage(requestId, trimmed, {
        sessionId,
        model: modelArg(model),
      })
    } catch (err: any) {
      updateActiveTurn(turn => ({
        ...turn,
        status: 'error',
        error: err?.message ?? 'Failed to reach Claude',
      }))
      if (threadId) {
        const failed: Turn = { ...assistantTurn, status: 'error', error: err?.message ?? 'Failed to reach Claude' }
        persistTurn(threadId, failed)
      }
      activeRequestIdRef.current = null
      activeTurnIdRef.current = null
      setStreaming(false)
    }
  }

  function makeThreadTitle(firstMessage: string): string {
    const cleaned = firstMessage.replace(/\s+/g, ' ').trim()
    if (cleaned.length <= 60) return cleaned
    return cleaned.slice(0, 57).trimEnd() + '…'
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

  const isEmpty = turns.length === 0
  const authed = !!status?.authenticated
  const installed = !!status?.installed

  return (
    <div className="chat-page">
      {authed && (
        <ChatThreadHeader
          threads={threads}
          activeThreadId={activeThreadId}
          activeTitle={activeTitle}
          streaming={streaming}
          onNewChat={handleNewChat}
          onSelectThread={handleSelectThread}
          onDeleteThread={handleDeleteThread}
          onClose={onClose}
        />
      )}
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
            {turns.map(t => (
              <TurnView key={t.id} turn={t} profile={profile} />
            ))}
            {streaming && <StreamingStatus turns={turns} />}
          </div>
        )}
      </div>

      <form className="chat-composer" onSubmit={handleSubmit}>
        <div className={`chat-composer-card${streaming ? ' is-working' : ''}`}>
          <div className="chat-composer-inner">
            <textarea
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
            <div className="chat-composer-tools-left">
              <ChatToolsPicker disabled={!authed} />
              <ChatModelPicker
                model={model}
                onChange={onModelChange}
                cliVersion={status?.version ?? null}
                connected={authed}
                disabled={!authed}
              />
            </div>
            <button
              type="submit"
              className="chat-send"
              disabled={!authed || !draft.trim() || streaming}
              aria-label="Send message"
            >
              <ArrowUp strokeWidth={2.5} />
            </button>
          </div>
        </div>
        {!authed && (
          <p className="chat-hint">Sign in with your Claude account to send prompts</p>
        )}
      </form>
    </div>
  )
}

export function ChatPage() {
  return (
    <div className="chat-fullscreen">
      <div className="chat-fullscreen-inner">
        <Chat />
      </div>
    </div>
  )
}

function safeParse<T>(raw: string): T | null {
  try { return JSON.parse(raw) as T } catch { return null }
}

function formatChatTime(ts: number): string {
  const d = new Date(ts)
  const now = new Date()
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  if (sameDay) return time
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
  if (
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate()
  ) {
    return `Yesterday ${time}`
  }
  return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${time}`
}

function UserAvatar({ profile }: { profile: FamilyMember | null }) {
  if (profile?.avatar_image) {
    return (
      <div className="chat-user-avatar">
        <img src={`local-file://${profile.avatar_image}`} alt={profile.name} />
      </div>
    )
  }
  const name = profile ? `${profile.first_name} ${profile.last_name}`.trim() : ''
  return (
    <div
      className="chat-user-avatar chat-user-avatar-fallback"
      style={profile ? { background: profile.avatar_color } : undefined}
    >
      {name ? initials(name) : '·'}
    </div>
  )
}

function TurnView({ turn, profile }: { turn: Turn; profile: FamilyMember | null }) {
  if (turn.role === 'user') {
    const firstText = turn.blocks.find(b => b.kind === 'text') as { kind: 'text'; text: string } | undefined
    const text = firstText?.text ?? ''
    return (
      <div className="chat-message chat-message-user">
        <div className="chat-user-stack">
          <div className="chat-user-header">
            <div className="chat-user-meta">{formatChatTime(turn.createdAt)}</div>
            <span className="chat-author-name">You</span>
            <UserAvatar profile={profile} />
          </div>
          <div className="chat-bubble">{text}</div>
        </div>
      </div>
    )
  }

  const showCursor = turn.status === 'streaming'
  const lastBlockIdx = turn.blocks.length - 1

  return (
    <div className="chat-message chat-message-assistant">
      <div className="chat-assistant-header">
        <div className="chat-assistant-avatar">
          <AurumLogo iconOnly />
        </div>
        <span className="chat-author-name">Aurum</span>
        <span className="chat-user-meta">{formatChatTime(turn.createdAt)}</span>
      </div>
      {turn.error && (
        <div className="chat-bubble chat-bubble-error">{turn.error}</div>
      )}
      {turn.blocks.map((b, i) => {
        if (b.kind === 'tool') {
          return <ToolCallCard key={`${turn.id}-${i}`} tool={b.tool} />
        }
        if (b.kind === 'thinking') {
          return <ThinkingCard key={`${turn.id}-${i}`} text={b.text} done={b.done} />
        }
        const isLast = i === lastBlockIdx
        return (
          <div key={`${turn.id}-${i}`} className="chat-bubble chat-bubble-text">
            <MarkdownText text={b.text} />
            {showCursor && isLast && b.text.length > 0 && <span className="chat-caret" />}
          </div>
        )
      })}
      {turn.status === 'done' && turn.meta && <ReplyMetaLine meta={turn.meta} />}
    </div>
  )
}

function StreamingStatus({ turns }: { turns: Turn[] }) {
  const last = turns[turns.length - 1]
  if (!last || last.role !== 'assistant' || last.status !== 'streaming') {
    return (
      <div className="chat-message chat-message-assistant">
        <div className="chat-bubble chat-typing">
          <span></span><span></span><span></span>
        </div>
      </div>
    )
  }

  const blocks = last.blocks
  const lastBlock = blocks[blocks.length - 1]

  // If the last block is text and has content, the model is generating
  // visible output — the caret on the bubble already conveys that.
  if (lastBlock?.kind === 'text' && lastBlock.text.length > 0) return null
  // Tool block in flight is shown by its own card spinner.
  if (lastBlock?.kind === 'tool' && lastBlock.tool.status === 'running') return null
  // Streaming thinking is rendered by the ThinkingCard itself.
  if (lastBlock?.kind === 'thinking' && !lastBlock.done) return null

  // Otherwise we're between blocks — show a subtle "Working" indicator so
  // the user knows the agent is doing something.
  return (
    <div className="chat-message chat-message-assistant">
      <div className="chat-status-row">
        <span className="chat-status-dot" />
        <span className="chat-status-label">Working</span>
      </div>
    </div>
  )
}

function ThinkingCard({ text, done }: { text: string; done: boolean }) {
  // Auto-expand while streaming, auto-collapse on completion. The user
  // can still override either way via the toggle; once they do, we stop
  // following the auto-state and respect their intent.
  const [open, setOpen] = useState(true)
  const userToggledRef = useRef(false)
  const prevDoneRef = useRef(done)

  useEffect(() => {
    if (userToggledRef.current) return
    if (!prevDoneRef.current && done) {
      setOpen(false)
    } else if (!done) {
      setOpen(true)
    }
    prevDoneRef.current = done
  }, [done])

  const bodyRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (open && !done && bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight
    }
  }, [text, open, done])

  const trimmed = text.trim()
  const hasText = trimmed.length > 0

  const onToggle = () => {
    userToggledRef.current = true
    setOpen(o => !o)
  }

  return (
    <div className={`thinking-card${done ? ' is-done' : ' is-active'}${open ? ' is-open' : ''}`}>
      <button
        type="button"
        className="thinking-head"
        onClick={onToggle}
        aria-expanded={open}
        disabled={!hasText && done}
      >
        <span className="thinking-icon">
          <Brain size={13} />
        </span>
        <span className="thinking-label">
          {done ? 'Thought' : 'Thinking'}
        </span>
        {!done && <span className="thinking-pulse" />}
        {(hasText || !done) && (
          <ChevronDown
            size={12}
            className="thinking-chev"
            style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
          />
        )}
      </button>
      {open && (
        <div className="thinking-body" ref={bodyRef}>
          {hasText ? trimmed : <span className="thinking-placeholder">…</span>}
          {!done && <span className="thinking-caret" />}
        </div>
      )}
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

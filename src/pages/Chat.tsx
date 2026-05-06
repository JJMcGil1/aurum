import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Send, Sparkles } from 'lucide-react'

type Role = 'user' | 'assistant'

interface Message {
  id: string
  role: Role
  content: string
  createdAt: number
}

const SUGGESTIONS = [
  'How much did we spend on groceries last month?',
  'Show me a breakdown of subscriptions',
  'Which family member spent the most this week?',
  'Forecast next month based on current trends',
]

export function Chat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [draft, setDraft] = useState('')
  const [isThinking, setIsThinking] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

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

  const send = (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || isThinking) return

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: trimmed,
      createdAt: Date.now(),
    }
    setMessages(prev => [...prev, userMsg])
    setDraft('')
    setIsThinking(true)

    // Placeholder echo until the AI backend is wired in.
    window.setTimeout(() => {
      const reply: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content:
          "I'm not connected to your data yet, but the chat surface is live. Hook me up to the finance backend and I'll start answering for real.",
        createdAt: Date.now(),
      }
      setMessages(prev => [...prev, reply])
      setIsThinking(false)
    }, 600)
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

  return (
    <div className="chat-page">
      <div className="chat-scroll" ref={scrollRef}>
        {isEmpty ? (
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
                <div className="chat-bubble">{m.content}</div>
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
        <div className="chat-composer-inner">
          <textarea
            ref={textareaRef}
            className="chat-input"
            placeholder="Message Aurum..."
            rows={1}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button
            type="submit"
            className="chat-send"
            disabled={!draft.trim() || isThinking}
            aria-label="Send message"
          >
            <Send />
          </button>
        </div>
        <p className="chat-hint">Press Enter to send, Shift+Enter for newline</p>
      </form>
    </div>
  )
}

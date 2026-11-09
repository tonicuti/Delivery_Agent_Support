import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Bot,
  Check,
  History,
  MessageSquarePlus,
  SendHorizontal,
  Square,
  Trash2,
  X,
} from 'lucide-react'
import { Button } from '@/shared/ui/button'
import { Textarea } from '@/shared/ui/textarea'
import { cn } from '@/shared/lib/utils'
import { Markdownish } from './Markdownish'
import { fmtClock, fmtTime } from './format'
import {
  readEvents,
  useChats,
  type Chat,
  type ChatMessage,
} from './chats'
import { PageHero } from '@/shared/ui/PageHero'

const SUGGESTIONS = {
  general: [
    'What needs my attention first?',
    'Which orders are most at risk right now?',
    'How are decisions going so far?',
    'What can you help me with?',
  ],
  order: [
    'Why is this order at risk?',
    'What should I do about it?',
    'Where is the shipment, and is it running late?',
    'Is this information up to date?',
  ],
} as const

const SLOW_AFTER_SECONDS = 8
const titleFrom = (text: string) =>
  text.length > 42 ? `${text.slice(0, 40).trim()}…` : text

function ChatList({
  chats,
  activeId,
  onSelect,
  onNew,
  onDelete,
}: {
  chats: Chat[]
  activeId: string | null
  onSelect: (id: string) => void
  onNew: () => void
  onDelete: (id: string) => void
}) {
  const [confirmId, setConfirmId] = useState<string | null>(null)

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
      <Button type="button" onClick={onNew} className="w-full justify-start">
        <MessageSquarePlus className="size-4" aria-hidden />
        New chat
      </Button>
      {chats.length === 0 ? (
        <p className="px-1 text-sm text-muted-foreground">
          Your conversations will be kept here, on this device.
        </p>
      ) : (
        <ul className="grid grid-cols-[minmax(0,1fr)] gap-1" aria-label="Your chats">
          {chats.map((c) => (
            <li
              key={c.id}
              className={cn(
                'group flex min-w-0 items-center gap-1 rounded-sm',
                c.id === activeId && 'bg-muted',
              )}
            >
              <button
                type="button"
                onClick={() => onSelect(c.id)}
                aria-current={c.id === activeId ? 'true' : undefined}
                className="min-w-0 flex-1 cursor-pointer rounded-sm px-3 py-2 text-left hover:bg-muted/80"
              >
                <span className="block truncate text-sm font-medium">{c.title}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {c.orderRef ? `${c.orderRef} · ` : ''}
                  {fmtTime(new Date(c.updatedAt).toISOString())}
                </span>
              </button>
              {confirmId === c.id ? (
                <span className="flex shrink-0 items-center gap-1 pr-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    className="h-7 px-2 text-xs"
                    onClick={() => {
                      onDelete(c.id)
                      setConfirmId(null)
                    }}
                  >
                    Delete
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs"
                    onClick={() => setConfirmId(null)}
                  >
                    Keep
                  </Button>
                </span>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 shrink-0 opacity-60 hover:opacity-100"
                  aria-label={`Delete chat: ${c.title}`}
                  onClick={() => setConfirmId(c.id)}
                >
                  <Trash2 className="size-3.5" aria-hidden />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Bubble({ m }: { m: ChatMessage }) {
  const mine = m.role === 'user'
  return (
    <div className={cn('flex gap-2', mine ? 'justify-end' : 'justify-start')}>
      {!mine && (
        <span className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-sm bg-primary/10 text-primary">
          <Bot className="size-4" aria-hidden />
        </span>
      )}
      <div
        className={cn(
          'min-w-0 max-w-[85%] break-words rounded-sm px-4 py-2.5 text-sm',
          mine
            ? 'bg-primary text-primary-foreground'
            : 'border border-border bg-muted/60',
        )}
      >
        {mine ? (
          <p className="whitespace-pre-wrap break-words">{m.content}</p>
        ) : (
          <Markdownish text={m.content} />
        )}
        {!mine && m.meta?.steps && m.meta.steps.length > 0 && (
          <ul className="mt-2 grid gap-0.5 border-t border-border pt-2 text-xs text-muted-foreground">
            {m.meta.steps.map((s) => (
              <li key={s} className="flex items-center gap-1.5">
                <Check className="size-3 text-risk-low" aria-hidden />
                {s}
              </li>
            ))}
            {m.meta.as_of ? (
              <li>Based on information from {fmtClock(m.meta.as_of)}</li>
            ) : null}
          </ul>
        )}
        {!mine && m.meta?.stopped && (
          <p className="mt-1 text-xs text-muted-foreground">You stopped this answer.</p>
        )}
      </div>
    </div>
  )
}

function Thinking({ status, seconds }: { status: string; seconds: number }) {
  return (
    <div className="flex gap-2" role="status" aria-live="polite">
      <span className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-sm bg-primary/10 text-primary">
        <Bot className="size-4" aria-hidden />
      </span>
      <div className="rounded-sm border border-border bg-muted/60 px-4 py-3 text-sm">
        <div className="flex items-center gap-2">
          <span className="flex gap-1" aria-hidden>
            {[0, 150, 300].map((delay) => (
              <i
                key={delay}
                className="size-1.5 animate-bounce rounded-sm bg-muted-foreground"
                style={{ animationDelay: `${delay}ms` }}
              />
            ))}
          </span>
          <span className="text-muted-foreground">{status || 'Thinking…'}</span>
        </div>
        {seconds >= SLOW_AFTER_SECONDS && (
          <p className="mt-1 text-xs text-muted-foreground">
            Still working on it. This can take a few more seconds.
          </p>
        )}
      </div>
    </div>
  )
}

export function AssistantPanel() {
  const [params, setParams] = useSearchParams()
  const { chats, create, update, remove } = useChats()
  const [activeId, setActiveId] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [live, setLive] = useState<{
    id: string
    content: string
    status: string
  } | null>(null)
  const [seconds, setSeconds] = useState(0)
  const [failed, setFailed] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const abort = useRef<AbortController | null>(null)
  const bottom = useRef<HTMLDivElement | null>(null)
  const booted = useRef(false)

  const chat = chats.find((c) => c.id === activeId)
  const busy = live !== null

  useEffect(() => {
    if (booted.current) return
    booted.current = true
    const order = Number(params.get('order')) || null
    if (order) {
      const reuse = chats.find((c) => c.order === order && c.messages.length === 0)
      const id = reuse?.id ?? create(order)
      if (!reuse) {
        update(id, () => ({ orderRef: params.get('ref') }))
      }
      setActiveId(id)
      setParams({}, { replace: true })
    } else {
      setActiveId(chats[0]?.id ?? null)
    }
    // Boot once from URL / stored chats.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' })
  }, [chat?.messages.length, live?.content, live?.status])

  useEffect(() => {
    if (!busy) return undefined
    setSeconds(0)
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => clearInterval(timer)
  }, [busy])

  async function send(content: string) {
    const question = content.trim()
    if (!question || busy) return
    const id = activeId ?? create(null)
    setActiveId(id)
    setFailed(null)
    setText('')
    const current = chats.find((c) => c.id === id)
    const history: ChatMessage[] = [
      ...(current?.messages ?? []),
      { role: 'user', content: question },
    ]
    update(id, (c) => ({
      title: c.messages.length ? c.title : titleFrom(question),
      messages: history,
    }))

    const controller = new AbortController()
    abort.current = controller
    setLive({ id, content: '', status: 'Reading your question…' })
    let answer = ''
    const outcome: {
      done: {
        reply: string
        steps?: string[]
        as_of?: string
        order_id?: number | null
        order_ref?: string | null
      } | null
    } = { done: null }

    try {
      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          chat_id: id,
          messages: history.map(({ role, content: c }) => ({ role, content: c })),
          ...(current?.order ? { order_id: current.order } : {}),
        }),
      })
      if (!response.ok) throw new Error('request failed')
      await readEvents(response, (event) => {
        if (event.type === 'status') {
          setLive((l) => (l ? { ...l, status: event.text } : l))
        } else if (event.type === 'token') {
          answer += event.text
          setLive((l) => (l ? { ...l, content: answer, status: '' } : l))
        } else if (event.type === 'replace') {
          answer = event.text
          setLive((l) => (l ? { ...l, content: answer, status: '' } : l))
        } else if (event.type === 'done') {
          outcome.done = event
        } else if (event.type === 'error') {
          throw new Error('stream failed')
        }
      })
      if (!outcome.done) throw new Error('incomplete answer')
      const finished = outcome.done
      update(id, (c) => ({
        orderRef: finished.order_ref ?? c.orderRef,
        order: c.order ?? finished.order_id ?? null,
        messages: [
          ...history,
          {
            role: 'assistant',
            content: finished.reply,
            meta: { steps: finished.steps, as_of: finished.as_of },
          },
        ],
      }))
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        if (answer) {
          update(id, () => ({
            messages: [
              ...history,
              {
                role: 'assistant',
                content: answer,
                meta: { stopped: true },
              },
            ],
          }))
        }
      } else {
        setFailed(question)
        update(id, () => ({ messages: history.slice(0, -1) }))
        setText(question)
      }
    } finally {
      setLive(null)
      abort.current = null
    }
  }

  function startNewChat() {
    abort.current?.abort()
    setActiveId(null)
    setFailed(null)
    setText('')
    setMenuOpen(false)
  }

  const empty = !chat || chat.messages.length === 0
  const list = (
    <ChatList
      chats={chats}
      activeId={activeId}
      onNew={startNewChat}
      onSelect={(id) => {
        abort.current?.abort()
        setActiveId(id)
        setFailed(null)
        setMenuOpen(false)
      }}
      onDelete={(id) => {
        remove(id)
        if (id === activeId) setActiveId(null)
      }}
    />
  )

  return (
    <section className="space-y-4">
      <PageHero
        tone="chat"
        title="Chat"
        description="Ask about orders, risk and what to do next. The assistant can look things up, and you make the decisions."
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="lg:hidden"
            onClick={() => setMenuOpen((o) => !o)}
          >
            <History className="size-4" aria-hidden />
            Past chats
          </Button>
        }
      />

      {menuOpen ? (
        <div className="rounded-sm border border-border bg-card p-4 lg:hidden">
          <p className="mb-3 text-sm font-medium">Your chats</p>
          {list}
        </div>
      ) : null}

      <div className="grid items-start gap-4 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <aside className="hidden max-h-[calc(100vh-14rem)] overflow-y-auto rounded-sm border border-border bg-card p-4 lg:block">
          {list}
        </aside>

        <div className="flex h-[calc(100vh-14rem)] min-h-[28rem] flex-col rounded-sm border border-border bg-card">
          {chat?.order ? (
            <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2 text-sm">
              <span className="flex flex-wrap items-center gap-2">
                About order{' '}
                <Link
                  to={`/cases/${chat.order}`}
                  className="font-semibold text-primary hover:underline"
                >
                  {chat.orderRef ?? `#${chat.order}`}
                </Link>
              </span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs"
                onClick={() =>
                  update(chat.id, () => ({ order: null, orderRef: null }))
                }
              >
                <X className="size-3.5" aria-hidden />
                Ask about everything
              </Button>
            </div>
          ) : null}

          <div
            className="min-h-0 flex-1 overflow-y-auto p-4"
            role="log"
            aria-live="polite"
            aria-label="Conversation"
          >
            {empty && !busy ? (
              <div className="mx-auto grid max-w-md justify-items-center gap-4 pt-6 text-center">
                <span className="flex size-14 items-center justify-center rounded-sm bg-primary/10 text-primary">
                  <Bot className="size-7" aria-hidden />
                </span>
                <div>
                  <p className="text-lg font-semibold">Hi, how can I help?</p>
                  <p className="text-sm text-muted-foreground">
                    I can tell you which orders need attention, why one is at
                    risk, and what you could do about it.
                  </p>
                </div>
                <div className="grid w-full grid-cols-[minmax(0,1fr)] gap-2">
                  {SUGGESTIONS[chat?.order ? 'order' : 'general'].map((s) => (
                    <Button
                      key={s}
                      type="button"
                      variant="outline"
                      className="h-auto justify-start whitespace-normal py-2 text-left"
                      onClick={() => void send(s)}
                    >
                      {s}
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
                {chat?.messages.map((m, i) => (
                  <Bubble key={i} m={m} />
                ))}
                {live &&
                  live.id === activeId &&
                  (live.content ? (
                    <Bubble
                      m={{ role: 'assistant', content: `${live.content}▍` }}
                    />
                  ) : (
                    <Thinking status={live.status} seconds={seconds} />
                  ))}
                {failed ? (
                  <div
                    className="rounded-sm border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
                    role="alert"
                  >
                    The assistant could not answer just now. Your question is
                    back in the box, so you can send it again in a moment.
                  </div>
                ) : null}
              </div>
            )}
            <div ref={bottom} />
          </div>

          <form
            className="grid grid-cols-[minmax(0,1fr)] gap-1.5 border-t border-border p-3"
            onSubmit={(e) => {
              e.preventDefault()
              void send(text)
            }}
          >
            <div className="flex items-end gap-2">
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={2}
                maxLength={2000}
                className="min-h-0"
                placeholder={
                  chat?.order
                    ? 'Ask about this order…'
                    : 'Ask a question, or just say hello…'
                }
                aria-label="Your message"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    void send(text)
                  }
                }}
              />
              {busy ? (
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  onClick={() => abort.current?.abort()}
                  aria-label="Stop"
                >
                  <Square className="size-4" aria-hidden />
                </Button>
              ) : (
                <Button
                  type="submit"
                  size="icon"
                  disabled={!text.trim()}
                  aria-label="Send"
                >
                  <SendHorizontal className="size-4" aria-hidden />
                </Button>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Press Enter to send, Shift and Enter for a new line. Chats are kept
              on this device only.
            </p>
          </form>
        </div>
      </div>
    </section>
  )
}

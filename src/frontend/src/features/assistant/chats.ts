import { useCallback, useEffect, useState } from 'react'

const KEY = 'delivery-assistant-chats-v1'
const MAX_CHATS = 30
const MAX_MESSAGES = 60

export type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
  meta?: {
    steps?: string[]
    as_of?: string
    stopped?: boolean
  }
}

export type Chat = {
  id: string
  title: string
  order: number | null
  orderRef: string | null
  createdAt: number
  updatedAt: number
  messages: ChatMessage[]
}

const read = (): Chat[] => {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || '[]') as unknown
    return Array.isArray(parsed) ? (parsed as Chat[]) : []
  } catch {
    return []
  }
}

const newId = () =>
  `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`

/** Past conversations, kept on this device only. */
export function useChats() {
  const [chats, setChats] = useState<Chat[]>(read)

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(chats))
    } catch {
      /* storage full or blocked — chats last for this visit only */
    }
  }, [chats])

  const create = useCallback((order: number | null = null) => {
    const chat: Chat = {
      id: newId(),
      title: 'New chat',
      order,
      orderRef: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [],
    }
    setChats((all) => [chat, ...all].slice(0, MAX_CHATS))
    return chat.id
  }, [])

  const update = useCallback((id: string, change: (c: Chat) => Partial<Chat>) => {
    setChats((all) =>
      all
        .map((c) => {
          if (c.id !== id) return c
          const next = { ...c, ...change(c), updatedAt: Date.now() }
          next.messages = next.messages.slice(-MAX_MESSAGES)
          return next
        })
        .sort((a, b) => b.updatedAt - a.updatedAt),
    )
  }, [])

  const remove = useCallback((id: string) => {
    setChats((all) => all.filter((c) => c.id !== id))
  }, [])

  return { chats, create, update, remove }
}

export type StreamEvent =
  | { type: 'status'; text: string }
  | { type: 'token'; text: string }
  | { type: 'replace'; text: string }
  | {
      type: 'done'
      reply: string
      steps?: string[]
      as_of?: string
      order_id?: number | null
      order_ref?: string | null
    }
  | { type: 'error'; message?: string }

/** Read a server-sent-event stream, calling `onEvent` for every JSON event. */
export async function readEvents(
  response: Response,
  onEvent: (event: StreamEvent) => void,
): Promise<void> {
  const reader = response.body?.getReader()
  if (!reader) throw new Error('No response body')
  const decoder = new TextDecoder()
  let buffer = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let end: number
    while ((end = buffer.indexOf('\n\n')) >= 0) {
      const block = buffer.slice(0, end)
      buffer = buffer.slice(end + 2)
      const line = block.split('\n').find((l) => l.startsWith('data: '))
      if (line) onEvent(JSON.parse(line.slice(6)) as StreamEvent)
    }
  }
}

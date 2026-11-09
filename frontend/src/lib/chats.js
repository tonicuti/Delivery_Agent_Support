import { useCallback, useEffect, useState } from "react";

const KEY = "console-chats-v1";
const MAX_CHATS = 30;
const MAX_MESSAGES = 60;

const read = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

/** Past conversations, kept on this device only. */
export function useChats() {
  const [chats, setChats] = useState(read);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(chats));
    } catch {
      /* storage is full or blocked: chats then last for this visit only */
    }
  }, [chats]);

  const create = useCallback((order = null) => {
    const chat = { id: newId(), title: "New chat", order, createdAt: Date.now(), updatedAt: Date.now(), messages: [] };
    setChats((all) => [chat, ...all].slice(0, MAX_CHATS));
    return chat.id;
  }, []);

  const update = useCallback((id, change) => {
    setChats((all) => all.map((c) => {
      if (c.id !== id) return c;
      const next = { ...c, ...change(c), updatedAt: Date.now() };
      next.messages = next.messages.slice(-MAX_MESSAGES);
      return next;
    }).sort((a, b) => b.updatedAt - a.updatedAt));
  }, []);

  const remove = useCallback((id) => setChats((all) => all.filter((c) => c.id !== id)), []);

  return { chats, create, update, remove };
}

/** Read a server-sent-event stream, calling `onEvent` for every JSON event. */
export async function readEvents(response, onEvent) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let end;
    while ((end = buffer.indexOf("\n\n")) >= 0) {
      const block = buffer.slice(0, end);
      buffer = buffer.slice(end + 2);
      const line = block.split("\n").find((l) => l.startsWith("data: "));
      if (line) onEvent(JSON.parse(line.slice(6)));
    }
  }
}

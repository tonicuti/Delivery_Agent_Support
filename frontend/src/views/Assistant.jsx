import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Bot, Check, History, MessageSquarePlus, SendHorizontal, Square, Trash2, X } from "lucide-react";
import Markdownish from "@/components/Markdownish.jsx";
import { Button } from "@/components/ui/button.jsx";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog.jsx";
import { Card } from "@/components/ui/card.jsx";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet.jsx";
import { Textarea } from "@/components/ui/textarea.jsx";
import { fmtClock, fmtTime } from "@/format.js";
import { readEvents, useChats } from "@/lib/chats.js";
import { cn } from "@/lib/utils.js";

const SUGGESTIONS = {
  general: ["What needs my attention first?", "Which orders are most at risk right now?", "How are decisions going so far?", "What can you help me with?"],
  order: ["Why is this order at risk?", "What should I do about it?", "Where is the shipment, and is it running late?", "Is this information up to date?"],
};
const SLOW_AFTER_SECONDS = 8;
const titleFrom = (text) => (text.length > 42 ? `${text.slice(0, 40).trim()}…` : text);

function ChatList({ chats, activeId, onSelect, onNew, onDelete }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
      <Button onClick={onNew}><MessageSquarePlus aria-hidden="true" />New chat</Button>
      {chats.length === 0 ? <p className="px-1 text-sm text-muted-foreground">Your conversations will be kept here, on this device.</p> : (
        <ul className="grid grid-cols-[minmax(0,1fr)] gap-1" aria-label="Your chats">
          {chats.map((c) => (
            <li key={c.id} className={cn("group flex min-w-0 items-center gap-1 rounded-xl", c.id === activeId && "bg-accent")}>
              <button type="button" onClick={() => onSelect(c.id)} aria-current={c.id === activeId ? "true" : undefined}
                      className="min-w-0 flex-1 rounded-xl px-3 py-2 text-left hover:bg-accent/60">
                <span className="block truncate text-sm font-semibold">{c.title}</span>
                <span className="block truncate text-xs text-muted-foreground">{c.orderRef ? `${c.orderRef} · ` : ""}{fmtTime(new Date(c.updatedAt).toISOString())}</span>
              </button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon-sm" className="shrink-0 opacity-60 hover:opacity-100 focus-visible:opacity-100" aria-label={`Delete chat: ${c.title}`}><Trash2 aria-hidden="true" /></Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this chat?</AlertDialogTitle>
                    <AlertDialogDescription>“{c.title}” will be removed from this device. This cannot be undone.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Keep it</AlertDialogCancel>
                    <AlertDialogAction onClick={() => onDelete(c.id)}>Delete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Bubble({ m }) {
  const mine = m.role === "user";
  return (
    <div className={cn("flex gap-2", mine ? "justify-end" : "justify-start")}>
      {!mine && <span className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-accent-foreground"><Bot className="size-4" aria-hidden="true" /></span>}
      <div className={cn("min-w-0 max-w-[85%] break-words rounded-2xl px-4 py-2.5 text-sm", mine ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm border bg-muted/60")}>
        {mine ? <p className="whitespace-pre-wrap break-words">{m.content}</p> : <Markdownish text={m.content} />}
        {!mine && m.meta?.steps?.length > 0 && (
          <ul className="mt-2 grid gap-0.5 border-t pt-2 text-xs text-muted-foreground">
            {m.meta.steps.map((s) => <li key={s} className="flex items-center gap-1.5"><Check className="size-3 text-risk-low" aria-hidden="true" />{s}</li>)}
            <li>Based on information from {fmtClock(m.meta.as_of)}</li>
          </ul>
        )}
        {!mine && m.meta?.stopped && <p className="mt-1 text-xs text-muted-foreground">You stopped this answer.</p>}
      </div>
    </div>
  );
}

function Thinking({ status, seconds }) {
  return (
    <div className="flex gap-2" role="status" aria-live="polite">
      <span className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-accent-foreground"><Bot className="size-4" aria-hidden="true" /></span>
      <div className="rounded-2xl rounded-bl-sm border bg-muted/60 px-4 py-3 text-sm">
        <div className="flex items-center gap-2">
          <span className="flex gap-1" aria-hidden="true">
            {[0, 150, 300].map((delay) => <i key={delay} className="size-1.5 animate-bounce rounded-full bg-muted-foreground" style={{ animationDelay: `${delay}ms` }} />)}
          </span>
          <span className="text-muted-foreground">{status || "Thinking…"}</span>
        </div>
        {seconds >= SLOW_AFTER_SECONDS && <p className="mt-1 text-xs text-muted-foreground">Still working on it. This can take a few more seconds.</p>}
      </div>
    </div>
  );
}

export default function Assistant() {
  const [params, setParams] = useSearchParams();
  const { chats, create, update, remove } = useChats();
  const [activeId, setActiveId] = useState(null);
  const [text, setText] = useState("");
  const [live, setLive] = useState(null); // { id, content, status } while an answer is being written
  const [seconds, setSeconds] = useState(0);
  const [failed, setFailed] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const abort = useRef(null);
  const bottom = useRef(null);
  const booted = useRef(false);

  const chat = chats.find((c) => c.id === activeId);
  const busy = live !== null;

  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    const order = Number(params.get("order")) || null;
    if (order) {
      const reuse = chats.find((c) => c.order === order && c.messages.length === 0);
      const id = reuse?.id ?? create(order);
      if (!reuse) update(id, () => ({ orderRef: params.get("ref") }));
      setActiveId(id);
      setParams({}, { replace: true });
    } else {
      setActiveId(chats[0]?.id ?? null);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { bottom.current?.scrollIntoView({ block: "end" }); }, [chat?.messages.length, live?.content, live?.status]);
  useEffect(() => {
    if (!busy) return undefined;
    setSeconds(0);
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [busy]);

  async function send(content) {
    const question = content.trim();
    if (!question || busy) return;
    const id = activeId ?? create(null);
    setActiveId(id);
    setFailed(null);
    setText("");
    const history = [...(chat?.messages ?? []), { role: "user", content: question }];
    update(id, (c) => ({ title: c.messages.length ? c.title : titleFrom(question), messages: history }));

    const controller = new AbortController();
    abort.current = controller;
    setLive({ id, content: "", status: "Reading your question…" });
    let answer = "", meta = null;
    try {
      const response = await fetch("/api/chat/stream", {
        method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal,
        body: JSON.stringify({ chat_id: id, messages: history.map(({ role, content: c }) => ({ role, content: c })), ...(chat?.order ? { order_id: chat.order } : {}) }),
      });
      if (!response.ok) throw new Error("request failed");
      await readEvents(response, (event) => {
        if (event.type === "status") setLive((l) => l && { ...l, status: event.text });
        else if (event.type === "token") { answer += event.text; setLive((l) => l && { ...l, content: answer, status: "" }); }
        else if (event.type === "replace") { answer = event.text; setLive((l) => l && { ...l, content: answer, status: "" }); }
        else if (event.type === "done") meta = event;
        else if (event.type === "error") throw new Error("stream failed");
      });
      if (!meta) throw new Error("incomplete answer");
      update(id, (c) => ({
        orderRef: meta.order_ref ?? c.orderRef, order: c.order ?? meta.order_id ?? null,
        messages: [...history, { role: "assistant", content: meta.reply, meta: { steps: meta.steps, as_of: meta.as_of } }],
      }));
    } catch (error) {
      if (error.name === "AbortError") {
        if (answer) update(id, () => ({ messages: [...history, { role: "assistant", content: answer, meta: { stopped: true } }] }));
      } else {
        setFailed(question);
        update(id, () => ({ messages: history.slice(0, -1) })); // the question is kept in the box to retry
        setText(question);
      }
    } finally {
      setLive(null);
      abort.current = null;
    }
  }

  function startNewChat() {
    abort.current?.abort();
    setActiveId(null);
    setFailed(null);
    setText("");
    setMenuOpen(false);
  }

  const empty = !chat || chat.messages.length === 0;
  const list = <ChatList chats={chats} activeId={activeId} onNew={startNewChat} onSelect={(id) => { abort.current?.abort(); setActiveId(id); setFailed(null); setMenuOpen(false); }}
                         onDelete={(id) => { remove(id); if (id === activeId) setActiveId(null); }} />;

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Chat</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Ask about orders, risk and what to do next. The assistant can look things up, and you make the decisions.</p>
        </div>
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger asChild><Button variant="outline" className="lg:hidden"><History aria-hidden="true" />Past chats</Button></SheetTrigger>
          <SheetContent side="left" className="w-80 p-4">
            <SheetTitle>Your chats</SheetTitle>
            <SheetDescription className="sr-only">Open or delete earlier conversations</SheetDescription>
            <div className="mt-4">{list}</div>
          </SheetContent>
        </Sheet>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <Card className="hidden max-h-[calc(100vh-11rem)] overflow-y-auto p-4 lg:block">{list}</Card>

        <Card className="h-[calc(100vh-11rem)] min-h-[30rem] gap-0 py-0">
          {chat?.order && (
            <div className="flex items-center justify-between gap-2 border-b px-4 py-2 text-sm">
              <span className="flex items-center gap-2">About order <Link to={`/orders/${chat.order}`} className="font-semibold text-primary hover:underline">{chat.orderRef ?? `#${chat.order}`}</Link></span>
              <Button size="xs" variant="ghost" onClick={() => update(chat.id, () => ({ order: null, orderRef: null }))}><X aria-hidden="true" />Ask about everything</Button>
            </div>
          )}
          <div className="min-h-0 flex-1 overflow-y-auto p-4" role="log" aria-live="polite" aria-label="Conversation">
            {empty && !busy ? (
              <div className="mx-auto grid max-w-md justify-items-center gap-4 pt-6 text-center">
                <span className="flex size-14 items-center justify-center rounded-full bg-brand-soft text-accent-foreground"><Bot className="size-7" aria-hidden="true" /></span>
                <div>
                  <p className="text-lg font-bold">Hi, how can I help?</p>
                  <p className="text-sm text-muted-foreground">I can tell you which orders need attention, why one is at risk, and what you could do about it.</p>
                </div>
                <div className="grid w-full grid-cols-[minmax(0,1fr)] gap-2">
                  {SUGGESTIONS[chat?.order ? "order" : "general"].map((s) => (
                    <Button key={s} variant="outline" className="h-auto justify-start whitespace-normal py-2 text-left" onClick={() => send(s)}>{s}</Button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
                {chat?.messages.map((m, i) => <Bubble key={i} m={m} />)}
                {live && live.id === activeId && (live.content
                  ? <Bubble m={{ role: "assistant", content: `${live.content}▍` }} />
                  : <Thinking status={live.status} seconds={seconds} />)}
                {failed && (
                  <div className="rounded-xl border border-risk-high bg-risk-high-bg p-3 text-sm text-risk-high-fg" role="alert">
                    The assistant could not answer just now. Your question is back in the box, so you can send it again in a moment.
                  </div>
                )}
              </div>
            )}
            <div ref={bottom} />
          </div>
          <form className="grid grid-cols-[minmax(0,1fr)] gap-1.5 border-t p-3" onSubmit={(e) => { e.preventDefault(); send(text); }}>
            <div className="flex items-end gap-2">
              <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} maxLength={2000} className="min-h-0 resize-none"
                        placeholder={chat?.order ? "Ask about this order…" : "Ask a question, or just say hello…"} aria-label="Your message"
                        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(text); } }} />
              {busy
                ? <Button type="button" size="icon-lg" variant="outline" onClick={() => abort.current?.abort()} aria-label="Stop"><Square aria-hidden="true" /></Button>
                : <Button type="submit" size="icon-lg" disabled={!text.trim()} aria-label="Send"><SendHorizontal aria-hidden="true" /></Button>}
            </div>
            <p className="text-[11px] text-muted-foreground">Press Enter to send, Shift and Enter for a new line. Chats are kept on this device only.</p>
          </form>
        </Card>
      </div>
    </>
  );
}

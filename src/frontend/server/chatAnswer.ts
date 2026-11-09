/**
 * Fact-based chat answers from the session DB (read-only).
 * Does not create tables or write chat history — the browser keeps chats locally.
 */
import type { DatabaseSync } from 'node:sqlite'
import type { CaseDetail, WorklistRow } from '../src/shared/types'
import { queryCase } from './queryCase'
import { queryWorklist } from './queries'
import { applyFlagsToCase, applyFlagsToWorklist } from './sessionFlags'
import { readSessionFlags } from './db'

export type ChatStreamEvent =
  | { type: 'status'; text: string }
  | { type: 'token'; text: string }
  | {
      type: 'done'
      reply: string
      incomplete: boolean
      fallback: boolean
      steps: string[]
      as_of: string
      order_id: number | null
      order_ref: string | null
    }
  | { type: 'error'; message: string }

type ChatMessage = { role: 'user' | 'assistant'; content: string }

const MAX_MESSAGES = 40
const MAX_CHARS = 2000

const REASON_PLAIN: Record<string, string> = {
  stock_short: 'not enough stock for some items',
  stock_backorder: 'some items are on backorder',
  pick_behind: 'picking in the warehouse is behind schedule',
  pack_missing: 'packing has not been recorded yet',
  eta_delay: 'the expected arrival is later than promised',
  departure_delay: 'the truck left later than planned',
}

const BAND_PLAIN: Record<string, string> = {
  High: 'high chance of being late',
  Medium: 'some chance of being late',
  Low: 'looking okay so far',
}

function utcNow(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')
}

function pctLate(p: number): string {
  return `${Math.round(p * 100)}%`
}

function parseReasons(json: string): string[] {
  try {
    const parsed = JSON.parse(json) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.map((x) => String(x)).filter(Boolean).slice(0, 4)
  } catch {
    return []
  }
}

function plainReasons(json: string): string[] {
  return parseReasons(json).map((code) => REASON_PLAIN[code] ?? code.replace(/_/g, ' '))
}

function extractOrderId(text: string): number | null {
  const external = text.match(/\b(?:ORDER[-_]?|order\s*#?\s*)(\d{3,})\b/i)
  if (external) return Number(external[1])
  const bare = text.match(/\b(\d{4,})\b/)
  return bare ? Number(bare[1]) : null
}

/** Prefer external order ref like ORDER-1003 when present in the DB. */
function resolveOrderId(db: DatabaseSync, text: string, scopeOrderId: number | null): number | null {
  const ref = text.match(/\bORDER[-_]?\d{3,}\b/i)?.[0]
  if (ref) {
    const row = db
      .prepare(
        `SELECT order_id FROM customer_order
         WHERE upper(external_order_id) = upper(?) LIMIT 1`,
      )
      .get(ref) as { order_id?: number } | undefined
    if (row?.order_id != null) return Number(row.order_id)
  }
  return extractOrderId(text) ?? scopeOrderId
}

export function validateChatMessages(messages: unknown): ChatMessage[] {
  if (!Array.isArray(messages) || !messages.length || messages.length > MAX_MESSAGES) {
    throw new Error(`messages must be a list of 1 to ${MAX_MESSAGES} items`)
  }
  const clean: ChatMessage[] = []
  for (const message of messages) {
    if (
      !message ||
      typeof message !== 'object' ||
      !('role' in message) ||
      !('content' in message)
    ) {
      throw new Error('each message needs a user/assistant role and text')
    }
    const role = (message as { role: unknown }).role
    const content = (message as { content: unknown }).content
    if (
      (role !== 'user' && role !== 'assistant') ||
      typeof content !== 'string' ||
      !content.trim() ||
      content.length > MAX_CHARS
    ) {
      throw new Error(`each message needs a user/assistant role and 1 to ${MAX_CHARS} characters`)
    }
    clean.push({ role, content: content.trim() })
  }
  if (clean[clean.length - 1]?.role !== 'user') {
    throw new Error('the last message must come from the user')
  }
  return clean
}

function helpText(): string {
  return [
    'I can help you check deliveries that may arrive late.',
    '',
    'Try asking things like:',
    '- **What needs my attention first?**',
    '- **Which orders are most at risk right now?**',
    '- **Why is order 1002 at risk?**',
    '- **What could I do about this order?**',
    '',
    'I look things up from the practice data in this demo. You still decide what to do.',
  ].join('\n')
}

function summarizeWorklist(items: WorklistRow[], limit = 5): string {
  if (items.length === 0) {
    return 'Right now there are **no open orders** that need attention in this demo scope.'
  }
  const high = items.filter((i) => i.risk_band === 'High')
  const med = items.filter((i) => i.risk_band === 'Medium')
  const lines = items.slice(0, limit).map((row, idx) => {
    const ref = row.customer_order.external_order_id
    const band = BAND_PLAIN[row.risk_band] ?? row.risk_band
    const reasons = plainReasons(row.risk_score.reason_codes_json)
    const why = reasons.length ? ` — ${reasons.join('; ')}` : ''
    return `${idx + 1}. **${ref}** (${band}, about ${pctLate(row.risk_score.p_late)} chance of being late)${why}`
  })
  const more =
    items.length > limit
      ? `\n\n…and **${items.length - limit}** more on the worklist.`
      : ''
  return [
    `There are **${items.length}** open orders that may need a look.`,
    high.length || med.length
      ? `Of those, **${high.length}** look high risk and **${med.length}** look medium risk.`
      : null,
    '',
    'Start with these:',
    ...lines,
    more,
    '',
    'Open an order from **Orders needing attention** for the full picture, then record your decision there.',
  ]
    .filter((x) => x != null)
    .join('\n')
}

function summarizeOrder(detail: CaseDetail): string {
  const ref = detail.customer_order.external_order_id
  const band = BAND_PLAIN[detail.risk_band] ?? detail.risk_band
  const reasons = plainReasons(detail.risk_score.reason_codes_json)
  const customer = detail.customer.external_customer_id
  const wh = detail.shipment?.warehouse.name ?? 'the warehouse'
  const eta = detail.shipment?.latest_eta_update?.current_eta_at_utc
  const hours = detail.order_snapshot.hours_to_deadline
  const timeLeft =
    hours == null || Number.isNaN(hours)
      ? null
      : hours < 0
        ? `The promised delivery window ended about **${Math.abs(hours).toFixed(1)} hours** ago.`
        : hours < 1
          ? `There are about **${Math.round(hours * 60)} minutes** left until the promised window ends.`
          : `There are about **${hours.toFixed(1)} hours** left until the promised window ends.`

  const suggestion = detail.agent_recommendation
  const suggestedAction =
    suggestion?.validation_status === 'valid' && suggestion.action_id
      ? String(suggestion.action_id).replace(/_/g, ' ')
      : null

  const parts = [
    `**${ref}** for **${customer}** currently looks like a **${band}** (about ${pctLate(detail.risk_score.p_late)} chance of being late).`,
    '',
    reasons.length
      ? `Main reasons flagged:\n${reasons.map((r) => `- ${r}`).join('\n')}`
      : 'No short reason list was stored for this order — check warehouse and transport details on the case page.',
    '',
    `It is handled from **${wh}**.`,
    timeLeft,
    eta ? `Latest expected arrival on record: **${eta.replace('T', ' ').slice(0, 16)} UTC**.` : null,
    '',
    suggestedAction
      ? `A suggested next step on file is: **${suggestedAction}**. Treat it as a hint — you still choose.`
      : 'There is no ready suggestion for this order right now. You can still decide from the evidence on the case page.',
    '',
    `Open the case for **${ref}** to see warehouse progress, transport, and to record what you decided.`,
  ]

  return parts.filter(Boolean).join('\n')
}

function whatToDo(detail: CaseDetail): string {
  const ref = detail.customer_order.external_order_id
  const suggestion = detail.agent_recommendation
  const lines = [
    `For **${ref}**, a practical way to work is:`,
    '',
    '1. Read the reasons and evidence on the case page (warehouse + transport).',
    '2. Decide whether to approve a suggested action, change it, or dismiss the alert.',
    '3. Complete the real change in your usual systems if needed — this demo app does not change those systems for you.',
  ]
  if (suggestion?.validation_status === 'valid' && suggestion.action_id) {
    lines.push(
      '',
      `Suggested action on file: **${String(suggestion.action_id).replace(/_/g, ' ')}**.`,
    )
  }
  return lines.join('\n')
}

function decisionsBlurb(items: WorklistRow[]): string {
  const open = items.length
  const unacked = items.filter((i) => i.simulated_notification && !i.simulated_notification.acknowledged_at_utc)
    .length
  return [
    'Decision tracking in this demo is simple:',
    '',
    `- **${open}** open alerts still need attention.`,
    `- **${unacked}** of those still look unread.`,
    '',
    'Past decisions and outcomes live under **History**. Recording a decision here only saves your choice for the demo — it does not change warehouse or transport systems.',
  ].join('\n')
}

function buildAnswer(
  db: DatabaseSync,
  question: string,
  scopeOrderId: number | null,
): { reply: string; steps: string[]; order_id: number | null; order_ref: string | null } {
  const flags = readSessionFlags()
  const steps: string[] = []
  const q = question.toLowerCase()

  const wantsHelp =
    /what can you|how can you|help me|xin chào|hello|hi\b|chào/.test(q) &&
    !/order|risk|attention|late|đơn/.test(q)
  if (wantsHelp) {
    return { reply: helpText(), steps: ['Explained what I can help with'], order_id: null, order_ref: null }
  }

  const mentioned = extractOrderId(question)
  const orderId = resolveOrderId(db, question, scopeOrderId)

  const wantsAction = /what (should|could|can) i do|gợi ý|làm gì|next step|recommend/.test(q)
  const wantsWhy = /why|vì sao|tại sao|at risk|flagged|late|risk/.test(q)
  const wantsAttention =
    /attention|at risk|worklist|cần (xem|xử lý)|most at risk|priority|ưu tiên|who is|needs my attention/.test(q)
  const wantsDecisions = /decision|how are (we|decisions)|history|quyết định/.test(q)

  if (orderId != null && (wantsAction || wantsWhy || mentioned != null || scopeOrderId != null)) {
    steps.push('Looked up the order details')
    try {
      const detail = applyFlagsToCase(queryCase(db, orderId), flags)
      const ref = detail.customer_order.external_order_id
      if (wantsAction && !wantsWhy && mentioned == null && scopeOrderId != null) {
        return {
          reply: whatToDo(detail),
          steps,
          order_id: orderId,
          order_ref: ref,
        }
      }
      if (wantsAction) {
        steps.push('Checked the suggested next step')
        return {
          reply: `${summarizeOrder(detail)}\n\n${whatToDo(detail)}`,
          steps,
          order_id: orderId,
          order_ref: ref,
        }
      }
      return {
        reply: summarizeOrder(detail),
        steps,
        order_id: orderId,
        order_ref: ref,
      }
    } catch {
      return {
        reply: `I could not find order **${orderId}** in this demo. Check the number, or open **Orders needing attention** and pick one from the list.`,
        steps,
        order_id: null,
        order_ref: null,
      }
    }
  }

  if (wantsDecisions) {
    steps.push('Checked open alerts')
    const wl = applyFlagsToWorklist(queryWorklist(db, { status: 'active' }), flags)
    return {
      reply: decisionsBlurb(wl.items),
      steps,
      order_id: null,
      order_ref: null,
    }
  }

  if (wantsAttention || /orders?/.test(q) || question.trim().length < 40) {
    steps.push('Checked orders that may need attention')
    const wl = applyFlagsToWorklist(
      queryWorklist(db, { status: 'active', include_low_risk: false }),
      flags,
    )
    const sorted = [...wl.items].sort((a, b) => b.risk_score.p_late - a.risk_score.p_late)
    if (wantsAttention || /orders?|risk|attention|late/.test(q)) {
      return {
        reply: summarizeWorklist(sorted),
        steps,
        order_id: null,
        order_ref: null,
      }
    }
  }

  steps.push('Shared a short guide')
  return { reply: helpText(), steps, order_id: null, order_ref: null }
}

/** Yield status → tokens → done. Never writes to the database. */
export function* chatEvents(
  db: DatabaseSync,
  messages: ChatMessage[],
  orderId: number | null,
): Generator<ChatStreamEvent> {
  const question = messages[messages.length - 1]!.content
  yield { type: 'status', text: 'Reading your question…' }
  yield { type: 'status', text: 'Looking up delivery facts…' }

  const answer = buildAnswer(db, question, orderId)
  yield { type: 'status', text: 'Writing a plain answer…' }

  // Stream in small chunks so the UI can show progress.
  const chunkSize = 24
  for (let i = 0; i < answer.reply.length; i += chunkSize) {
    yield { type: 'token', text: answer.reply.slice(i, i + chunkSize) }
  }

  yield {
    type: 'done',
    reply: answer.reply,
    incomplete: false,
    fallback: true,
    steps: answer.steps,
    as_of: utcNow(),
    order_id: answer.order_id,
    order_ref: answer.order_ref,
  }
}

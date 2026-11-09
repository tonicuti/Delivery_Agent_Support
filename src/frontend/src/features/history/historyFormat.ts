import type { HistoryRow, PlaybookActionId } from '@/shared/types'
import { parseDecisionNotes } from '@/features/decision/decisionNotes'
import { playbookLabel } from '@/features/decision/playbooks'
import { validationStatusLabel } from '@/shared/uiLabels'

export type OutcomeLabel =
  | 'Awaiting delivery outcome'
  | 'On time'
  | 'Late'
  | 'Outcome unknown'

export type HistoryDecisionLabel =
  | 'No decision'
  | 'Approve'
  | 'Edit'
  | 'Dismiss'
  | 'Recorded'

export function formatUtc(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toISOString().replace('T', ' ').slice(0, 16) + 'Z'
}

export function parseReasonCodes(row: HistoryRow): string[] {
  try {
    const parsed = JSON.parse(row.risk_score.reason_codes_json) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.map(String).filter(Boolean).slice(0, 5)
  } catch {
    return []
  }
}

export function outcomeLabel(row: HistoryRow): OutcomeLabel {
  const od = row.original_delivery_outcome
  if (!od || od.label_status === 'unknown' || od.original_completed_at_utc == null) {
    if (!od) return 'Awaiting delivery outcome'
    if (od.label_status === 'unknown') return 'Outcome unknown'
    return 'Awaiting delivery outcome'
  }
  if (od.original_late === 1) return 'Late'
  if (od.original_late === 0) return 'On time'
  return 'Outcome unknown'
}

/** Minutes late vs promised_to_utc when both timestamps exist. Never invent. */
export function lateMinutes(row: HistoryRow): number | null {
  const completed = row.original_delivery_outcome?.original_completed_at_utc
  const promised = row.order_snapshot.promised_to_utc
  if (!completed || !promised) return null
  const a = Date.parse(completed)
  const b = Date.parse(promised)
  if (Number.isNaN(a) || Number.isNaN(b)) return null
  return Math.round((a - b) / 60_000)
}

export function decisionLabel(row: HistoryRow): HistoryDecisionLabel {
  const pf = row.planner_feedback
  if (!pf) return 'No decision'
  const parsed = parseDecisionNotes(pf.notes)
  if (parsed?.decision === 'approve') return 'Approve'
  if (parsed?.decision === 'edit') return 'Edit'
  if (parsed?.decision === 'dismiss') return 'Dismiss'
  return 'Recorded'
}

export function decisionDetail(row: HistoryRow): {
  role: string | null
  at: string | null
  chosen: string
  dismissReason: string | null
  reason: string | null
  execution: string | null
} {
  const pf = row.planner_feedback
  if (!pf) {
    return {
      role: null,
      at: null,
      chosen: '—',
      dismissReason: null,
      reason: null,
      execution: null,
    }
  }
  const parsed = parseDecisionNotes(pf.notes)
  return {
    role: parsed?.acting_role ?? pf.recorded_by,
    at: pf.recorded_at_utc,
    chosen: playbookLabel(pf.chosen_action_id),
    dismissReason: parsed?.dismiss_group ?? null,
    reason: parsed?.reason ?? null,
    execution: parsed?.execution.status ?? 'pending',
  }
}

export function intervened(row: HistoryRow): boolean {
  return row.planner_feedback != null
}

export function episodeCloseReason(row: HistoryRow): string {
  if (row.risk_episode.closed_at_utc) {
    return `Alert closed at ${formatUtc(row.risk_episode.closed_at_utc)}`
  }
  if (row.planner_feedback) {
    return 'Decision recorded (alert may no longer show on Orders needing attention)'
  }
  return 'Alert still open'
}

export function recommendedAction(row: HistoryRow): string {
  const id = row.agent_recommendation?.action_id ?? null
  if (!id) {
    return row.agent_recommendation
      ? `No suggestion (${validationStatusLabel(row.agent_recommendation.validation_status)})`
      : '—'
  }
  return playbookLabel(id)
}

export function shortModelVersion(v: string): string {
  if (v.length <= 28) return v
  return v.slice(0, 12) + '…' + v.slice(-8)
}

export type HistoryTimelineEvent = {
  id: string
  at_utc: string
  label: string
  detail: string
}

export function buildHistoryTimeline(row: HistoryRow): HistoryTimelineEvent[] {
  const events: HistoryTimelineEvent[] = [
    {
      id: 'open',
      at_utc: row.risk_episode.opened_at_utc,
      label: 'Alert opened',
      detail: 'Order flagged for attention',
    },
    {
      id: 'score',
      at_utc: row.risk_score.scored_at_utc,
      label: 'Chance of delay at alert',
      detail: `${Math.round(row.risk_score.p_late * 100)}% chance of delay`,
    },
  ]
  if (row.agent_recommendation) {
    events.push({
      id: 'rec',
      at_utc: row.agent_recommendation.created_at_utc,
      label: 'Suggestion',
      detail: `${recommendedAction(row)} · ${validationStatusLabel(row.agent_recommendation.validation_status)}`,
    })
  }
  if (row.planner_feedback) {
    const d = decisionDetail(row)
    events.push({
      id: 'decision',
      at_utc: row.planner_feedback.recorded_at_utc,
      label: `Staff decision · ${decisionLabel(row)}`,
      detail: `${d.chosen} · ${d.role ?? '—'}`,
    })
  }
  if (row.risk_episode.closed_at_utc) {
    events.push({
      id: 'close',
      at_utc: row.risk_episode.closed_at_utc,
      label: 'Alert closed',
      detail: episodeCloseReason(row),
    })
  }
  const od = row.original_delivery_outcome
  if (od?.original_completed_at_utc) {
    events.push({
      id: 'delivered',
      at_utc: od.original_completed_at_utc,
      label: 'Delivery completed',
      detail: outcomeLabel(row),
    })
  }
  return events.sort((a, b) => Date.parse(a.at_utc) - Date.parse(b.at_utc))
}

export type HistoryFilterState = {
  q: string
  outcome: '' | OutcomeLabel
  decision: '' | HistoryDecisionLabel
  action: '' | PlaybookActionId | 'none'
  model: string
  warehouse: string
  dateFrom: string
  dateTo: string
}

export const emptyHistoryFilters = (): HistoryFilterState => ({
  q: '',
  outcome: '',
  decision: '',
  action: '',
  model: '',
  warehouse: '',
  dateFrom: '',
  dateTo: '',
})

export function applyHistoryFilters(
  rows: HistoryRow[],
  f: HistoryFilterState,
): HistoryRow[] {
  const q = f.q.trim().toLowerCase()
  return rows.filter((row) => {
    if (q) {
      const id = String(row.customer_order.order_id)
      const ext = row.customer_order.external_order_id.toLowerCase()
      const ep = row.risk_episode.episode_id.toLowerCase()
      if (!id.includes(q) && !ext.includes(q) && !ep.includes(q)) return false
    }
    if (f.outcome && outcomeLabel(row) !== f.outcome) return false
    if (f.decision && decisionLabel(row) !== f.decision) return false
    if (f.action === 'none') {
      if (row.agent_recommendation?.action_id) return false
    } else if (f.action) {
      if (row.agent_recommendation?.action_id !== f.action) return false
    }
    if (f.model && row.risk_score.model_version !== f.model) return false
    if (f.warehouse) {
      const wh = row.order_snapshot.warehouse_name ?? ''
      if (wh !== f.warehouse) return false
    }
    if (f.dateFrom) {
      const t = Date.parse(row.risk_episode.opened_at_utc)
      const from = Date.parse(f.dateFrom)
      if (!Number.isNaN(from) && t < from) return false
    }
    if (f.dateTo) {
      const t = Date.parse(row.risk_episode.opened_at_utc)
      const to = Date.parse(f.dateTo)
      if (!Number.isNaN(to) && t > to + 86_400_000) return false
    }
    return true
  })
}

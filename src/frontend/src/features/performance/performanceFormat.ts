import type { HistoryRow, WorklistResponse, WorklistRow } from '@/shared/types'
import { parseDecisionNotes } from '@/features/decision/decisionNotes'
import { DISMISS_GROUPS } from '@/features/decision/playbooks'
import {
  decisionLabel,
  outcomeLabel,
} from '@/features/history/historyFormat'

export type PerformanceSummary = {
  periodLabel: string
  scopeLabel: string
  /** Alerts / episodes in history (opened). */
  episodes_opened: number
  flagged_active: number
  active_high: number
  bands: { High: number; Medium: number; Low: number }
  alerts: {
    sent: number
    acknowledged: number
    unread: number
    median_minutes_to_acknowledge: number | null
  }
  recommendations: {
    with_suggestion: number
    no_suggestion: number
  }
  decisions: {
    approve: number
    edit: number
    dismiss: number
    none: number
  }
  dismiss_reasons: { id: string; label: string; count: number }[]
  awaiting_outcome: number
  on_time: number
  late: number
  outcome_unknown: number
  intervened: number
  otd_lift_hypothesis: string
}

function median(values: number[]): number | null {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!
}

function ackMinutes(row: WorklistRow): number | null {
  const n = row.simulated_notification
  if (!n?.acknowledged_at_utc || !n.created_at_utc) return null
  const a = Date.parse(n.acknowledged_at_utc)
  const b = Date.parse(n.created_at_utc)
  if (Number.isNaN(a) || Number.isNaN(b) || a < b) return null
  return (a - b) / 60_000
}

function dismissLabel(id: string): string {
  return DISMISS_GROUPS.find((g) => g.id === id)?.label ?? id.replace(/_/g, ' ')
}

export function formatDurationMinutes(minutes: number | null): string {
  if (minutes == null) return '—'
  if (minutes < 1) return 'under 1 min'
  if (minutes < 60) return `${Math.round(minutes)} min`
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  return m ? `${h} h ${m} min` : `${h} h`
}

export function formatPct(ratio: number | null): string {
  if (ratio == null || Number.isNaN(ratio)) return '—'
  return `${Math.round(ratio * 100)}%`
}

export function buildPerformanceSummary(
  history: HistoryRow[],
  worklist: WorklistResponse | null,
): PerformanceSummary {
  const decisions = { approve: 0, edit: 0, dismiss: 0, none: 0 }
  const dismissCounts = new Map<string, number>()
  let awaiting = 0
  let onTime = 0
  let late = 0
  let outcomeUnknown = 0
  let intervened = 0
  let withSuggestion = 0
  let noSuggestion = 0

  for (const row of history) {
    const d = decisionLabel(row)
    if (d === 'Approve') decisions.approve += 1
    else if (d === 'Edit') decisions.edit += 1
    else if (d === 'Dismiss') {
      decisions.dismiss += 1
      const parsed = parseDecisionNotes(row.planner_feedback?.notes)
      const gid = parsed?.dismiss_group
      if (gid) {
        dismissCounts.set(gid, (dismissCounts.get(gid) ?? 0) + 1)
      }
    } else decisions.none += 1

    if (row.planner_feedback) intervened += 1

    const o = outcomeLabel(row)
    if (o === 'Awaiting delivery outcome') awaiting += 1
    else if (o === 'On time') onTime += 1
    else if (o === 'Late') late += 1
    else outcomeUnknown += 1

    const vs = row.agent_recommendation?.validation_status
    if (vs === 'valid' && row.agent_recommendation?.action_id) {
      withSuggestion += 1
    } else {
      noSuggestion += 1
    }
  }

  const items = worklist?.items ?? []
  const bands = { High: 0, Medium: 0, Low: 0 }
  let unread = 0
  let acknowledged = 0
  const ackTimes: number[] = []

  for (const row of items) {
    bands[row.risk_band] += 1
    const n = row.simulated_notification
    if (n) {
      if (n.acknowledged_at_utc) {
        acknowledged += 1
        const m = ackMinutes(row)
        if (m != null) ackTimes.push(m)
      } else {
        unread += 1
      }
    } else {
      unread += 1
    }
  }

  // Prefer history ack times when notifications are only on worklist;
  // also count history episodes as "sent" baseline.
  const sent = Math.max(history.length, items.length)

  return {
    periodLabel: 'This demo session',
    scopeLabel: 'Sweden · Stockholm warehouse',
    episodes_opened: history.length,
    flagged_active: worklist?.summary.active_count ?? items.length,
    active_high: bands.High,
    bands,
    alerts: {
      sent,
      acknowledged:
        worklist?.summary
          ? Math.max(0, (worklist.summary.active_count ?? 0) - (worklist.summary.unacknowledged_count ?? 0))
          : acknowledged,
      unread: worklist?.summary.unacknowledged_count ?? unread,
      median_minutes_to_acknowledge: median(ackTimes),
    },
    recommendations: {
      with_suggestion: withSuggestion,
      no_suggestion: noSuggestion,
    },
    decisions,
    dismiss_reasons: [...dismissCounts.entries()]
      .map(([id, count]) => ({ id, label: dismissLabel(id), count }))
      .sort((a, b) => b.count - a.count),
    awaiting_outcome: awaiting,
    on_time: onTime,
    late: late,
    outcome_unknown: outcomeUnknown,
    intervened,
    otd_lift_hypothesis:
      'Pilot goal: 3–5 point gain in on-time delivery (target, not a measured result yet)',
  }
}

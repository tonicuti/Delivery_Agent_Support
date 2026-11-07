import type { HistoryRow, WorklistResponse } from '@/shared/types'
import {
  decisionLabel,
  outcomeLabel,
} from '@/features/history/historyFormat'

export type PerformanceSummary = {
  periodLabel: string
  scopeLabel: string
  flagged_active: number
  awaiting_outcome: number
  on_time: number
  late: number
  decisions: {
    approve: number
    edit: number
    dismiss: number
    none: number
  }
  intervened: number
  /** Pilot hypothesis only — not a measured result. */
  otd_lift_hypothesis: string
}

export function buildPerformanceSummary(
  history: HistoryRow[],
  worklist: WorklistResponse | null,
): PerformanceSummary {
  const decisions = { approve: 0, edit: 0, dismiss: 0, none: 0 }
  let awaiting = 0
  let onTime = 0
  let late = 0
  let intervened = 0

  for (const row of history) {
    const d = decisionLabel(row)
    if (d === 'Approve') decisions.approve += 1
    else if (d === 'Edit') decisions.edit += 1
    else if (d === 'Dismiss') decisions.dismiss += 1
    else if (d === 'No decision') decisions.none += 1
    else decisions.none += 1

    if (row.planner_feedback) intervened += 1

    const o = outcomeLabel(row)
    if (o === 'Awaiting delivery outcome') awaiting += 1
    else if (o === 'On time') onTime += 1
    else if (o === 'Late') late += 1
  }

  return {
    periodLabel: 'Session history (all episodes in session DB)',
    scopeLabel: 'Warehouse scope from shell (demo: Stockholm / warehouse_id 1)',
    flagged_active: worklist?.summary.active_count ?? 0,
    awaiting_outcome: awaiting,
    on_time: onTime,
    late: late,
    decisions,
    intervened,
    otd_lift_hypothesis: '+3 to +5 pp OTD (pilot hypothesis — not a measured result)',
  }
}

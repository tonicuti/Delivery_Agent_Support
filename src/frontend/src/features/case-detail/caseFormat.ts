import { playbookLabel as decisionPlaybookLabel } from '@/features/decision/playbooks'
import { RISK_BAND_SHORT } from '@/shared/uiLabels'
import {
  DATA_STALE_MINUTES,
  type CaseDetail,
  type PlaybookActionId,
  type WarehouseStage,
} from '@/shared/types'

export function formatUtc(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toISOString().replace('T', ' ').slice(0, 16) + 'Z'
}

export function formatAge(iso: string, now = Date.now()): string {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return iso
  const mins = Math.max(0, Math.round((now - t) / 60_000))
  if (mins < 60) return `${mins} min ago`
  const hours = Math.round(mins / 60)
  if (hours < 48) return `${hours} h ago`
  return `${Math.round(hours / 24)} d ago`
}

export function formatPromiseWindow(detail: CaseDetail): string {
  const pv = detail.promise_version
  if (!pv) return 'Not enough info — promised delivery time is missing'
  return `${formatUtc(pv.window_start_utc)} → ${formatUtc(pv.window_end_utc)}`
}

export function formatTimeLeft(detail: CaseDetail): {
  label: string
  kind: 'hours_to_deadline'
} {
  const h = detail.order_snapshot.hours_to_deadline
  if (h == null || Number.isNaN(h)) {
    return { label: '—', kind: 'hours_to_deadline' }
  }
  if (h < 0) {
    return {
      label: `${Math.abs(h).toFixed(1)}h past promised time`,
      kind: 'hours_to_deadline',
    }
  }
  if (h < 1) {
    return {
      label: `${Math.round(h * 60)} min left`,
      kind: 'hours_to_deadline',
    }
  }
  return {
    label: `${h.toFixed(1)} h left`,
    kind: 'hours_to_deadline',
  }
}

export function isScoreStale(detail: CaseDetail, now = Date.now()): boolean {
  const scored = Date.parse(detail.risk_score.scored_at_utc)
  if (Number.isNaN(scored)) return false
  return (now - scored) / 60_000 >= DATA_STALE_MINUTES
}

export type CaseReason = {
  id: string
  label: string
  evidence: string
  source: string
  updated_at_utc: string
  needsVerification: boolean
}

const REASON_LABELS: Record<string, string> = {
  stock_short: 'Low stock on items in this order',
  stock_backorder: 'Items on backorder',
  pick_behind: 'Picking is behind schedule',
  pack_missing: 'Packing not recorded yet',
  eta_delay: 'Expected arrival is later than promised',
  departure_delay: 'Truck left later than planned',
}

/** Prefer model reason codes; if empty, derive ≤3 from observable snapshot/events. */
export function buildCaseReasons(detail: CaseDetail): CaseReason[] {
  const fromCodes = parseReasonCodes(detail)
  if (fromCodes.length > 0) {
    return fromCodes.map((code) => ({
      id: code,
      label: REASON_LABELS[code] ?? humanizeCode(code),
      evidence: '',
      source: 'Latest check',
      updated_at_utc: detail.risk_score.scored_at_utc,
      needsVerification: true,
    }))
  }

  const reasons: CaseReason[] = []
  const snap = detail.order_snapshot
  const shortLines = detail.order_lines.filter(
    (l) => l.latest_stock_event?.stock_status === 'short',
  )
  const backorderLines = detail.order_lines.filter(
    (l) => l.latest_stock_event?.stock_status === 'backorder',
  )

  if (backorderLines.length > 0 || snap.stock_status === 'backorder') {
    const line = backorderLines[0]
    reasons.push({
      id: 'stock_backorder',
      label: REASON_LABELS.stock_backorder,
      evidence: line ? `${line.product.name} is on backorder.` : '',
      source: line ? 'Stock update' : 'Order data',
      updated_at_utc:
        line?.latest_stock_event?.recorded_at_utc ?? snap.as_of_utc,
      needsVerification: true,
    })
  } else if (shortLines.length > 0 || snap.stock_status === 'short') {
    const line = shortLines[0]
    reasons.push({
      id: 'stock_short',
      label: REASON_LABELS.stock_short,
      evidence: line ? `${line.product.name} is low on stock.` : '',
      source: line ? 'Stock update' : 'Order data',
      updated_at_utc:
        line?.latest_stock_event?.recorded_at_utc ?? snap.as_of_utc,
      needsVerification: true,
    })
  }

  const events = detail.shipment?.warehouse_events ?? []
  const hasPacked = events.some((e) => e.stage === 'packed')
  const hasPick = events.some((e) => e.stage === 'pick_started')
  if (
    (snap.warehouse_stage === 'pick_started' || hasPick) &&
    !hasPacked &&
    snap.warehouse_stage !== 'loaded' &&
    snap.warehouse_stage !== 'departed'
  ) {
    const pickEv = events.find((e) => e.stage === 'pick_started')
    reasons.push({
      id: 'pack_missing',
      label: REASON_LABELS.pack_missing,
      evidence: 'Picking has started; packing not recorded yet.',
      source: 'Warehouse update',
      updated_at_utc: pickEv?.recorded_at_utc ?? snap.as_of_utc,
      needsVerification: true,
    })
  }

  if (snap.eta_delay_minutes != null && snap.eta_delay_minutes > 0) {
    const eta = detail.shipment?.latest_eta_update
    reasons.push({
      id: 'eta_delay',
      label: REASON_LABELS.eta_delay,
      evidence: `About ${snap.eta_delay_minutes} min later than promised.`,
      source: eta ? 'Transport update' : 'Order data',
      updated_at_utc: eta?.recorded_at_utc ?? snap.as_of_utc,
      needsVerification: true,
    })
  } else if (
    snap.actual_departure_delay_minutes != null &&
    snap.actual_departure_delay_minutes > 0
  ) {
    reasons.push({
      id: 'departure_delay',
      label: REASON_LABELS.departure_delay,
      evidence: `Left ${snap.actual_departure_delay_minutes} min late.`,
      source: 'Order data',
      updated_at_utc: snap.as_of_utc,
      needsVerification: true,
    })
  }

  return reasons.slice(0, 3)
}

function parseReasonCodes(detail: CaseDetail): string[] {
  try {
    const parsed = JSON.parse(detail.risk_score.reason_codes_json) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.map((x) => String(x)).filter(Boolean).slice(0, 3)
  } catch {
    return []
  }
}

function humanizeCode(code: string): string {
  return code.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export const WAREHOUSE_MILESTONES: {
  stage: WarehouseStage
  label: string
}[] = [
  { stage: 'waiting', label: 'Ready' },
  { stage: 'pick_started', label: 'Pick started' },
  { stage: 'packed', label: 'Pack completed' },
  { stage: 'loaded', label: 'Loaded' },
]

export type RecommendationViewStatus =
  | 'checking'
  | 'ready'
  | 'incomplete'
  | 'unavailable'

export type ParsedRecommendationOutput = {
  summary: string | null
  supporting_evidence_ids: string[]
  missing_information: string[]
  suggested_owner: string | null
  suggested_response_deadline: string | null
  requires_human_review: boolean
  error: string | null
}

export function recommendationUiStatus(
  detail: CaseDetail,
): RecommendationViewStatus {
  const rec = detail.agent_recommendation
  if (!rec) return 'unavailable'
  if (rec.validation_status === 'valid' && rec.action_id) return 'ready'
  if (rec.validation_status === 'invalid') return 'incomplete'
  if (rec.validation_status === 'unavailable') return 'unavailable'
  if (rec.validation_status === 'valid' && !rec.action_id) return 'incomplete'
  return 'checking'
}

/**
 * F8: do not invite decide on delivered / cancelled episodes.
 * History remains available separately.
 */
export function decisionBlockedReason(detail: CaseDetail): string | null {
  if (detail.customer_order.cancelled_at_utc) {
    return 'Order is cancelled — you can no longer record a decision on the earlier suggestion.'
  }
  const ship = detail.shipment?.status
  if (ship === 'delivered') {
    return 'Shipment is delivered — you can no longer approve or dismiss the earlier suggestion. See Alert history for the record.'
  }
  if (ship === 'cancelled') {
    return 'Shipment is cancelled — you can no longer choose an action for this suggestion.'
  }
  return null
}

/** Missing promised window: do not treat model Low/Med/High as a safe assessment. */
export function canAssessRisk(detail: CaseDetail): boolean {
  return detail.promise_version != null
}

export function parseRecommendationOutput(
  detail: CaseDetail,
): ParsedRecommendationOutput {
  const raw = detail.agent_recommendation?.output_json
  const empty: ParsedRecommendationOutput = {
    summary: null,
    supporting_evidence_ids: [],
    missing_information: [],
    suggested_owner: null,
    suggested_response_deadline: null,
    requires_human_review: false,
    error: null,
  }
  if (!raw) return empty
  try {
    const o = JSON.parse(raw) as Record<string, unknown>
    return {
      summary: typeof o.summary === 'string' ? o.summary : null,
      supporting_evidence_ids: Array.isArray(o.supporting_evidence_ids)
        ? o.supporting_evidence_ids.map(String)
        : [],
      missing_information: Array.isArray(o.missing_information)
        ? o.missing_information.map(String)
        : [],
      suggested_owner:
        typeof o.suggested_owner === 'string' ? o.suggested_owner : null,
      suggested_response_deadline:
        typeof o.suggested_response_deadline === 'string'
          ? o.suggested_response_deadline
          : null,
      requires_human_review: Boolean(o.requires_human_review),
      error: typeof o.error === 'string' ? o.error : null,
    }
  } catch {
    return { ...empty, error: 'Could not read this suggestion' }
  }
}

export function playbookLabel(action: PlaybookActionId | null): string {
  if (!action) return 'No suggestion yet'
  return decisionPlaybookLabel(action)
}

export type RiskHistoryEvent = {
  id: string
  at_utc: string
  label: string
  detail: string
}

export function buildRiskHistory(detail: CaseDetail): RiskHistoryEvent[] {
  const events: RiskHistoryEvent[] = [
    {
      id: 'episode-open',
      at_utc: detail.risk_episode.opened_at_utc,
      label: 'Alert opened',
      detail: '',
    },
    {
      id: 'score',
      at_utc: detail.risk_score.scored_at_utc,
      label: 'Chance of delay checked',
      detail: `${Math.round(detail.risk_score.p_late * 100)}% · ${RISK_BAND_SHORT[detail.risk_band] ?? detail.risk_band}`,
    },
  ]
  if (detail.agent_recommendation?.action_id) {
    events.push({
      id: 'rec',
      at_utc: detail.agent_recommendation.created_at_utc,
      label: 'Suggestion',
      detail: playbookLabel(detail.agent_recommendation.action_id),
    })
  }
  if (detail.simulated_notification?.acknowledged_at_utc) {
    events.push({
      id: 'ack',
      at_utc: detail.simulated_notification.acknowledged_at_utc,
      label: 'Marked as seen',
      detail: '',
    })
  }
  if (detail.planner_feedback) {
    events.push({
      id: 'feedback',
      at_utc: detail.planner_feedback.recorded_at_utc,
      label: 'Decision saved',
      detail: detail.planner_feedback.chosen_action_id
        ? playbookLabel(detail.planner_feedback.chosen_action_id)
        : 'Dismissed',
    })
  }
  return events.sort(
    (a, b) => Date.parse(a.at_utc) - Date.parse(b.at_utc),
  )
}

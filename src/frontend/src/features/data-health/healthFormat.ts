import { DATA_STALE_MINUTES, type DataHealthSnapshot } from '@/shared/types'

/** Doc F7 statuses — a signal may carry more than one. */
export type HealthStatus =
  | 'Fresh'
  | 'Stale'
  | 'Missing'
  | 'Failed'
  | 'Partial'

/** Doc F7 AI assist: Available / Unavailable / Incomplete. */
export type AiAssistStatus = 'Available' | 'Unavailable' | 'Incomplete'

export function formatUtc(iso: string | null | undefined): string {
  if (!iso) return 'No data'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toISOString().replace('T', ' ').slice(0, 16) + 'Z'
}

export function ageMinutes(
  iso: string | null | undefined,
  now = Date.now(),
): number | null {
  if (!iso) return null
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return null
  return Math.max(0, Math.round((now - t) / 60_000))
}

export function formatAge(iso: string | null | undefined, now = Date.now()): string {
  const mins = ageMinutes(iso, now)
  if (mins == null) return '—'
  if (mins < 60) return `${mins} min ago`
  const hours = Math.round(mins / 60)
  if (hours < 48) return `${hours} h ago`
  return `${Math.round(hours / 24)} d ago`
}

/** Worst-first when collapsing badges for summary views. */
export function primaryStatus(statuses: HealthStatus[]): HealthStatus {
  const order: HealthStatus[] = ['Failed', 'Missing', 'Stale', 'Partial', 'Fresh']
  for (const s of order) {
    if (statuses.includes(s)) return s
  }
  return 'Fresh'
}

export function isTimestampStale(
  iso: string | null | undefined,
  staleAfterMinutes = DATA_STALE_MINUTES,
  now = Date.now(),
): boolean {
  if (!iso) return true
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return true
  return (now - t) / 60_000 >= staleAfterMinutes
}

export function aiAssistStatus(snap: DataHealthSnapshot): AiAssistStatus {
  if (!snap.agent_enabled) return 'Unavailable'
  if (
    snap.agent_run_failed_count > 0 ||
    snap.recommendation_unavailable_count > 0
  ) {
    return 'Unavailable'
  }
  if (
    snap.recommendation_invalid_count > 0 ||
    isTimestampStale(snap.agent_recommendation_latest_utc, snap.stale_after_minutes)
  ) {
    return 'Incomplete'
  }
  if (!snap.agent_recommendation_latest_utc) return 'Incomplete'
  return 'Available'
}

export type HealthSignal = {
  id: string
  label: string
  /** Who should act when this feed breaks (operator table). */
  ownerHint: string
  /** Session scope note — country/warehouse when DB exposes it. */
  scopeHint: string
  at_utc: string | null
  /**
   * Last known successful observation in session DB.
   * MVP: same clock as at_utc (no separate success vs attempt columns).
   */
  last_success_utc: string | null
  statuses: HealthStatus[]
  errorHint: string | null
  /** Plain-language impact for operators / leads. */
  affectedHint: string | null
  /** Count of affected records when measurable. */
  affectedCount: number | null
}

function baseStatuses(
  at_utc: string | null,
  staleAfter: number,
): HealthStatus[] {
  if (!at_utc) return ['Missing']
  if (isTimestampStale(at_utc, staleAfter)) return ['Stale']
  return ['Fresh']
}

const SESSION_SCOPE = 'Session WH (demo)'

export function buildHealthSignals(snap: DataHealthSnapshot): HealthSignal[] {
  const m = snap.stale_after_minutes

  const erpStatuses = baseStatuses(snap.order_snapshot_latest_utc, m)
  if (snap.missing_promise_count > 0 && !erpStatuses.includes('Partial')) {
    erpStatuses.push('Partial')
  }

  const aiStatuses: HealthStatus[] = []
  if (!snap.agent_enabled) aiStatuses.push('Failed')
  if (snap.agent_run_failed_count > 0 && !aiStatuses.includes('Failed')) {
    aiStatuses.push('Failed')
  }
  if (snap.recommendation_unavailable_count > 0) {
    aiStatuses.push('Partial')
  }
  if (snap.recommendation_invalid_count > 0 && !aiStatuses.includes('Partial')) {
    aiStatuses.push('Partial')
  }
  const recBase = baseStatuses(snap.agent_recommendation_latest_utc, m)
  for (const s of recBase) {
    if (!aiStatuses.includes(s)) aiStatuses.push(s)
  }
  if (aiStatuses.length === 0) aiStatuses.push('Fresh')

  return [
    {
      id: 'erp',
      label: 'ERP / order snapshot',
      ownerHint: 'IT / data operator',
      scopeHint: SESSION_SCOPE,
      at_utc: snap.order_snapshot_latest_utc,
      last_success_utc: snap.order_snapshot_latest_utc,
      statuses: erpStatuses,
      errorHint:
        snap.missing_promise_count > 0
          ? `${snap.missing_promise_count} active order(s) missing promise_version`
          : null,
      affectedHint:
        snap.missing_promise_count > 0
          ? 'Cannot assess — promised window missing'
          : null,
      affectedCount:
        snap.missing_promise_count > 0 ? snap.missing_promise_count : null,
    },
    {
      id: 'stock',
      label: 'Stock events',
      ownerHint: 'IT / WMS',
      scopeHint: SESSION_SCOPE,
      at_utc: snap.stock_event_latest_utc,
      last_success_utc: snap.stock_event_latest_utc,
      statuses: baseStatuses(snap.stock_event_latest_utc, m),
      errorHint: null,
      affectedHint: null,
      affectedCount: null,
    },
    {
      id: 'wms',
      label: 'WMS / warehouse events',
      ownerHint: 'IT / WMS',
      scopeHint: SESSION_SCOPE,
      at_utc: snap.warehouse_event_latest_utc,
      last_success_utc: snap.warehouse_event_latest_utc,
      statuses: baseStatuses(snap.warehouse_event_latest_utc, m),
      errorHint: null,
      affectedHint: 'May misread pick/pack/load progress',
      affectedCount: null,
    },
    {
      id: 'tms',
      label: 'TMS / carrier ETA',
      ownerHint: 'IT / transport',
      scopeHint: SESSION_SCOPE,
      at_utc: snap.eta_update_latest_utc,
      last_success_utc: snap.eta_update_latest_utc,
      statuses: baseStatuses(snap.eta_update_latest_utc, m),
      errorHint: null,
      affectedHint: 'ETA may no longer be trustworthy — verify in TMS',
      affectedCount: null,
    },
    {
      id: 'weather',
      label: 'Weather',
      ownerHint: 'IT / data operator',
      scopeHint: SESSION_SCOPE,
      at_utc: snap.weather_latest_utc,
      last_success_utc: snap.weather_latest_utc,
      statuses: baseStatuses(snap.weather_latest_utc, m),
      errorHint: null,
      affectedHint: !snap.weather_latest_utc
        ? 'Supplemental evidence incomplete'
        : null,
      affectedCount: null,
    },
    {
      id: 'holiday',
      label: 'Holiday',
      ownerHint: 'IT / data operator',
      scopeHint: SESSION_SCOPE,
      at_utc: snap.holiday_latest_utc,
      last_success_utc: snap.holiday_latest_utc,
      statuses: baseStatuses(snap.holiday_latest_utc, m),
      errorHint: null,
      affectedHint: null,
      affectedCount: null,
    },
    {
      id: 'travel',
      label: 'Maps / travel',
      ownerHint: 'IT / data operator',
      scopeHint: SESSION_SCOPE,
      at_utc: snap.travel_latest_utc,
      last_success_utc: snap.travel_latest_utc,
      statuses: baseStatuses(snap.travel_latest_utc, m),
      errorHint: null,
      affectedHint: null,
      affectedCount: null,
    },
    {
      id: 'scoring',
      label: 'Risk scoring',
      ownerHint: 'IT / ML ops',
      scopeHint: SESSION_SCOPE,
      at_utc: snap.risk_score_latest_utc,
      last_success_utc: snap.risk_score_latest_utc,
      statuses: (() => {
        const s = baseStatuses(snap.risk_score_latest_utc, m)
        if (snap.stale_score_count > 0 && !s.includes('Partial')) s.push('Partial')
        return s
      })(),
      errorHint:
        snap.stale_score_count > 0
          ? `${snap.stale_score_count} active score(s) older than ${m}m`
          : null,
      affectedHint: 'Scores may not reflect newest feeds',
      affectedCount:
        snap.stale_score_count > 0 ? snap.stale_score_count : null,
    },
    {
      id: 'ai',
      label: 'AI assist',
      ownerHint: 'IT / agent ops',
      scopeHint: SESSION_SCOPE,
      at_utc: snap.agent_recommendation_latest_utc,
      last_success_utc: snap.agent_recommendation_latest_utc,
      statuses: aiStatuses,
      errorHint: !snap.agent_enabled
        ? 'Agent disabled (session)'
        : snap.agent_run_failed_count > 0
          ? `${snap.agent_run_failed_count} failed run(s)`
          : snap.recommendation_unavailable_count > 0
            ? `${snap.recommendation_unavailable_count} unavailable`
            : null,
      affectedHint: !snap.agent_enabled
        ? 'Manual review'
        : 'No full suggestion — continue manual review',
      affectedCount: (() => {
        const n =
          snap.recommendation_unavailable_count +
          snap.recommendation_invalid_count
        return n > 0 ? n : null
      })(),
    },
  ]
}

export function statusBadgeClass(status: HealthStatus): string {
  switch (status) {
    case 'Fresh':
      return 'border-risk-low/30 bg-risk-low/10 text-foreground'
    case 'Stale':
    case 'Partial':
      return 'border-risk-medium/30 bg-risk-medium/10 text-foreground'
    case 'Missing':
    case 'Failed':
      return 'border-risk-high/30 bg-risk-high/10 text-foreground'
  }
}

export function aiAssistBadgeClass(status: AiAssistStatus): string {
  switch (status) {
    case 'Available':
      return 'border-risk-low/30 bg-risk-low/10 text-foreground'
    case 'Incomplete':
      return 'border-risk-medium/30 bg-risk-medium/10 text-foreground'
    case 'Unavailable':
      return 'border-risk-high/30 bg-risk-high/10 text-foreground'
  }
}

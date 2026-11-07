import { DATA_STALE_MINUTES, type DataHealthSnapshot } from '@/shared/types'

export function formatUtc(iso: string | null | undefined): string {
  if (!iso) return 'No data'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toISOString().replace('T', ' ').slice(0, 16) + 'Z'
}

export function formatAge(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return '—'
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return '—'
  const mins = Math.max(0, Math.round((now - t) / 60_000))
  if (mins < 60) return `${mins} min ago`
  const hours = Math.round(mins / 60)
  if (hours < 48) return `${hours} h ago`
  return `${Math.round(hours / 24)} d ago`
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

export type HealthSignal = {
  id: string
  label: string
  sourceHint: string
  at_utc: string | null
  stale: boolean
}

export function buildHealthSignals(snap: DataHealthSnapshot): HealthSignal[] {
  const m = snap.stale_after_minutes
  return [
    {
      id: 'wms',
      label: 'WMS / warehouse events',
      sourceHint: 'MAX(warehouse_event.recorded_at_utc)',
      at_utc: snap.warehouse_event_latest_utc,
      stale: isTimestampStale(snap.warehouse_event_latest_utc, m),
    },
    {
      id: 'tms',
      label: 'TMS / carrier ETA',
      sourceHint: 'MAX(eta_update.recorded_at_utc)',
      at_utc: snap.eta_update_latest_utc,
      stale: isTimestampStale(snap.eta_update_latest_utc, m),
    },
    {
      id: 'weather',
      label: 'Weather feed',
      sourceHint: 'MAX(weather_observation.fetched_at_utc)',
      at_utc: snap.weather_latest_utc,
      stale: isTimestampStale(snap.weather_latest_utc, m),
    },
    {
      id: 'holiday',
      label: 'Holiday feed',
      sourceHint: 'MAX(holiday_observation.fetched_at_utc)',
      at_utc: snap.holiday_latest_utc,
      stale: isTimestampStale(snap.holiday_latest_utc, m),
    },
    {
      id: 'travel',
      label: 'Maps / travel',
      sourceHint: 'MAX(travel_observation.fetched_at_utc)',
      at_utc: snap.travel_latest_utc,
      stale: isTimestampStale(snap.travel_latest_utc, m),
    },
    {
      id: 'scoring',
      label: 'Last scoring run',
      sourceHint: 'MAX(risk_score.scored_at_utc)',
      at_utc: snap.risk_score_latest_utc,
      stale: isTimestampStale(snap.risk_score_latest_utc, m),
    },
    {
      id: 'agent_rec',
      label: 'Last agent recommendation',
      sourceHint: 'MAX(agent_recommendation.created_at_utc)',
      at_utc: snap.agent_recommendation_latest_utc,
      stale: isTimestampStale(snap.agent_recommendation_latest_utc, m),
    },
  ]
}

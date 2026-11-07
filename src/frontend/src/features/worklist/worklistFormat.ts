import {
  DATA_STALE_MINUTES,
  type WorklistRow,
} from '@/shared/types'

export function parseReasonCodes(row: WorklistRow): string[] {
  try {
    const parsed = JSON.parse(row.risk_score.reason_codes_json) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((x) => String(x))
      .filter(Boolean)
      .slice(0, 3)
  } catch {
    return []
  }
}

export function isScoreStale(row: WorklistRow, now = Date.now()): boolean {
  const scored = Date.parse(row.risk_score.scored_at_utc)
  if (Number.isNaN(scored)) return false
  return (now - scored) / 60_000 >= DATA_STALE_MINUTES
}

export function formatPromiseWindow(row: WorklistRow): string {
  const pv = row.promise_version
  if (!pv) return 'Promise missing'
  const start = formatUtcShort(pv.window_start_utc)
  const end = formatUtcShort(pv.window_end_utc)
  return `${start} → ${end}`
}

/** Time left derived from order_snapshot.hours_to_deadline (schema field). */
export function formatTimeLeft(row: WorklistRow): {
  label: string
  kind: 'hours_to_deadline'
} {
  const h = row.order_snapshot.hours_to_deadline
  if (h == null || Number.isNaN(h)) {
    return { label: '—', kind: 'hours_to_deadline' }
  }
  if (h < 0) {
    return {
      label: `${Math.abs(h).toFixed(1)}h past promise end`,
      kind: 'hours_to_deadline',
    }
  }
  if (h < 1) {
    return {
      label: `${Math.round(h * 60)} min to promise end`,
      kind: 'hours_to_deadline',
    }
  }
  return {
    label: `${h.toFixed(1)} h to promise end`,
    kind: 'hours_to_deadline',
  }
}

export function formatUpdatedAge(iso: string, now = Date.now()): string {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return iso
  const mins = Math.max(0, Math.round((now - t) / 60_000))
  if (mins < 60) return `${mins} min ago`
  const hours = Math.round(mins / 60)
  if (hours < 48) return `${hours} h ago`
  return `${Math.round(hours / 24)} d ago`
}

export function suggestedActionLabel(row: WorklistRow): string {
  const rec = row.agent_recommendation
  if (!rec) return 'No suggestion yet'
  if (rec.action_id) return rec.action_id
  return rec.validation_status === 'unavailable'
    ? 'No suggestion yet'
    : rec.validation_status
}

export function isUnacknowledged(row: WorklistRow): boolean {
  return (
    row.simulated_notification != null &&
    row.simulated_notification.acknowledged_at_utc == null
  )
}

function formatUtcShort(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toISOString().replace('T', ' ').slice(0, 16) + 'Z'
}

import type { CaseDetail } from '@/shared/types'
import { DATA_STALE_MINUTES } from '@/shared/types'
import { isScoreStale } from '@/features/case-detail/caseFormat'

type Props = { detail: CaseDetail }

/** At most one short warning — avoid stacking long banners. */
export function CaseDataHealthBanners({ detail }: Props) {
  const messages: string[] = []

  if (!detail.promise_version) {
    messages.push('Promised delivery time is missing — hard to judge delay risk.')
  }

  const etaAt = detail.shipment?.latest_eta_update?.recorded_at_utc ?? null
  const etaStale =
    etaAt != null &&
    !Number.isNaN(Date.parse(etaAt)) &&
    (Date.now() - Date.parse(etaAt)) / 60_000 >= DATA_STALE_MINUTES

  if (etaStale || isScoreStale(detail)) {
    messages.push('Some details may be outdated — confirm before you act.')
  } else if (detail.shipment && !etaAt) {
    messages.push('No arrival-time update yet — check transport if needed.')
  }

  if (messages.length === 0) return null

  return (
    <p
      className="rounded-sm border border-risk-medium/40 bg-risk-medium/10 px-3 py-2 text-sm"
      role="status"
    >
      {messages[0]}
    </p>
  )
}

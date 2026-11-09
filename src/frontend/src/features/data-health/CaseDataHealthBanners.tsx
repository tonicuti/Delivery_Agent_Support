import type { CaseDetail } from '@/shared/types'
import { DATA_STALE_MINUTES } from '@/shared/types'
import { isScoreStale } from '@/features/case-detail/caseFormat'
import { formatAge } from './healthFormat'

type Props = { detail: CaseDetail }

/**
 * Case-level (dispatcher) warnings — short, actionable, no internal feed dump.
 * Copy aligned with F7 + worklist/caseFormat promised-window messaging.
 */
export function CaseDataHealthBanners({ detail }: Props) {
  const banners: { id: string; text: string }[] = []

  if (!detail.promise_version) {
    banners.push({
      id: 'promise',
      text: 'Cannot assess — promised window missing',
    })
  }

  const etaAt = detail.shipment?.latest_eta_update?.recorded_at_utc ?? null
  if (etaAt) {
    const ageMin = (Date.now() - Date.parse(etaAt)) / 60_000
    if (!Number.isNaN(ageMin) && ageMin >= DATA_STALE_MINUTES) {
      banners.push({
        id: 'eta-stale',
        text: `Transport data is outdated. Last successful update: ${Math.round(ageMin)} minutes ago. Verify the current ETA in TMS before acting.`,
      })
    }
  } else if (detail.shipment) {
    banners.push({
      id: 'eta-missing',
      text: 'No ETA update received for this shipment. Verify transport status in TMS before acting.',
    })
  }

  if (isScoreStale(detail)) {
    banners.push({
      id: 'score-stale',
      text: `Risk score is older than ${DATA_STALE_MINUTES} minutes (scored ${formatAge(detail.risk_score.scored_at_utc)}). Confirm evidence freshness before deciding.`,
    })
  }

  if (banners.length === 0) return null

  return (
    <div className="space-y-2" aria-label="Data health warnings">
      {banners.map((b) => (
        <p
          key={b.id}
          className="rounded-sm border border-risk-medium/40 bg-risk-medium/10 px-3 py-2 text-sm"
          role="status"
        >
          {b.text}
        </p>
      ))}
    </div>
  )
}

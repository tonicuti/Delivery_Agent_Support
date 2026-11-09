import { Badge } from '@/shared/ui/badge'

type Props = {
  activeCount: number
  unacknowledgedCount: number
  acknowledgedActiveCount: number
  staleScoreCount: number
  visibleCount: number
}

/**
 * Compact strip for dispatcher scan — avoid duplicating Active/Visible/Acked.
 */
export function WorklistSummary({
  activeCount,
  unacknowledgedCount,
  acknowledgedActiveCount,
  staleScoreCount,
  visibleCount,
}: Props) {
  return (
    <div
      className="flex flex-wrap items-center gap-2"
      role="status"
      aria-label="Worklist summary for current scope"
    >
      <Badge
        variant="secondary"
        title={`${visibleCount} matching filters · ${activeCount} active in scope · ${acknowledgedActiveCount} acknowledged`}
      >
        Needs attention: {visibleCount}
      </Badge>
      {unacknowledgedCount > 0 ? (
        <Badge
          variant="outline"
          title="simulated_notification not acknowledged"
        >
          Unacked: {unacknowledgedCount}
        </Badge>
      ) : null}
      {staleScoreCount > 0 ? (
        <Badge
          variant="outline"
          className="text-risk-medium"
          title="risk_score older than stale threshold"
        >
          Stale scores: {staleScoreCount}
        </Badge>
      ) : null}
    </div>
  )
}

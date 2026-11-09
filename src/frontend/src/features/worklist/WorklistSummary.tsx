import { Badge } from '@/shared/ui/badge'
import { UI } from '@/shared/uiLabels'

type Props = {
  activeCount: number
  unacknowledgedCount: number
  acknowledgedActiveCount: number
  staleScoreCount: number
  visibleCount: number
}

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
      aria-label="Summary for orders needing attention"
    >
      <Badge
        variant="secondary"
        title={`${visibleCount} matching filters · ${activeCount} open · ${acknowledgedActiveCount} marked as seen`}
      >
        Needs attention: {visibleCount}
      </Badge>
      {unacknowledgedCount > 0 ? (
        <Badge variant="outline" title="Alerts not marked as seen yet">
          {UI.unread}: {unacknowledgedCount}
        </Badge>
      ) : null}
      {staleScoreCount > 0 ? (
        <Badge
          variant="outline"
          className="text-risk-medium"
          title="Last check is older than usual — double-check before you act"
        >
          {UI.outdated}: {staleScoreCount}
        </Badge>
      ) : null}
    </div>
  )
}

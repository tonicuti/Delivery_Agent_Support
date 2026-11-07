import { Badge } from '@/shared/ui/badge'

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
      className="flex flex-wrap gap-2"
      role="status"
      aria-label="Worklist summary for current scope"
    >
      <Badge variant="secondary">Visible: {visibleCount}</Badge>
      <Badge variant="outline" title="worklist_item.status = active">
        Active: {activeCount}
      </Badge>
      <Badge variant="outline" title="simulated_notification not acknowledged">
        Unacknowledged: {unacknowledgedCount}
      </Badge>
      <Badge variant="outline" title="active and notification acknowledged">
        Acknowledged: {acknowledgedActiveCount}
      </Badge>
      <Badge variant="outline" title={`risk_score older than stale threshold`}>
        Stale scores: {staleScoreCount}
      </Badge>
    </div>
  )
}

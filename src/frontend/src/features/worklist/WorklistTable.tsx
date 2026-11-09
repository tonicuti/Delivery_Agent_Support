import { Button } from '@/shared/ui/button'
import { Badge } from '@/shared/ui/badge'
import { RiskBadge } from '@/shared/ui/risk-badge'
import { UI, warehouseStageLabel } from '@/shared/uiLabels'
import type { WorklistRow } from '@/shared/types'
import {
  formatPromiseWindow,
  formatTimeLeft,
  formatUpdatedAge,
  isScoreStale,
  isUnacknowledged,
  parseReasonCodes,
  suggestedActionLabel,
} from './worklistFormat'

type Props = {
  rows: WorklistRow[]
  onReview: (orderId: number) => void
  onAcknowledge: (row: WorklistRow) => void
  onRestoreAlert: (row: WorklistRow) => void
  pendingNotificationId: string | null
}

export function WorklistTable({
  rows,
  onReview,
  onAcknowledge,
  onRestoreAlert,
  pendingNotificationId,
}: Props) {
  return (
    <div className="overflow-x-auto rounded-sm border border-border bg-card">
      <table className="w-full min-w-[56rem] text-left text-sm">
        <thead className="border-b border-border bg-muted/60 text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">#</th>
            <th className="px-3 py-2 font-medium">{UI.orderNumber}</th>
            <th className="px-3 py-2 font-medium">Customer</th>
            <th className="px-3 py-2 font-medium">
              {UI.promisedDelivery} / {UI.timeLeft}
            </th>
            <th className="px-3 py-2 font-medium">{UI.chanceOfDelay}</th>
            <th className="px-3 py-2 font-medium">Reasons</th>
            <th className="px-3 py-2 font-medium">Progress</th>
            <th className="px-3 py-2 font-medium">{UI.suggestedNextStep}</th>
            <th className="px-3 py-2 font-medium">{UI.alerts}</th>
            <th className="px-3 py-2 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const reasons = parseReasonCodes(row)
            const timeLeft = formatTimeLeft(row)
            const stale = isScoreStale(row)
            const unacked = isUnacknowledged(row)
            const episodeId = row.worklist_item.episode_id
            const aiUnavailable =
              row.agent_recommendation?.validation_status === 'unavailable'
            const chancePct = Math.round(row.risk_score.p_late * 100)

            return (
              <tr
                key={episodeId}
                className="border-b border-border last:border-0 hover:bg-muted/40"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    onReview(row.customer_order.order_id)
                  }
                }}
              >
                <td
                  className="px-3 py-2 font-mono text-xs"
                  title={`Sorted by chance of delay (~${chancePct}%)`}
                >
                  {index + 1}
                </td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    className="cursor-pointer text-left font-medium text-primary underline-offset-2 hover:underline"
                    onClick={() => onReview(row.customer_order.order_id)}
                  >
                    {row.customer_order.external_order_id}
                  </button>
                </td>
                <td className="px-3 py-2 text-xs">
                  <div>
                    {row.customer.customer_type === 'B2B'
                      ? 'Business'
                      : row.customer.customer_type === 'B2C'
                        ? 'Consumer'
                        : row.customer.customer_type}
                  </div>
                  <div className="text-muted-foreground">
                    {row.customer.external_customer_id}
                  </div>
                </td>
                <td className="px-3 py-2 text-xs">
                  <div className="text-muted-foreground">
                    {formatPromiseWindow(row)}
                  </div>
                  <div
                    className={
                      (row.order_snapshot.hours_to_deadline ?? 0) < 0
                        ? 'font-semibold text-risk-high'
                        : 'font-semibold text-foreground'
                    }
                  >
                    {timeLeft.label}
                  </div>
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-col items-start gap-1">
                    {row.promise_version ? (
                      <span title={`About ${chancePct}% chance of arriving late`}>
                        <RiskBadge risk={row.risk_band} />
                      </span>
                    ) : (
                      <Badge
                        variant="outline"
                        className="text-risk-medium"
                        title={UI.missingPromise}
                      >
                        {UI.notEnoughInfo}
                      </Badge>
                    )}
                    {row.risk_increased ? (
                      <Badge variant="outline" className="text-risk-high">
                        {UI.gettingRiskier}
                      </Badge>
                    ) : null}
                  </div>
                </td>
                <td className="px-3 py-2">
                  {reasons.length === 0 ? (
                    <span className="text-xs text-muted-foreground">—</span>
                  ) : (
                    <ul className="flex max-w-[12rem] flex-col gap-0.5">
                      {reasons.map((r) => (
                        <li key={r}>
                          <Badge variant="outline" className="font-normal">
                            {r}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  )}
                </td>
                <td className="px-3 py-2 text-xs">
                  {warehouseStageLabel(row.order_snapshot.warehouse_stage)}
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {suggestedActionLabel(row)}
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-col items-start gap-0.5">
                    {unacked ? (
                      <Badge variant="secondary">{UI.unread}</Badge>
                    ) : null}
                    {stale ? (
                      <Badge variant="outline" className="text-risk-medium">
                        {UI.outdated}
                      </Badge>
                    ) : null}
                    {aiUnavailable ? (
                      <Badge variant="outline">{UI.noSuggestion}</Badge>
                    ) : null}
                    {!unacked && !stale && !aiUnavailable ? (
                      <span
                        className="text-xs text-muted-foreground"
                        title={`Updated ${formatUpdatedAge(row.worklist_item.updated_at_utc)}`}
                      >
                        {formatUpdatedAge(row.worklist_item.updated_at_utc)}
                      </span>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">
                        {formatUpdatedAge(row.worklist_item.updated_at_utc)}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-col gap-1">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => onReview(row.customer_order.order_id)}
                    >
                      {UI.reviewOrder}
                    </Button>
                    {row.simulated_notification ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className={
                          unacked
                            ? undefined
                            : 'text-muted-foreground line-through opacity-50 hover:opacity-80 hover:line-through'
                        }
                        title={
                          unacked
                            ? UI.markAsSeen
                            : 'Alert marked as seen — click to bring it back'
                        }
                        aria-pressed={!unacked}
                        disabled={
                          pendingNotificationId ===
                          row.simulated_notification.notification_id
                        }
                        onClick={() =>
                          unacked ? onAcknowledge(row) : onRestoreAlert(row)
                        }
                      >
                        {unacked ? UI.markAsSeen : UI.markedSeen}
                      </Button>
                    ) : null}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

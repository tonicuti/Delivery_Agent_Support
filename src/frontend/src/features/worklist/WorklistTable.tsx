import { Button } from '@/shared/ui/button'
import { Badge } from '@/shared/ui/badge'
import { RiskBadge } from '@/shared/ui/risk-badge'
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
      <table className="w-full min-w-[72rem] text-left text-sm">
        <thead className="border-b border-border bg-muted/60 text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">#</th>
            <th className="px-3 py-2 font-medium">Order</th>
            <th className="px-3 py-2 font-medium">Customer</th>
            <th className="px-3 py-2 font-medium">Promise / time left</th>
            <th className="px-3 py-2 font-medium">Risk</th>
            <th className="px-3 py-2 font-medium">Reasons</th>
            <th className="px-3 py-2 font-medium">Stage</th>
            <th className="px-3 py-2 font-medium">Suggested action</th>
            <th className="px-3 py-2 font-medium">Work</th>
            <th className="px-3 py-2 font-medium">Updated</th>
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
                  title="Rank by p_late descending (model late probability)"
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
                  <div className="font-mono text-xs text-muted-foreground">
                    order_id {row.customer_order.order_id}
                  </div>
                </td>
                <td className="px-3 py-2 text-xs">
                  <div>{row.customer.customer_type}</div>
                  <div className="text-muted-foreground">
                    {row.customer.external_customer_id}
                  </div>
                </td>
                <td className="px-3 py-2 text-xs">
                  <div>{formatPromiseWindow(row)}</div>
                  <div
                    className="text-muted-foreground"
                    title="From order_snapshot.hours_to_deadline"
                  >
                    {timeLeft.label}
                  </div>
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-col items-start gap-1">
                    <RiskBadge risk={row.risk_band} />
                    <span className="font-mono text-xs text-muted-foreground">
                      p_late {row.risk_score.p_late.toFixed(3)}
                    </span>
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
                  {row.order_snapshot.warehouse_stage ?? '—'}
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {suggestedActionLabel(row)}
                </td>
                <td className="px-3 py-2 text-xs">
                  <div>{row.worklist_item.status}</div>
                  {unacked ? (
                    <Badge variant="secondary" className="mt-1">
                      Unacked alert
                    </Badge>
                  ) : null}
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  <div>{formatUpdatedAge(row.worklist_item.updated_at_utc)}</div>
                  {stale ? (
                    <Badge variant="outline" className="mt-1 text-risk-medium">
                      Stale score
                    </Badge>
                  ) : null}
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-col gap-1">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => onReview(row.customer_order.order_id)}
                    >
                      Review case
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
                            ? 'Mark alert as seen'
                            : 'Alert acknowledged — click to bring it back'
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
                        Acknowledge
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

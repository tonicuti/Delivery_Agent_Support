import { Link } from 'react-router-dom'
import type { CaseDetail } from '@/shared/types'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { RiskBadge } from '@/shared/ui/risk-badge'
import { warehouseStageLabel } from '@/shared/uiLabels'
import {
  canAssessRisk,
  decisionBlockedReason,
  formatPromiseWindow,
  formatTimeLeft,
  isScoreStale,
} from './caseFormat'

type Props = {
  detail: CaseDetail
  backTo: string
  onDecide?: () => void
}

export function CaseHeader({ detail, backTo, onDecide }: Props) {
  const timeLeft = formatTimeLeft(detail)
  const stale = isScoreStale(detail)
  const assessOk = canAssessRisk(detail)
  const blocked = decisionBlockedReason(detail)
  const past =
    detail.order_snapshot.hours_to_deadline != null &&
    detail.order_snapshot.hours_to_deadline < 0

  return (
    <header className="space-y-3 border-b border-border pb-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          to={backTo}
          className="inline-flex h-8 cursor-pointer items-center rounded-sm border border-border bg-card px-3 text-sm hover:bg-muted"
        >
          ← Back to orders
        </Link>
        {blocked ? (
          <p className="max-w-sm text-right text-xs text-muted-foreground">
            {blocked}
          </p>
        ) : (
          <Button type="button" size="sm" onClick={onDecide}>
            Choose action
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h1 className="text-xl font-semibold tracking-tight">
          {detail.customer_order.external_order_id}
        </h1>
        {assessOk ? (
          <RiskBadge risk={detail.risk_band} />
        ) : (
          <Badge variant="outline" className="text-risk-medium">
            Not enough info
          </Badge>
        )}
        {detail.risk_increased ? (
          <Badge variant="outline" className="text-risk-high">
            Getting riskier
          </Badge>
        ) : null}
        {stale ? (
          <Badge variant="outline" className="text-risk-medium">
            Outdated
          </Badge>
        ) : null}
      </div>

      <p className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm text-muted-foreground">
        <span>{formatPromiseWindow(detail)}</span>
        <span
          className={
            past ? 'font-semibold text-risk-high' : 'font-semibold text-foreground'
          }
        >
          {timeLeft.label}
        </span>
        <span>
          Now:{' '}
          <span className="text-foreground">
            {warehouseStageLabel(detail.order_snapshot.warehouse_stage)}
          </span>
        </span>
      </p>
    </header>
  )
}

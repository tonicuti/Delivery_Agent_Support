import { Link } from 'react-router-dom'
import type { CaseDetail } from '@/shared/types'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { RiskBadge } from '@/shared/ui/risk-badge'
import {
  canAssessRisk,
  decisionBlockedReason,
  formatAge,
  formatPromiseWindow,
  formatTimeLeft,
  formatUtc,
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
  const erpHref = `#demo-erp-${detail.customer_order.external_order_id}`
  const tmsHref = `#demo-tms-${detail.shipment?.shipment_id ?? detail.customer_order.order_id}`

  return (
    <header className="sticky top-0 z-20 -mx-4 space-y-2 border-b border-border bg-background/95 px-4 py-3 backdrop-blur-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          to={backTo}
          className="inline-flex h-8 cursor-pointer items-center rounded-sm border border-border bg-card px-3 text-sm hover:bg-muted"
        >
          ← Back to worklist
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={erpHref}
            className="text-xs text-muted-foreground underline-offset-2 hover:underline"
            title="Demo deep link — not connected to a live ERP"
          >
            ERP (demo)
          </a>
          <a
            href={tmsHref}
            className="text-xs text-muted-foreground underline-offset-2 hover:underline"
            title="Demo deep link — not connected to a live TMS"
          >
            TMS (demo)
          </a>
          {blocked ? (
            <p className="max-w-xs text-right text-xs text-muted-foreground">
              {blocked}
            </p>
          ) : (
            <Button type="button" size="sm" onClick={onDecide}>
              Decide action
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1
          className="text-xl font-semibold tracking-tight"
          title={`Internal order_id ${detail.customer_order.order_id}`}
        >
          {detail.customer_order.external_order_id}
        </h1>
        {assessOk ? (
          <RiskBadge risk={detail.risk_band} />
        ) : (
          <Badge
            variant="outline"
            className="text-risk-medium"
            title="Cannot assess — promised window missing"
          >
            Cannot assess
          </Badge>
        )}
        {detail.risk_increased ? (
          <Badge variant="outline" className="text-risk-high">
            Risk increased
          </Badge>
        ) : null}
        {stale ? (
          <Badge variant="outline" className="text-risk-medium">
            Stale score
          </Badge>
        ) : null}
      </div>

      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
        <span className="text-muted-foreground">
          {formatPromiseWindow(detail)}
        </span>
        <span
          className={
            past
              ? 'font-semibold text-risk-high'
              : 'font-semibold text-foreground'
          }
          title="From order_snapshot.hours_to_deadline"
        >
          {timeLeft.label}
        </span>
        <span className="text-muted-foreground">
          Stage {detail.order_snapshot.warehouse_stage ?? '—'}
        </span>
      </div>

      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer select-none hover:text-foreground">
          Evidence freshness · technical IDs
        </summary>
        <dl className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 pl-1">
          <div>
            <dt className="inline">Scored </dt>
            <dd className="inline text-foreground">
              {formatUtc(detail.risk_score.scored_at_utc)} (
              {formatAge(detail.risk_score.scored_at_utc)})
            </dd>
          </div>
          <div>
            <dt className="inline">Snapshot </dt>
            <dd className="inline text-foreground">
              {formatUtc(detail.order_snapshot.as_of_utc)}
            </dd>
          </div>
          <div>
            <dt className="inline">p_late </dt>
            <dd className="inline font-mono text-foreground">
              {detail.risk_score.p_late.toFixed(3)}
            </dd>
          </div>
          <div>
            <dt className="inline">order_id </dt>
            <dd className="inline font-mono text-foreground">
              {detail.customer_order.order_id}
            </dd>
          </div>
          <div>
            <dt className="inline">Work </dt>
            <dd className="inline text-foreground">
              {detail.worklist_item.status}
            </dd>
          </div>
        </dl>
      </details>
    </header>
  )
}

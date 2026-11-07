import { Link } from 'react-router-dom'
import type { CaseDetail } from '@/shared/types'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { RiskBadge } from '@/shared/ui/risk-badge'
import {
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
  const erpHref = `#demo-erp-${detail.customer_order.external_order_id}`
  const tmsHref = `#demo-tms-${detail.shipment?.shipment_id ?? detail.customer_order.order_id}`

  return (
    <header className="sticky top-0 z-20 -mx-4 space-y-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur-sm">
      <Link
        to={backTo}
        className="inline-flex h-8 cursor-pointer items-center rounded-sm border border-border bg-card px-3 text-sm hover:bg-muted"
      >
        ← Back to worklist
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight">
              {detail.customer_order.external_order_id}
            </h1>
            <RiskBadge risk={detail.risk_band} />
            <Badge variant="outline">{detail.worklist_item.status}</Badge>
            {stale ? (
              <Badge variant="outline" className="text-risk-medium">
                Stale score
              </Badge>
            ) : null}
          </div>
          <dl className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <div>
              <dt className="inline">order_id </dt>
              <dd className="inline font-mono text-foreground">
                {detail.customer_order.order_id}
              </dd>
            </div>
            <div>
              <dt className="inline">Promise </dt>
              <dd className="inline text-foreground">
                {formatPromiseWindow(detail)}
              </dd>
            </div>
            <div title="From order_snapshot.hours_to_deadline">
              <dt className="inline">Time left </dt>
              <dd className="inline text-foreground">{timeLeft.label}</dd>
            </div>
            <div>
              <dt className="inline">Stage </dt>
              <dd className="inline text-foreground">
                {detail.order_snapshot.warehouse_stage ?? '—'}
              </dd>
            </div>
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
              <span className="ml-1">(model probability)</span>
            </div>
          </dl>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <a
            href={erpHref}
            className="inline-flex h-8 items-center rounded-sm border border-border bg-card px-2.5 text-xs text-muted-foreground hover:bg-muted"
            title="Demo deep link — not connected to a live ERP"
          >
            Open in ERP
            <span className="ml-1 text-[10px]">Demo link (simulated)</span>
          </a>
          <a
            href={tmsHref}
            className="inline-flex h-8 items-center rounded-sm border border-border bg-card px-2.5 text-xs text-muted-foreground hover:bg-muted"
            title="Demo deep link — not connected to a live TMS"
          >
            Open in TMS
            <span className="ml-1 text-[10px]">Demo link (simulated)</span>
          </a>
          <Button type="button" size="sm" onClick={onDecide}>
            Decide action
          </Button>
        </div>
      </div>
    </header>
  )
}

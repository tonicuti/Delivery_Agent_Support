import { Link } from 'react-router-dom'
import type { HistoryRow } from '@/shared/types'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { RiskBadge } from '@/shared/ui/risk-badge'
import { DISMISS_GROUPS } from '@/features/decision/playbooks'
import { executionBadgeLabel } from '@/features/decision/decisionNotes'
import {
  buildHistoryTimeline,
  decisionDetail,
  decisionLabel,
  episodeCloseReason,
  formatUtc,
  intervened,
  lateMinutes,
  outcomeLabel,
  parseReasonCodes,
  recommendedAction,
} from './historyFormat'

type Props = {
  row: HistoryRow
  onClose: () => void
}

export function HistoryDetail({ row, onClose }: Props) {
  const reasons = parseReasonCodes(row)
  const decision = decisionDetail(row)
  const timeline = buildHistoryTimeline(row)
  const late = lateMinutes(row)
  const outcome = outcomeLabel(row)
  const dismissLabel = decision.dismissReason
    ? DISMISS_GROUPS.find((g) => g.id === decision.dismissReason)?.label
    : null

  return (
    <aside
      className="flex max-h-[calc(100vh-8rem)] flex-col overflow-hidden rounded-sm border border-border bg-card"
      aria-label="Episode detail"
    >
      <div className="flex items-start justify-between gap-2 border-b border-border px-3 py-2">
        <div>
          <h2 className="text-sm font-semibold tracking-tight">
            {row.customer_order.external_order_id}
          </h2>
          <p className="font-mono text-xs text-muted-foreground">
            {row.risk_episode.episode_id}
          </p>
        </div>
        <Button type="button" size="sm" variant="ghost" onClick={onClose}>
          Close
        </Button>
      </div>

      <div className="space-y-4 overflow-y-auto p-3 text-sm">
        <div className="flex flex-wrap gap-2">
          <RiskBadge risk={row.risk_band} />
          <Badge variant="outline">{outcome}</Badge>
          {intervened(row) ? <Badge variant="secondary">Intervened</Badge> : null}
        </div>

        <p className="text-xs text-muted-foreground">
          Snapshot and score are from{' '}
          <span className="font-medium text-foreground">opening_score_id</span>{' '}
          (alert-time replay), not live case state. No “Saved by AI” label.
        </p>

        <section className="space-y-1">
          <h3 className="text-xs font-medium text-muted-foreground">At alert</h3>
          <dl className="grid gap-1 text-xs sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Promised to</dt>
              <dd>{formatUtc(row.order_snapshot.promised_to_utc)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Snapshot as_of</dt>
              <dd>{formatUtc(row.order_snapshot.as_of_utc)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">p_late</dt>
              <dd className="font-mono">
                {row.risk_score.p_late.toFixed(3)} (model probability)
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Model</dt>
              <dd className="break-all font-mono text-[10px]">
                {row.risk_score.model_version}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Stage / stock</dt>
              <dd>
                {row.order_snapshot.warehouse_stage ?? '—'} /{' '}
                {row.order_snapshot.stock_status ?? '—'}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Warehouse</dt>
              <dd>{row.order_snapshot.warehouse_name ?? '—'}</dd>
            </div>
          </dl>
          <div className="pt-1">
            <div className="text-xs text-muted-foreground">Reason codes</div>
            {reasons.length === 0 ? (
              <p className="text-xs text-muted-foreground">[] (empty in score)</p>
            ) : (
              <ul className="mt-1 flex flex-wrap gap-1">
                {reasons.map((r) => (
                  <li key={r}>
                    <Badge variant="outline" className="font-mono font-normal">
                      {r}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="space-y-1">
          <h3 className="text-xs font-medium text-muted-foreground">
            Recommendation
          </h3>
          <p className="text-xs">{recommendedAction(row)}</p>
          {row.agent_recommendation ? (
            <p className="text-xs text-muted-foreground">
              {row.agent_recommendation.validation_status} ·{' '}
              {formatUtc(row.agent_recommendation.created_at_utc)}
            </p>
          ) : null}
        </section>

        <section className="space-y-1">
          <h3 className="text-xs font-medium text-muted-foreground">
            Staff decision
          </h3>
          {!row.planner_feedback ? (
            <p className="text-xs text-muted-foreground">No decision recorded.</p>
          ) : (
            <dl className="grid gap-1 text-xs">
              <div>
                <dt className="text-muted-foreground">Type</dt>
                <dd>{decisionLabel(row)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Chosen action</dt>
                <dd>{decision.chosen}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Role / time</dt>
                <dd>
                  {decision.role ?? '—'} · {formatUtc(decision.at)}
                </dd>
              </div>
              {dismissLabel ? (
                <div>
                  <dt className="text-muted-foreground">Dismiss group</dt>
                  <dd>{dismissLabel}</dd>
                </div>
              ) : null}
              {decision.reason ? (
                <div>
                  <dt className="text-muted-foreground">Reason</dt>
                  <dd>{decision.reason}</dd>
                </div>
              ) : null}
              <div>
                <dt className="text-muted-foreground">Execution</dt>
                <dd>
                  <Badge variant="outline">
                    {executionBadgeLabel(
                      (decision.execution as
                        | 'pending'
                        | 'user_confirmed_performed'
                        | 'unable_to_perform') ?? 'pending',
                    )}
                  </Badge>
                </dd>
              </div>
            </dl>
          )}
        </section>

        <section className="space-y-1">
          <h3 className="text-xs font-medium text-muted-foreground">
            Delivery outcome
          </h3>
          <p className="text-xs">{outcome}</p>
          <p className="text-xs text-muted-foreground">
            Promise end {formatUtc(row.order_snapshot.promised_to_utc)} · Actual{' '}
            {formatUtc(
              row.original_delivery_outcome?.original_completed_at_utc,
            )}
            {late != null ? ` · Δ ${late} min` : ''}
          </p>
          <p className="text-xs text-muted-foreground">{episodeCloseReason(row)}</p>
        </section>

        <section className="space-y-2">
          <h3 className="text-xs font-medium text-muted-foreground">
            Timeline (discrete)
          </h3>
          <ol className="space-y-2 border-l border-border pl-3">
            {timeline.map((ev) => (
              <li key={ev.id} className="relative text-xs">
                <span
                  className="absolute -left-[0.97rem] top-1 size-2 rounded-full bg-muted-foreground/60"
                  aria-hidden
                />
                <div className="font-medium">{ev.label}</div>
                <div className="text-muted-foreground">
                  {formatUtc(ev.at_utc)} · {ev.detail}
                </div>
              </li>
            ))}
          </ol>
        </section>

        <Link
          to={`/cases/${row.customer_order.order_id}`}
          className="inline-flex h-8 items-center rounded-sm border border-border bg-background px-2.5 text-xs hover:bg-muted"
        >
          Open current case
        </Link>
      </div>
    </aside>
  )
}

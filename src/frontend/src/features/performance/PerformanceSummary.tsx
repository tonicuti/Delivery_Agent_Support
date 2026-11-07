import { Badge } from '@/shared/ui/badge'
import type { PerformanceSummary as Summary } from './performanceFormat'

type Props = { summary: Summary }

export function PerformanceSummaryView({ summary }: Props) {
  return (
    <div className="space-y-4">
      <div className="rounded-sm border border-border bg-card px-3 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-semibold">External dashboard</h2>
          <Badge variant="outline">Demo</Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          This app is not a Power BI clone. Use the link below for full reporting.
        </p>
        <a
          href="https://app.powerbi.com/demo"
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex h-9 items-center rounded-sm border border-border bg-background px-3 text-sm hover:bg-muted"
        >
          Open Power BI (demo)
          <span className="ml-2 text-xs text-muted-foreground">
            placeholder URL
          </span>
        </a>
      </div>

      <p className="text-xs text-muted-foreground">
        Period: {summary.periodLabel}. Scope: {summary.scopeLabel}. Counts are
        derived from session history / worklist — definitions tip on each card.
        There is no “Saved by AI” metric.
      </p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard
          title="Flagged (active worklist)"
          value={String(summary.flagged_active)}
          tip="worklist summary.active_count for current session scope"
        />
        <MetricCard
          title="Awaiting delivery outcome"
          value={String(summary.awaiting_outcome)}
          tip="Episodes with no original_delivery_outcome / unknown — never auto On time"
        />
        <MetricCard
          title="On time / Late (labeled)"
          value={`${summary.on_time} / ${summary.late}`}
          tip="From original_delivery_outcome.original_late when label_status known"
        />
        <MetricCard
          title="Decisions Approve / Edit / Dismiss"
          value={`${summary.decisions.approve} / ${summary.decisions.edit} / ${summary.decisions.dismiss}`}
          tip="Parsed from planner_feedback.notes decision kind (session)"
        />
        <MetricCard
          title="Intervened episodes"
          value={String(summary.intervened)}
          tip="Episodes with at least one planner_feedback row"
        />
        <MetricCard
          title="OTD lift target"
          value={summary.otd_lift_hypothesis}
          tip="Proposal pilot hypothesis only — not an achieved result"
        />
      </div>

      <p
        className="rounded-sm border border-risk-medium/30 bg-risk-medium/10 px-3 py-2 text-sm"
        role="note"
      >
        Disclaimer: micro-summary is for demo orientation. Treat OTD +3–5pp as a{' '}
        <span className="font-medium">pilot hypothesis</span>, not a delivered
        KPI. Full analytics stay in Power BI (or equivalent).
      </p>
    </div>
  )
}

function MetricCard({
  title,
  value,
  tip,
}: {
  title: string
  value: string
  tip: string
}) {
  return (
    <div
      className="rounded-sm border border-border bg-card px-3 py-3"
      title={tip}
    >
      <div className="text-xs text-muted-foreground">{title}</div>
      <div className="mt-1 text-sm font-medium leading-snug">{value}</div>
      <div className="mt-2 text-[10px] text-muted-foreground">{tip}</div>
    </div>
  )
}

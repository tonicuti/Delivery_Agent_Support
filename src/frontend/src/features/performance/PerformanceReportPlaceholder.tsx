import { Link } from 'react-router-dom'
import { Badge } from '@/shared/ui/badge'
import type { PerformanceSummary as Summary } from './performanceFormat'

type Props = { summary: Summary }

/**
 * In-app stand-in for Power BI — F7 MVP has no real workspace URL.
 * "Open performance report" must open something usable in the demo.
 */
export function PerformanceReportPlaceholder({ summary }: Props) {
  const labeled = summary.on_time + summary.late
  const otdPct =
    labeled > 0
      ? `${Math.round((summary.on_time / labeled) * 100)}%`
      : '—'
  const reviewed =
    summary.decisions.approve +
    summary.decisions.edit +
    summary.decisions.dismiss

  return (
    <section className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight">
              Performance report
            </h1>
            <Badge variant="outline">Demo placeholder</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            In production this opens the team Power BI report. Here it shows
            session-only figures so the button still works without a workspace
            URL.
          </p>
        </div>
        <Link
          to="/performance"
          className="text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          ← Back to Performance
        </Link>
      </div>

      <p
        className="rounded-sm border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground"
        role="note"
      >
        Scope: {summary.scopeLabel}. Period: {summary.periodLabel}. Not live
        ERP/TMS; not pilot results.
      </p>

      <div className="grid gap-3 sm:grid-cols-3">
        <Metric
          label="OTD (labeled)"
          value={otdPct}
          hint={`${summary.on_time} on time · ${summary.late} late`}
        />
        <Metric
          label="Cases reviewed"
          value={String(reviewed)}
          hint={`Approve ${summary.decisions.approve} · Edit ${summary.decisions.edit} · Dismiss ${summary.decisions.dismiss}`}
        />
        <Metric
          label="Active flagged"
          value={String(summary.flagged_active)}
          hint={`${summary.intervened} intervened · ${summary.awaiting_outcome} awaiting outcome`}
        />
      </div>

      <div className="rounded-sm border border-border bg-card px-3 py-3">
        <h2 className="text-sm font-semibold">Pilot target</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {summary.otd_lift_hypothesis}
        </p>
      </div>

      <p className="text-xs text-muted-foreground">
        No “Saved by AI” metric. Replace this page with a real Power BI deep
        link when the workspace report exists.
      </p>
    </section>
  )
}

function Metric({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint: string
}) {
  return (
    <div className="rounded-sm border border-border bg-card px-3 py-3">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold tracking-tight">{value}</div>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  )
}

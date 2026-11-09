import { Link } from 'react-router-dom'
import { Badge } from '@/shared/ui/badge'
import type { PerformanceSummary as Summary } from './performanceFormat'

type Props = { summary: Summary }

/**
 * F7 Performance MVP: Power BI first; micro-summary collapsed / secondary.
 * Link opens an in-app report stand-in (no real Power BI workspace URL yet).
 */
export function PerformanceSummaryView({ summary }: Props) {
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
    <div className="space-y-4">
      <div className="rounded-sm border border-border bg-card px-3 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-semibold">Performance report</h2>
          <Badge variant="outline">Demo</Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Managers keep using Power BI. Open the report for OTD and pilot
          metrics — this app does not replace BI.
        </p>
        <Link
          to="/performance/report"
          className="mt-3 inline-flex h-9 items-center rounded-sm border border-border bg-background px-3 text-sm font-medium hover:bg-muted"
        >
          Open performance report
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            Opens in-app placeholder
          </span>
        </Link>
      </div>

      <details className="rounded-sm border border-border bg-card px-3 py-2">
        <summary className="cursor-pointer select-none text-sm font-semibold tracking-tight">
          Session orientation
          <span className="ml-2 font-normal text-muted-foreground">
            illustrative · not pilot results
          </span>
        </summary>
        <p className="mt-2 text-xs text-muted-foreground">
          OTD labeled {otdPct} ({summary.on_time}/{summary.late}) · Cases
          reviewed {reviewed} · Active flagged {summary.flagged_active} ·{' '}
          {summary.intervened} intervened · Target:{' '}
          {summary.otd_lift_hypothesis}
        </p>
        <p className="mt-2 text-[10px] text-muted-foreground">
          {summary.periodLabel}. {summary.scopeLabel}. No “Saved by AI”.
        </p>
      </details>

      <p
        className="rounded-sm border border-risk-medium/30 bg-risk-medium/10 px-3 py-2 text-sm"
        role="note"
      >
        Disclaimer: OTD +3–5pp is a{' '}
        <span className="font-medium">pilot hypothesis</span>, not a measured
        result.
      </p>
    </div>
  )
}

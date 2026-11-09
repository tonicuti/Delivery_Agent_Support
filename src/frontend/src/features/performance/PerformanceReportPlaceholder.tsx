import { Link } from 'react-router-dom'
import { PerformanceSummaryView } from './PerformanceSummary'
import type { PerformanceSummary as Summary } from './performanceFormat'

type Props = { summary: Summary }

/** Same live overview — kept under /performance/report for older demo links. */
export function PerformanceReportPlaceholder({ summary }: Props) {
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">
            Performance report
          </h1>
          <p className="text-sm text-muted-foreground">
            Same figures as Performance — useful if you want a dedicated report
            view during the demo.
          </p>
        </div>
        <Link
          to="/performance"
          className="text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          ← Back to Performance
        </Link>
      </div>
      <PerformanceSummaryView summary={summary} />
    </section>
  )
}

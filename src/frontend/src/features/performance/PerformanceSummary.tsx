import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  BellRing,
  ChartColumn,
  Flag,
  UserCheck,
} from 'lucide-react'
import { Badge } from '@/shared/ui/badge'
import {
  formatDurationMinutes,
  formatPct,
  type PerformanceSummary as Summary,
} from './performanceFormat'

type Props = { summary: Summary }

type Segment = { label: string; value: number; className: string }

function Stat({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Flag
  label: string
  value: string
  hint: string
}) {
  return (
    <div className="flex items-center gap-3 rounded-sm border border-border bg-card px-3 py-3">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-sm bg-primary/10 text-primary">
        <Icon className="size-5" aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block text-2xl font-semibold leading-none tabular-nums">
          {value}
        </span>
        <span className="mt-1 block text-sm font-medium">{label}</span>
        <span className="block text-xs text-muted-foreground">{hint}</span>
      </span>
    </div>
  )
}

function Split({ segments, empty }: { segments: Segment[]; empty: string }) {
  const total = segments.reduce((sum, s) => sum + s.value, 0)
  if (!total) {
    return <p className="text-sm text-muted-foreground">{empty}</p>
  }
  return (
    <div className="grid gap-3">
      <div
        className="flex h-3 overflow-hidden rounded-sm bg-muted"
        role="img"
        aria-label={segments.map((s) => `${s.label}: ${s.value}`).join(', ')}
      >
        {segments
          .filter((s) => s.value > 0)
          .map((s) => (
            <div
              key={s.label}
              className={s.className}
              style={{ width: `${(s.value / total) * 100}%` }}
            />
          ))}
      </div>
      <ul className="grid gap-x-8 gap-y-1 text-sm sm:grid-cols-2">
        {segments.map((s) => (
          <li key={s.label} className="flex items-center gap-2">
            <span className={`size-2.5 shrink-0 rounded-sm ${s.className}`} aria-hidden />
            <span>{s.label}</span>
            <span className="ml-auto tabular-nums text-muted-foreground">
              {s.value}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Panel({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <div className="rounded-sm border border-border bg-card">
      <div className="border-b border-border px-3 py-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        {description ? (
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <div className="px-3 py-3">{children}</div>
    </div>
  )
}

function Scorecard({ summary }: { summary: Summary }) {
  const decided =
    summary.decisions.approve +
    summary.decisions.edit +
    summary.decisions.dismiss
  const useful =
    decided > 0
      ? (summary.decisions.approve + summary.decisions.edit) / decided
      : null
  const known = summary.on_time + summary.late
  const lateCaught =
    known > 0 && summary.intervened > 0
      ? summary.late / Math.max(summary.intervened, 1)
      : null

  const rows: { goal: string; how: string; value: string | null }[] = [
    {
      goal: 'Late orders caught in time',
      how: 'Of reviewed orders with a delivery result, how many were late',
      value:
        known === 0
          ? null
          : `${formatPct(lateCaught)} · ${known} with result`,
    },
    {
      goal: 'Alerts are useful',
      how: 'Share of decisions where the suggestion was accepted or changed',
      value:
        decided === 0
          ? null
          : `${formatPct(useful)} of ${decided} decisions`,
    },
    {
      goal: 'Faster reaction to problems',
      how: 'Typical time before an alert is marked as seen',
      value:
        summary.alerts.median_minutes_to_acknowledge == null
          ? null
          : formatDurationMinutes(summary.alerts.median_minutes_to_acknowledge),
    },
    {
      goal: 'The worklist is used every day',
      how: 'Alerts that someone has decided on',
      value: `${decided} of ${summary.alerts.sent}`,
    },
  ]

  return (
    <Panel
      title="How we are doing"
      description="What this pilot aims for, and what we can already measure from demo data."
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[36rem] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left text-xs text-muted-foreground">
              <th className="px-2 py-2 font-medium">Goal</th>
              <th className="px-2 py-2 font-medium">How we measure it</th>
              <th className="px-2 py-2 font-medium">So far</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.goal} className="border-b border-border last:border-0">
                <td className="px-2 py-2.5 font-medium">{r.goal}</td>
                <td className="px-2 py-2.5 text-muted-foreground">{r.how}</td>
                <td className="px-2 py-2.5">
                  {r.value ? (
                    <span className="font-semibold tabular-nums">{r.value}</span>
                  ) : (
                    <span className="text-muted-foreground">
                      Not enough data yet
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  )
}

/**
 * Live performance overview for the demo — numbers come from session alerts
 * and decisions (same shape as the reference Insights page).
 */
export function PerformanceSummaryView({ summary }: Props) {
  const decided =
    summary.decisions.approve +
    summary.decisions.edit +
    summary.decisions.dismiss
  const suggestionsTotal =
    summary.recommendations.with_suggestion +
    summary.recommendations.no_suggestion
  const known = summary.on_time + summary.late
  const otdPct = known > 0 ? formatPct(summary.on_time / known) : null

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="outline">Demo data</Badge>
        <span>
          {summary.scopeLabel} · {summary.periodLabel}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          icon={Flag}
          label="Orders flagged"
          value={String(summary.episodes_opened)}
          hint={
            summary.flagged_active > 0
              ? `${summary.flagged_active} still open · ${summary.active_high} high risk`
              : 'None open right now'
          }
        />
        <Stat
          icon={BellRing}
          label="Alerts marked as seen"
          value={`${summary.alerts.acknowledged} of ${summary.alerts.sent}`}
          hint={
            summary.alerts.median_minutes_to_acknowledge == null
              ? summary.alerts.unread > 0
                ? `${summary.alerts.unread} still unread`
                : 'None marked as seen yet'
              : `Usually within ${formatDurationMinutes(summary.alerts.median_minutes_to_acknowledge)}`
          }
        />
        <Stat
          icon={UserCheck}
          label="Decisions made"
          value={String(decided)}
          hint={`${summary.decisions.approve} accepted · ${summary.decisions.edit} changed · ${summary.decisions.dismiss} dismissed`}
        />
        <Stat
          icon={ChartColumn}
          label="Suggestions given"
          value={`${summary.recommendations.with_suggestion} of ${suggestionsTotal || summary.episodes_opened}`}
          hint="Alerts that came with a suggested next step"
        />
      </div>

      {summary.flagged_active > 0 && decided === 0 ? (
        <p className="rounded-sm border border-border bg-muted/40 px-3 py-2 text-sm">
          There are open alerts waiting.{' '}
          <Link
            to="/dashboard"
            className="font-medium text-primary underline-offset-2 hover:underline"
          >
            Open orders needing attention
          </Link>{' '}
          — after you mark as seen or decide, the numbers here update.
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Orders by risk right now">
          <Split
            empty="No open orders right now"
            segments={[
              {
                label: 'High chance of delay',
                value: summary.bands.High,
                className: 'bg-risk-high',
              },
              {
                label: 'Some chance of delay',
                value: summary.bands.Medium,
                className: 'bg-risk-medium',
              },
              {
                label: 'Looking okay',
                value: summary.bands.Low,
                className: 'bg-risk-low',
              },
            ]}
          />
        </Panel>
        <Panel title="What people decided">
          <Split
            empty="No decisions yet — handle an alert to see this fill in"
            segments={[
              {
                label: 'Accepted the suggestion',
                value: summary.decisions.approve,
                className: 'bg-risk-low',
              },
              {
                label: 'Chose another action',
                value: summary.decisions.edit,
                className: 'bg-primary',
              },
              {
                label: 'Dismissed',
                value: summary.decisions.dismiss,
                className: 'bg-muted-foreground/40',
              },
            ]}
          />
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          title="Why alerts were dismissed"
          description="Helps send fewer alerts that are not useful."
        >
          <Split
            empty="Nothing has been dismissed yet"
            segments={summary.dismiss_reasons.map((r, i) => ({
              label: r.label,
              value: r.count,
              className: [
                'bg-risk-high',
                'bg-risk-medium',
                'bg-primary',
                'bg-risk-low',
                'bg-muted-foreground/40',
              ][i % 5]!,
            }))}
          />
        </Panel>
        <Panel
          title="What actually happened"
          description="Compares warnings with real delivery results."
        >
          {known === 0 ? (
            <p className="text-sm text-muted-foreground">
              No delivered orders recorded yet, so we cannot say how many
              warnings were right. This fills in once deliveries are completed
              in the demo data.
            </p>
          ) : (
            <div className="grid gap-2 text-sm">
              <p>
                On-time deliveries:{' '}
                <span className="font-semibold tabular-nums">{otdPct}</span> of{' '}
                {known} delivered orders
              </p>
              <p>
                Still waiting for a result:{' '}
                <span className="font-semibold tabular-nums">
                  {summary.awaiting_outcome}
                </span>
              </p>
            </div>
          )}
        </Panel>
      </div>

      <Scorecard summary={summary} />

      <p className="text-xs text-muted-foreground">{summary.otd_lift_hypothesis}</p>
    </div>
  )
}

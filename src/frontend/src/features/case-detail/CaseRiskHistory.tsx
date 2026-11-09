import { formatUtc, type RiskHistoryEvent } from './caseFormat'

type Props = { events: RiskHistoryEvent[] }

/** Trace timeline — collapsed by default so decide path stays short. */
export function CaseRiskHistory({ events }: Props) {
  return (
    <details className="rounded-sm border border-border bg-card px-3 py-2">
      <summary className="cursor-pointer select-none text-sm font-semibold tracking-tight">
        Risk history
        <span className="ml-2 font-normal text-muted-foreground">
          {events.length} events · open to trace
        </span>
      </summary>
      <p className="mt-2 text-xs text-muted-foreground">
        Discrete snapshots only — not a continuous chart.
      </p>
      <ol className="mt-2 space-y-2 border-l border-border pl-3">
        {events.map((ev) => (
          <li key={ev.id} className="relative text-sm">
            <span
              className="absolute -left-[0.97rem] top-1.5 size-2 rounded-full bg-muted-foreground/60"
              aria-hidden
            />
            <div className="font-medium">{ev.label}</div>
            <div className="text-xs text-muted-foreground">
              {formatUtc(ev.at_utc)} · {ev.detail}
            </div>
          </li>
        ))}
      </ol>
    </details>
  )
}

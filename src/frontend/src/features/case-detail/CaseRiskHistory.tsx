import { formatUtc, type RiskHistoryEvent } from './caseFormat'

type Props = { events: RiskHistoryEvent[] }

export function CaseRiskHistory({ events }: Props) {
  return (
    <section className="space-y-3" aria-labelledby="case-risk-hist-heading">
      <h2
        id="case-risk-hist-heading"
        className="text-sm font-semibold tracking-tight"
      >
        Risk history
      </h2>
      <p className="text-xs text-muted-foreground">
        Discrete snapshots only — not a continuous chart.
      </p>
      <ol className="space-y-2 border-l border-border pl-3">
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
    </section>
  )
}

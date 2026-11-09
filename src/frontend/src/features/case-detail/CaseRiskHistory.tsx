import { formatUtc, type RiskHistoryEvent } from './caseFormat'

type Props = { events: RiskHistoryEvent[] }

/** Optional timeline — kept under “More options”. */
export function CaseRiskHistory({ events }: Props) {
  if (events.length === 0) return null

  return (
    <div>
      <h3 className="text-sm font-medium">Alert history</h3>
      <ol className="mt-2 space-y-2 border-l border-border pl-3">
        {events.map((ev) => (
          <li key={ev.id} className="text-sm">
            <div className="font-medium">{ev.label}</div>
            <div className="text-xs text-muted-foreground">
              {formatUtc(ev.at_utc)}
              {ev.detail ? ` · ${ev.detail}` : ''}
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}

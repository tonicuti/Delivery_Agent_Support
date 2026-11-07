import type { CaseDetail, WarehouseEvent } from '@/shared/types'
import { Badge } from '@/shared/ui/badge'
import { formatUtc, WAREHOUSE_MILESTONES } from './caseFormat'

type Props = { detail: CaseDetail }

export function CaseWarehouseTimeline({ detail }: Props) {
  const events = detail.shipment?.warehouse_events ?? []
  const byStage = new Map<string, WarehouseEvent>()
  for (const ev of events) {
    if (!byStage.has(ev.stage)) byStage.set(ev.stage, ev)
  }

  return (
    <section className="space-y-3" aria-labelledby="case-wh-heading">
      <h2 id="case-wh-heading" className="text-sm font-semibold tracking-tight">
        Warehouse timeline
      </h2>
      {!detail.shipment ? (
        <p className="rounded-sm border border-border bg-card px-3 py-3 text-sm text-muted-foreground">
          No shipment linked to this order yet.
        </p>
      ) : (
        <ol className="space-y-2">
          {WAREHOUSE_MILESTONES.map((m) => {
            const ev = byStage.get(m.stage)
            return (
              <li
                key={m.stage}
                className="flex flex-wrap items-start justify-between gap-2 rounded-sm border border-border bg-card px-3 py-2 text-sm"
              >
                <div>
                  <div className="font-medium">{m.label}</div>
                  {ev ? (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Actual: {formatUtc(ev.occurred_at_utc)} · Recorded:{' '}
                      {formatUtc(ev.recorded_at_utc)} · by {ev.recorded_by}
                    </p>
                  ) : (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      No event received
                    </p>
                  )}
                </div>
                <Badge variant={ev ? 'secondary' : 'outline'}>
                  {ev ? 'Recorded' : 'No event received'}
                </Badge>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}

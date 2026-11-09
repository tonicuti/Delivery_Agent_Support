import type { CaseDetail, WarehouseEvent } from '@/shared/types'
import { cn } from '@/shared/lib/utils'
import { warehouseStageLabel } from '@/shared/uiLabels'
import { formatAge, WAREHOUSE_MILESTONES } from './caseFormat'

type Props = { detail: CaseDetail }

export function CaseWarehouseTimeline({ detail }: Props) {
  const events = detail.shipment?.warehouse_events ?? []
  const byStage = new Map<string, WarehouseEvent>()
  for (const ev of events) {
    if (!byStage.has(ev.stage)) byStage.set(ev.stage, ev)
  }

  const current =
    detail.order_snapshot.warehouse_stage ??
    [...WAREHOUSE_MILESTONES].reverse().find((m) => byStage.has(m.stage))
      ?.stage ??
    null

  if (!detail.shipment) {
    return (
      <section className="space-y-2" aria-labelledby="case-wh-heading">
        <h2
          id="case-wh-heading"
          className="text-sm font-semibold tracking-tight"
        >
          Warehouse
        </h2>
        <p className="rounded-sm border border-border bg-card px-3 py-2 text-sm text-muted-foreground">
          No warehouse shipment yet.
        </p>
      </section>
    )
  }

  return (
    <section className="space-y-2" aria-labelledby="case-wh-heading">
      <h2
        id="case-wh-heading"
        className="text-sm font-semibold tracking-tight"
      >
        Warehouse
      </h2>

      <ol className="flex flex-wrap gap-2">
        {WAREHOUSE_MILESTONES.map((m) => {
          const ev = byStage.get(m.stage)
          const isCurrent = current === m.stage
          const done = Boolean(ev) && !isCurrent
          return (
            <li
              key={m.stage}
              className={cn(
                'min-w-[7rem] flex-1 rounded-sm border px-2.5 py-2 text-sm',
                isCurrent
                  ? 'border-foreground/30 bg-muted/50'
                  : done
                    ? 'border-border bg-card'
                    : 'border-dashed border-border bg-card/60 text-muted-foreground',
              )}
            >
              <div className="font-medium">{warehouseStageLabel(m.stage)}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {isCurrent
                  ? 'Current'
                  : ev
                    ? formatAge(ev.occurred_at_utc)
                    : 'Not yet'}
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

import type { CaseDetail, WarehouseEvent } from '@/shared/types'
import { Badge } from '@/shared/ui/badge'
import { formatAge, formatUtc, WAREHOUSE_MILESTONES } from './caseFormat'

type Props = { detail: CaseDetail }

function gapLabel(
  prevAt: string | null,
  nextAt: string | null,
): string | null {
  if (!prevAt || !nextAt) return null
  const a = Date.parse(prevAt)
  const b = Date.parse(nextAt)
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) return null
  const mins = Math.round((b - a) / 60_000)
  if (mins < 60) return `${mins} min after previous`
  return `${(mins / 60).toFixed(1)} h after previous`
}

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

  const lastRecorded = [...WAREHOUSE_MILESTONES]
    .map((m) => byStage.get(m.stage))
    .filter(Boolean)
    .at(-1)

  let prevOccurred: string | null = null

  return (
    <section className="space-y-2" aria-labelledby="case-wh-heading">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2
          id="case-wh-heading"
          className="text-sm font-semibold tracking-tight"
        >
          Warehouse progress
        </h2>
        <p className="text-xs text-muted-foreground">
          {current ? (
            <>
              Current stage:{' '}
              <span className="font-medium text-foreground">{current}</span>
            </>
          ) : (
            'No shipment'
          )}
          {lastRecorded
            ? ` · last event ${formatAge(lastRecorded.occurred_at_utc)}`
            : null}
        </p>
      </div>

      <p className="text-xs text-muted-foreground">
        Use this to see if delay is still in the warehouse (pick/pack/load).
        “No event received” means WMS did not send an update — not proof that
        work never started.
      </p>

      {!detail.shipment ? (
        <p className="rounded-sm border border-border bg-card px-3 py-2 text-sm text-muted-foreground">
          No shipment linked to this order yet.
        </p>
      ) : (
        <ol className="space-y-1.5">
          {WAREHOUSE_MILESTONES.map((m) => {
            const ev = byStage.get(m.stage)
            const gap = ev
              ? gapLabel(prevOccurred, ev.occurred_at_utc)
              : null
            if (ev) prevOccurred = ev.occurred_at_utc
            const isCurrent = current === m.stage

            return (
              <li
                key={m.stage}
                className={[
                  'flex flex-wrap items-start justify-between gap-2 rounded-sm border px-3 py-2 text-sm',
                  isCurrent
                    ? 'border-foreground/25 bg-muted/40'
                    : 'border-border bg-card',
                ].join(' ')}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{m.label}</span>
                    {isCurrent ? (
                      <Badge variant="secondary">Current</Badge>
                    ) : null}
                  </div>
                  {ev ? (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Happened{' '}
                      <span className="font-medium text-foreground">
                        {formatUtc(ev.occurred_at_utc)}
                      </span>{' '}
                      ({formatAge(ev.occurred_at_utc)})
                      {gap ? ` · ${gap}` : ''}
                    </p>
                  ) : (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      No event received
                    </p>
                  )}
                </div>
                <Badge variant={ev ? 'secondary' : 'outline'}>
                  {ev ? 'Recorded' : 'Missing feed'}
                </Badge>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}

import type { CaseDetail } from '@/shared/types'
import { formatUtc } from './caseFormat'

type Props = { detail: CaseDetail }

export function CaseTransport({ detail }: Props) {
  const ship = detail.shipment
  const snap = detail.order_snapshot
  const currentEta =
    ship?.latest_eta_update?.current_eta_at_utc ?? snap.current_eta_at_utc

  return (
    <section className="space-y-2" aria-labelledby="case-transport-heading">
      <h2
        id="case-transport-heading"
        className="text-sm font-semibold tracking-tight"
      >
        Transport
      </h2>
      {!ship ? (
        <p className="rounded-sm border border-border bg-card px-3 py-2 text-sm text-muted-foreground">
          No shipment / route data for this order.
        </p>
      ) : (
        <div className="rounded-sm border border-border bg-card px-3 py-2 text-sm">
          <dl className="grid gap-2 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted-foreground">Status</dt>
              <dd>
                {ship.status}
                {ship.carrier?.name || snap.carrier_name
                  ? ` · ${ship.carrier?.name ?? snap.carrier_name}`
                  : ''}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Current ETA</dt>
              <dd className="font-semibold">{formatUtc(currentEta)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Promise end</dt>
              <dd>{formatUtc(detail.promise_version?.window_end_utc)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">ETA delay</dt>
              <dd
                className={
                  snap.eta_delay_minutes != null && snap.eta_delay_minutes > 0
                    ? 'font-semibold text-risk-medium'
                    : undefined
                }
              >
                {snap.eta_delay_minutes != null
                  ? `${snap.eta_delay_minutes} min`
                  : '—'}
              </dd>
            </div>
          </dl>
          <details className="mt-2 text-xs text-muted-foreground">
            <summary className="cursor-pointer select-none hover:text-foreground">
              More transport detail
            </summary>
            <dl className="mt-1.5 grid gap-1 sm:grid-cols-2">
              <div>
                <dt className="inline">Vehicle </dt>
                <dd className="inline text-foreground">
                  {ship.vehicle_type ?? '—'}
                </dd>
              </div>
              <div>
                <dt className="inline">Stop </dt>
                <dd className="inline text-foreground">
                  {ship.stop?.stop_sequence ?? '—'}
                </dd>
              </div>
              <div>
                <dt className="inline">Planned dep </dt>
                <dd className="inline text-foreground">
                  {formatUtc(ship.planned_departure_at_utc)}
                </dd>
              </div>
              <div>
                <dt className="inline">Planned arr </dt>
                <dd className="inline text-foreground">
                  {formatUtc(ship.planned_arrival_at_utc)}
                </dd>
              </div>
              <div className="sm:col-span-2 font-mono text-[10px]">
                shipment_id {ship.shipment_id}
              </div>
            </dl>
          </details>
        </div>
      )}
    </section>
  )
}

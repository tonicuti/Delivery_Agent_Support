import type { CaseDetail } from '@/shared/types'
import { formatUtc } from './caseFormat'

type Props = { detail: CaseDetail }

export function CaseTransport({ detail }: Props) {
  const ship = detail.shipment
  const snap = detail.order_snapshot

  return (
    <section className="space-y-3" aria-labelledby="case-transport-heading">
      <h2
        id="case-transport-heading"
        className="text-sm font-semibold tracking-tight"
      >
        Transport
      </h2>
      {!ship ? (
        <p className="rounded-sm border border-border bg-card px-3 py-3 text-sm text-muted-foreground">
          No shipment / route data for this order.
        </p>
      ) : (
        <div className="rounded-sm border border-border bg-card px-3 py-3 text-sm">
          <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <dt className="text-xs text-muted-foreground">Shipment</dt>
              <dd className="font-mono text-xs">{ship.shipment_id}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Status / type</dt>
              <dd>
                {ship.status} · {ship.shipment_type}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Carrier</dt>
              <dd>
                {ship.carrier?.name ?? snap.carrier_name ?? '—'}
                {ship.carrier
                  ? ship.carrier.own_fleet
                    ? ' (own fleet)'
                    : ' (external)'
                  : ''}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Vehicle</dt>
              <dd>{ship.vehicle_type ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Planned departure</dt>
              <dd>{formatUtc(ship.planned_departure_at_utc)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Planned arrival</dt>
              <dd>{formatUtc(ship.planned_arrival_at_utc)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Stop sequence</dt>
              <dd>{ship.stop?.stop_sequence ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Planned stop ETA</dt>
              <dd>{formatUtc(ship.stop?.planned_eta_at_utc)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Current ETA</dt>
              <dd>
                {formatUtc(
                  ship.latest_eta_update?.current_eta_at_utc ??
                    snap.current_eta_at_utc,
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Promise window end</dt>
              <dd>{formatUtc(detail.promise_version?.window_end_utc)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">ETA delay (snapshot)</dt>
              <dd>
                {snap.eta_delay_minutes != null
                  ? `${snap.eta_delay_minutes} min`
                  : '—'}
              </dd>
            </div>
          </dl>
        </div>
      )}
    </section>
  )
}

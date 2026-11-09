import type { CaseDetail } from '@/shared/types'
import { warehouseStageLabel } from '@/shared/uiLabels'
import { formatUtc } from './caseFormat'
import { DeliveryRouteMap } from './DeliveryRouteMap'

type Props = { detail: CaseDetail }

const SHIP_STATUS: Record<string, string> = {
  planned: 'Planned',
  packing: 'Being packed',
  loaded: 'Loaded',
  departed: 'On the way',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
}

function journeyStage(
  detail: CaseDetail,
): 'at_warehouse' | 'ready' | 'on_way' | 'delivered' {
  const status = detail.shipment?.status
  if (status === 'delivered') return 'delivered'
  if (status === 'departed') return 'on_way'
  if (status === 'loaded') return 'ready'
  return 'at_warehouse'
}

function routeProgressLabel(detail: CaseDetail): string {
  const stage = journeyStage(detail)
  if (stage === 'delivered') return 'Delivered'
  if (stage === 'on_way') return 'On the way to the customer'
  if (stage === 'ready') return 'Loaded, ready to leave'
  const wh = detail.order_snapshot.warehouse_stage
  return wh
    ? `Still at the warehouse · ${warehouseStageLabel(wh)}`
    : 'Still being prepared at the warehouse'
}

export function CaseTransport({ detail }: Props) {
  const ship = detail.shipment
  const snap = detail.order_snapshot
  const site = detail.delivery_site
  const currentEta =
    ship?.latest_eta_update?.current_eta_at_utc ?? snap.current_eta_at_utc
  const delay = snap.eta_delay_minutes
  const carrierName = ship?.carrier?.name ?? snap.carrier_name
  const ownFleet = ship?.carrier?.own_fleet === 1
  const warehouseName = ship?.warehouse.name ?? snap.warehouse_name ?? 'Warehouse'
  const deliveryLabel =
    [snap.region_name, site.postcode].filter(Boolean).join(' · ') ||
    'Customer address'
  const fromLat = ship?.warehouse.latitude
  const fromLon = ship?.warehouse.longitude
  const toLat = site.latitude
  const toLon = site.longitude
  const canMap =
    fromLat != null &&
    fromLon != null &&
    toLat != null &&
    toLon != null &&
    !Number.isNaN(fromLat) &&
    !Number.isNaN(fromLon) &&
    !Number.isNaN(toLat) &&
    !Number.isNaN(toLon)

  return (
    <section className="space-y-2" aria-labelledby="case-transport-heading">
      <h2
        id="case-transport-heading"
        className="text-sm font-semibold tracking-tight"
      >
        Delivery
      </h2>
      {!ship ? (
        <p className="rounded-sm border border-border bg-card px-3 py-2 text-sm text-muted-foreground">
          No delivery info yet.
        </p>
      ) : (
        <div className="space-y-3">
          <div className="grid gap-3 rounded-sm border border-border bg-card px-3 py-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <div className="text-xs text-muted-foreground">Carrier</div>
              <div className="font-semibold">
                {carrierName ?? 'Not assigned yet'}
              </div>
              {carrierName ? (
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {ownFleet ? 'Company fleet' : 'Partner carrier'}
                  {ship.vehicle_type ? ` · ${ship.vehicle_type}` : ''}
                </div>
              ) : null}
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Expected arrival</div>
              <div className="font-semibold">{formatUtc(currentEta)}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                Promised by {formatUtc(detail.promise_version?.window_end_utc)}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Shipment status</div>
              <div className="font-medium">
                {SHIP_STATUS[ship.status] ?? ship.status.replace(/_/g, ' ')}
              </div>
              <div
                className={
                  delay != null && delay > 0
                    ? 'mt-0.5 text-xs font-medium text-risk-medium'
                    : 'mt-0.5 text-xs text-muted-foreground'
                }
              >
                {delay != null && delay > 0
                  ? `${delay} min later than promised`
                  : 'On promised time so far'}
              </div>
            </div>
          </div>

          {canMap ? (
            <DeliveryRouteMap
              warehouseName={warehouseName}
              deliveryLabel={deliveryLabel || 'Customer site'}
              fromLat={fromLat}
              fromLon={fromLon}
              toLat={toLat}
              toLon={toLon}
              progressLabel={routeProgressLabel(detail)}
              stage={journeyStage(detail)}
            />
          ) : (
            <p className="text-xs text-muted-foreground">
              Journey view not available — missing warehouse or delivery location.
            </p>
          )}
        </div>
      )}
    </section>
  )
}

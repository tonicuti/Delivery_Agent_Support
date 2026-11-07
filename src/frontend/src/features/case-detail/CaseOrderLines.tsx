import type { CaseDetail } from '@/shared/types'
import { Badge } from '@/shared/ui/badge'
import { formatUtc } from './caseFormat'

type Props = { detail: CaseDetail }

export function CaseOrderLines({ detail }: Props) {
  const snap = detail.order_snapshot
  const special =
    snap.special_handling === 1 ||
    detail.order_lines.some((l) => l.product.special_handling === 1)

  return (
    <section className="space-y-3" aria-labelledby="case-order-heading">
      <h2 id="case-order-heading" className="text-sm font-semibold tracking-tight">
        Order + lines
      </h2>

      <div className="rounded-sm border border-border bg-card px-3 py-3 text-sm">
        <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt className="text-xs text-muted-foreground">Customer</dt>
            <dd>
              {detail.customer.customer_type} ·{' '}
              <span className="font-mono text-xs">
                {detail.customer.external_customer_id}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Warehouse / region</dt>
            <dd>
              {snap.warehouse_name ?? detail.shipment?.warehouse.name ?? '—'}
              {snap.region_name ? ` · ${snap.region_name}` : ''}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Delivery postcode</dt>
            <dd>
              {detail.delivery_site.postcode}
              {detail.delivery_site.country_code
                ? ` (${detail.delivery_site.country_code})`
                : ''}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Weight / volume</dt>
            <dd>
              {snap.weight_kg != null ? `${snap.weight_kg} kg` : '—'}
              {' · '}
              {snap.volume_m3 != null ? `${snap.volume_m3.toFixed(2)} m³` : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Special handling</dt>
            <dd>{special ? 'Yes' : 'No'}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Site time zone</dt>
            <dd>{detail.delivery_site.time_zone}</dd>
          </div>
        </dl>
      </div>

      <div className="overflow-x-auto rounded-sm border border-border bg-card">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead className="border-b border-border bg-muted/60 text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Line</th>
              <th className="px-3 py-2 font-medium">SKU</th>
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Qty</th>
              <th className="px-3 py-2 font-medium">UoM</th>
              <th className="px-3 py-2 font-medium">Stock (line)</th>
              <th className="px-3 py-2 font-medium">Prep / stage</th>
            </tr>
          </thead>
          <tbody>
            {detail.order_lines.map((line) => {
              const stock = line.latest_stock_event
              return (
                <tr
                  key={line.line_no}
                  className="border-b border-border last:border-0"
                >
                  <td className="px-3 py-2 font-mono text-xs">{line.line_no}</td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {line.product.external_product_id}
                  </td>
                  <td className="px-3 py-2">{line.product.name}</td>
                  <td className="px-3 py-2">{line.ordered_qty}</td>
                  <td className="px-3 py-2 text-xs">{line.product.unit}</td>
                  <td className="px-3 py-2">
                    {stock ? (
                      <div className="space-y-0.5">
                        <Badge
                          variant="outline"
                          className={
                            stock.stock_status === 'in_stock'
                              ? undefined
                              : 'text-risk-medium'
                          }
                        >
                          {stock.stock_status}
                        </Badge>
                        <div className="text-xs text-muted-foreground">
                          {formatUtc(stock.recorded_at_utc)}
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        No stock event
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {snap.warehouse_stage ?? '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        Stock is shown per line. Snapshot order-level stock_status (
        {snap.stock_status ?? '—'}) is not used as a whole-order “in stock” badge.
      </p>
    </section>
  )
}

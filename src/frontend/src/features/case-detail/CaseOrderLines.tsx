import type { CaseDetail } from '@/shared/types'
import { Badge } from '@/shared/ui/badge'
import { formatUtc } from './caseFormat'

type Props = { detail: CaseDetail }

export function CaseOrderLines({ detail }: Props) {
  const snap = detail.order_snapshot
  const special =
    snap.special_handling === 1 ||
    detail.order_lines.some((l) => l.product.special_handling === 1)
  const shortLines = detail.order_lines.filter(
    (l) =>
      l.latest_stock_event &&
      l.latest_stock_event.stock_status !== 'in_stock',
  )

  return (
    <section className="space-y-2" aria-labelledby="case-order-heading">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2
          id="case-order-heading"
          className="text-sm font-semibold tracking-tight"
        >
          Order lines
        </h2>
        <p className="text-xs text-muted-foreground">
          {detail.customer.customer_type}
          {snap.warehouse_name ? ` · ${snap.warehouse_name}` : ''}
          {special ? ' · Special handling' : ''}
          {shortLines.length > 0
            ? ` · ${shortLines.length} line(s) not in stock`
            : ''}
        </p>
      </div>

      <div className="overflow-x-auto rounded-sm border border-border bg-card">
        <table className="w-full min-w-[28rem] text-left text-sm">
          <thead className="border-b border-border bg-muted/60 text-xs text-muted-foreground">
            <tr>
              <th className="px-2.5 py-1.5 font-medium">SKU</th>
              <th className="px-2.5 py-1.5 font-medium">Name</th>
              <th className="px-2.5 py-1.5 font-medium">Qty</th>
              <th className="px-2.5 py-1.5 font-medium">Stock</th>
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
                  <td
                    className="px-2.5 py-1.5 font-mono text-xs"
                    title={`Line ${line.line_no}`}
                  >
                    {line.product.external_product_id}
                  </td>
                  <td className="px-2.5 py-1.5">{line.product.name}</td>
                  <td className="px-2.5 py-1.5 tabular-nums">
                    {line.ordered_qty}
                    <span className="ml-1 text-xs text-muted-foreground">
                      {line.product.unit}
                    </span>
                  </td>
                  <td className="px-2.5 py-1.5">
                    {stock ? (
                      <Badge
                        variant="outline"
                        className={
                          stock.stock_status === 'in_stock'
                            ? undefined
                            : 'text-risk-medium'
                        }
                        title={formatUtc(stock.recorded_at_utc)}
                      >
                        {stock.stock_status}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        No event
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}

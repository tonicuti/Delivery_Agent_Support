import type { CaseDetail } from '@/shared/types'
import { Badge } from '@/shared/ui/badge'
import { stockStatusLabel } from '@/shared/uiLabels'

type Props = { detail: CaseDetail }

export function CaseOrderLines({ detail }: Props) {
  const shortCount = detail.order_lines.filter(
    (l) =>
      l.latest_stock_event &&
      l.latest_stock_event.stock_status !== 'in_stock',
  ).length

  return (
    <section className="space-y-2" aria-labelledby="case-order-heading">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2
          id="case-order-heading"
          className="text-sm font-semibold tracking-tight"
        >
          Items
        </h2>
        {shortCount > 0 ? (
          <p className="text-xs text-muted-foreground">
            {shortCount} item(s) not ready
          </p>
        ) : null}
      </div>

      <div className="overflow-x-auto rounded-sm border border-border bg-card">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-muted/60 text-xs text-muted-foreground">
            <tr>
              <th className="px-2.5 py-1.5 font-medium">Item</th>
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
                      >
                        {stockStatusLabel(stock.stock_status)}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
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

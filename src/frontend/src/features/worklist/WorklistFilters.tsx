import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import type { CustomerType, RiskBand, WarehouseStage } from '@/shared/types'

export type WorklistFilterState = {
  q: string
  risk: '' | RiskBand
  customerType: '' | CustomerType
  stage: '' | WarehouseStage
  ack: '' | 'unacked' | 'acked'
  includeLow: boolean
}

type Props = {
  value: WorklistFilterState
  onChange: (next: WorklistFilterState) => void
  onClear: () => void
  onRefresh: () => void
  refreshing?: boolean
}

const selectClass =
  'h-8 cursor-pointer rounded-sm border border-border bg-card px-2 text-sm text-foreground'

export function WorklistFilters({
  value,
  onChange,
  onClear,
  onRefresh,
  refreshing,
}: Props) {
  const patch = (partial: Partial<WorklistFilterState>) =>
    onChange({ ...value, ...partial })

  return (
    <div className="flex flex-wrap items-end gap-2 rounded-sm border border-border bg-card p-2">
      <label className="flex min-w-[10rem] flex-1 flex-col gap-1 text-xs text-muted-foreground">
        Search order
        <Input
          type="search"
          value={value.q}
          onChange={(e) => patch({ q: e.target.value })}
          placeholder="order_id or external_order_id"
          aria-label="Search order ID"
          className="h-8"
        />
      </label>

      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        Risk
        <select
          className={selectClass}
          value={value.risk}
          onChange={(e) => patch({ risk: e.target.value as WorklistFilterState['risk'] })}
          aria-label="Filter by risk band"
        >
          <option value="">All</option>
          <option value="High">High</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
        </select>
      </label>

      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        Customer
        <select
          className={selectClass}
          value={value.customerType}
          onChange={(e) =>
            patch({ customerType: e.target.value as WorklistFilterState['customerType'] })
          }
          aria-label="Filter by customer type"
        >
          <option value="">All</option>
          <option value="B2B">B2B</option>
          <option value="B2C">B2C</option>
        </select>
      </label>

      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        Warehouse stage
        <select
          className={selectClass}
          value={value.stage}
          onChange={(e) =>
            patch({ stage: e.target.value as WorklistFilterState['stage'] })
          }
          aria-label="Filter by warehouse stage"
        >
          <option value="">All</option>
          <option value="waiting">waiting</option>
          <option value="pick_started">pick_started</option>
          <option value="packed">packed</option>
          <option value="loaded">loaded</option>
          <option value="departed">departed</option>
        </select>
      </label>

      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        Notification
        <select
          className={selectClass}
          value={value.ack}
          onChange={(e) => patch({ ack: e.target.value as WorklistFilterState['ack'] })}
          aria-label="Filter by acknowledgment"
        >
          <option value="">All</option>
          <option value="unacked">Unacknowledged</option>
          <option value="acked">Acknowledged</option>
        </select>
      </label>

      <label className="flex h-8 cursor-pointer items-center gap-2 text-xs text-muted-foreground">
        <input
          type="checkbox"
          className="cursor-pointer"
          checked={value.includeLow}
          onChange={(e) => patch({ includeLow: e.target.checked })}
        />
        Include Low risk
      </label>

      <Button type="button" variant="outline" size="sm" onClick={onClear}>
        Clear filters
      </Button>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={onRefresh}
        disabled={refreshing}
      >
        {refreshing ? 'Refreshing…' : 'Refresh'}
      </Button>
    </div>
  )
}

export const defaultWorklistFilters: WorklistFilterState = {
  q: '',
  risk: '',
  customerType: '',
  stage: '',
  ack: '',
  includeLow: false,
}

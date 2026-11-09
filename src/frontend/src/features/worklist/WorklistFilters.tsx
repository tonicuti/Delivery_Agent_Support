import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import type { CustomerType, RiskBand, WarehouseStage } from '@/shared/types'
import { WAREHOUSE_STAGE_LABEL } from '@/shared/uiLabels'

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

const STAGE_OPTIONS: WarehouseStage[] = [
  'waiting',
  'pick_started',
  'packed',
  'loaded',
  'departed',
]

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
          placeholder="Search by order number"
          aria-label="Search by order number"
          className="h-8"
        />
      </label>

      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        Chance of delay
        <select
          className={selectClass}
          value={value.risk}
          onChange={(e) => patch({ risk: e.target.value as WorklistFilterState['risk'] })}
          aria-label="Filter by chance of delay"
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
          <option value="B2B">Business</option>
          <option value="B2C">Consumer</option>
        </select>
      </label>

      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        Warehouse progress
        <select
          className={selectClass}
          value={value.stage}
          onChange={(e) =>
            patch({ stage: e.target.value as WorklistFilterState['stage'] })
          }
          aria-label="Filter by warehouse progress"
        >
          <option value="">All</option>
          {STAGE_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {WAREHOUSE_STAGE_LABEL[s]}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        Alert
        <select
          className={selectClass}
          value={value.ack}
          onChange={(e) => patch({ ack: e.target.value as WorklistFilterState['ack'] })}
          aria-label="Filter by alert status"
        >
          <option value="">All</option>
          <option value="unacked">Unread</option>
          <option value="acked">Marked as seen</option>
        </select>
      </label>

      <label className="flex h-8 cursor-pointer items-center gap-2 text-xs text-muted-foreground">
        <input
          type="checkbox"
          className="cursor-pointer"
          checked={value.includeLow}
          onChange={(e) => patch({ includeLow: e.target.checked })}
        />
        Include low chance
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

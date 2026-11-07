import { Button } from '@/shared/ui/button'
import { PLAYBOOK_ACTIONS } from '@/features/decision/playbooks'
import type { HistoryFilterState } from './historyFormat'

type Props = {
  value: HistoryFilterState
  onChange: (next: HistoryFilterState) => void
  onClear: () => void
  modelOptions: string[]
  warehouseOptions: string[]
}

const fieldClass =
  'flex w-[11.5rem] shrink-0 flex-col gap-1 text-xs text-muted-foreground'
const controlClass =
  'h-8 w-full min-w-0 cursor-pointer rounded-sm border border-border bg-background px-2 text-sm text-foreground'

export function HistoryFilters({
  value,
  onChange,
  onClear,
  modelOptions,
  warehouseOptions,
}: Props) {
  const set = <K extends keyof HistoryFilterState>(
    key: K,
    v: HistoryFilterState[K],
  ) => onChange({ ...value, [key]: v })

  return (
    <div className="flex flex-wrap items-end gap-x-3 gap-y-3 rounded-sm border border-border bg-card p-3">
      <label className={`${fieldClass} w-[14rem]`}>
        Search
        <input
          className={controlClass}
          value={value.q}
          onChange={(e) => set('q', e.target.value)}
          placeholder="Order / episode"
          aria-label="Search history"
        />
      </label>
      <label className={fieldClass}>
        Outcome
        <select
          className={controlClass}
          value={value.outcome}
          onChange={(e) =>
            set('outcome', e.target.value as HistoryFilterState['outcome'])
          }
          aria-label="Filter by outcome"
          title={value.outcome || 'All'}
        >
          <option value="">All</option>
          <option value="Awaiting delivery outcome">Awaiting outcome</option>
          <option value="On time">On time</option>
          <option value="Late">Late</option>
          <option value="Outcome unknown">Outcome unknown</option>
        </select>
      </label>
      <label className={fieldClass}>
        Decision
        <select
          className={controlClass}
          value={value.decision}
          onChange={(e) =>
            set('decision', e.target.value as HistoryFilterState['decision'])
          }
          aria-label="Filter by decision"
        >
          <option value="">All</option>
          <option value="No decision">No decision</option>
          <option value="Approve">Approve</option>
          <option value="Edit">Edit</option>
          <option value="Dismiss">Dismiss</option>
          <option value="Recorded">Recorded</option>
        </select>
      </label>
      <label className={fieldClass}>
        Suggested action
        <select
          className={controlClass}
          value={value.action}
          onChange={(e) =>
            set('action', e.target.value as HistoryFilterState['action'])
          }
          aria-label="Filter by suggested action"
        >
          <option value="">All</option>
          <option value="none">None</option>
          {PLAYBOOK_ACTIONS.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
            </option>
          ))}
        </select>
      </label>
      <label className={fieldClass}>
        Warehouse
        <select
          className={controlClass}
          value={value.warehouse}
          onChange={(e) => set('warehouse', e.target.value)}
          aria-label="Filter by warehouse"
        >
          <option value="">All</option>
          {warehouseOptions.map((w) => (
            <option key={w} value={w}>
              {w}
            </option>
          ))}
        </select>
      </label>
      <label className={`${fieldClass} w-[13rem]`}>
        Model
        <select
          className={controlClass}
          value={value.model}
          onChange={(e) => set('model', e.target.value)}
          aria-label="Filter by model version"
          title={value.model || 'All'}
        >
          <option value="">All</option>
          {modelOptions.map((m) => (
            <option key={m} value={m}>
              {m.length > 36 ? `${m.slice(0, 18)}…${m.slice(-10)}` : m}
            </option>
          ))}
        </select>
      </label>
      <label className={fieldClass}>
        Opened from
        <input
          type="date"
          className={controlClass}
          value={value.dateFrom}
          onChange={(e) => set('dateFrom', e.target.value)}
          aria-label="Opened from date"
        />
      </label>
      <label className={fieldClass}>
        Opened to
        <input
          type="date"
          className={controlClass}
          value={value.dateTo}
          onChange={(e) => set('dateTo', e.target.value)}
          aria-label="Opened to date"
        />
      </label>
      <div className="flex h-8 items-center pb-0">
        <Button type="button" size="sm" variant="outline" onClick={onClear}>
          Clear filters
        </Button>
      </div>
    </div>
  )
}

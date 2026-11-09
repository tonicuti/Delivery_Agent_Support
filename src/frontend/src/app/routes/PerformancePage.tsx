import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '@/api'
import type { HistoryRow, WorklistResponse } from '@/shared/types'
import {
  PerformanceSummaryView,
  buildPerformanceSummary,
} from '@/features/performance'
import { Button } from '@/shared/ui/button'

export function PerformancePage() {
  const [history, setHistory] = useState<HistoryRow[]>([])
  const [worklist, setWorklist] = useState<WorklistResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [h, w] = await Promise.all([
        api.getHistory({}),
        api.getWorklist({
          warehouse_id: 1,
          status: 'active',
          include_low_risk: true,
        }),
      ])
      setHistory(h)
      setWorklist(w)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load performance')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const summary = useMemo(
    () => buildPerformanceSummary(history, worklist),
    [history, worklist],
  )

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">Performance</h1>
          <p className="text-sm text-muted-foreground">
            Delivery and alert-handling effectiveness — not page speed, not Data
            health freshness.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={loading}
          onClick={() => void load()}
        >
          {loading ? 'Loading…' : 'Refresh'}
        </Button>
      </div>

      {/* Stub filters — F7 MVP; rights-scoped when real auth exists */}
      <div
        className="flex flex-wrap items-end gap-2"
        aria-label="Performance filters (demo stub)"
      >
        <label className="space-y-0.5 text-xs text-muted-foreground">
          Warehouse
          <select
            className="block h-8 cursor-not-allowed rounded-sm border border-border bg-muted/40 px-2 text-sm text-muted-foreground"
            disabled
            defaultValue="1"
            title="Demo stub — fixed to session warehouse"
          >
            <option value="1">Stockholm (WH1)</option>
          </select>
        </label>
        <label className="space-y-0.5 text-xs text-muted-foreground">
          Period
          <select
            className="block h-8 cursor-not-allowed rounded-sm border border-border bg-muted/40 px-2 text-sm text-muted-foreground"
            disabled
            defaultValue="session"
            title="Demo stub — session history only"
          >
            <option value="session">Session history</option>
          </select>
        </label>
        <label className="space-y-0.5 text-xs text-muted-foreground">
          Mode
          <select
            className="block h-8 cursor-not-allowed rounded-sm border border-border bg-muted/40 px-2 text-sm text-muted-foreground"
            disabled
            defaultValue="pilot"
            title="Demo stub"
          >
            <option value="pilot">Pilot / shadow (demo)</option>
          </select>
        </label>
      </div>

      {error ? (
        <p className="rounded-sm border border-destructive/30 bg-destructive/5 px-3 py-2 text-destructive">
          {error}
        </p>
      ) : null}

      {loading && !worklist && history.length === 0 ? (
        <div
          className="space-y-2"
          aria-busy="true"
          aria-label="Loading performance"
        >
          <div className="h-24 animate-pulse rounded-sm bg-muted" />
          <div className="h-28 animate-pulse rounded-sm bg-muted" />
        </div>
      ) : (
        <PerformanceSummaryView summary={summary} />
      )}
    </section>
  )
}

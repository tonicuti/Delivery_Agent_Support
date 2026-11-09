import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '@/api'
import type { HistoryRow, WorklistResponse } from '@/shared/types'
import {
  PerformanceReportPlaceholder,
  buildPerformanceSummary,
} from '@/features/performance'
import { Button } from '@/shared/ui/button'

export function PerformanceReportPage() {
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
      setError(err instanceof Error ? err.message : 'Failed to load report')
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
    <div className="space-y-3">
      <div className="flex justify-end">
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

      {error ? (
        <p className="rounded-sm border border-destructive/30 bg-destructive/5 px-3 py-2 text-destructive">
          {error}
        </p>
      ) : null}

      {loading && !worklist && history.length === 0 ? (
        <div
          className="space-y-2"
          aria-busy="true"
          aria-label="Loading performance report"
        >
          <div className="h-10 animate-pulse rounded-sm bg-muted" />
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="h-24 animate-pulse rounded-sm bg-muted" />
            <div className="h-24 animate-pulse rounded-sm bg-muted" />
            <div className="h-24 animate-pulse rounded-sm bg-muted" />
          </div>
        </div>
      ) : (
        <PerformanceReportPlaceholder summary={summary} />
      )}
    </div>
  )
}

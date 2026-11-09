import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '@/api'
import type { HistoryRow, WorklistResponse } from '@/shared/types'
import {
  PerformanceSummaryView,
  buildPerformanceSummary,
} from '@/features/performance'
import { Button } from '@/shared/ui/button'
import { PageHero } from '@/shared/ui/PageHero'

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
      setError(err instanceof Error ? err.message : 'Could not load performance')
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
      <PageHero
        tone="performance"
        title="Performance"
        description="How the team is doing: what was flagged, what people decided, and how alerts are being picked up."
        actions={
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={loading}
            onClick={() => void load()}
          >
            {loading ? 'Loading…' : 'Refresh'}
          </Button>
        }
      />

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
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="h-24 animate-pulse rounded-sm bg-muted" />
            <div className="h-24 animate-pulse rounded-sm bg-muted" />
            <div className="h-24 animate-pulse rounded-sm bg-muted" />
            <div className="h-24 animate-pulse rounded-sm bg-muted" />
          </div>
          <div className="h-40 animate-pulse rounded-sm bg-muted" />
        </div>
      ) : (
        <PerformanceSummaryView summary={summary} />
      )}
    </section>
  )
}

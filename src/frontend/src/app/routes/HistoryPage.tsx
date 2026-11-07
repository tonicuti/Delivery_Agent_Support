import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '@/api'
import type { HistoryRow } from '@/shared/types'
import {
  HistoryDetail,
  HistoryFilters,
  HistoryTable,
  applyHistoryFilters,
  emptyHistoryFilters,
} from '@/features/history'
import type { HistoryFilterState } from '@/features/history/historyFormat'

export function HistoryPage() {
  const { episodeId: routeEpisodeId } = useParams()
  const navigate = useNavigate()

  const [rows, setRows] = useState<HistoryRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<HistoryFilterState>(emptyHistoryFilters)
  const [selectedId, setSelectedId] = useState<string | null>(
    routeEpisodeId ?? null,
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.getHistory({})
      setRows(data)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load history')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (routeEpisodeId) setSelectedId(routeEpisodeId)
  }, [routeEpisodeId])

  const visible = useMemo(
    () => applyHistoryFilters(rows, filters),
    [rows, filters],
  )

  const selected = useMemo(
    () => visible.find((r) => r.risk_episode.episode_id === selectedId) ?? null,
    [visible, selectedId],
  )

  const modelOptions = useMemo(
    () =>
      [...new Set(rows.map((r) => r.risk_score.model_version))].sort(),
    [rows],
  )
  const warehouseOptions = useMemo(
    () =>
      [
        ...new Set(
          rows
            .map((r) => r.order_snapshot.warehouse_name)
            .filter((w): w is string => Boolean(w)),
        ),
      ].sort(),
    [rows],
  )

  const onSelect = (episodeId: string) => {
    setSelectedId(episodeId)
    navigate(`/history/${episodeId}`, { replace: true })
  }

  const onCloseDetail = () => {
    setSelectedId(null)
    navigate('/history', { replace: true })
  }

  const filtersActive =
    Boolean(filters.q.trim()) ||
    Boolean(filters.outcome) ||
    Boolean(filters.decision) ||
    Boolean(filters.action) ||
    Boolean(filters.model) ||
    Boolean(filters.warehouse) ||
    Boolean(filters.dateFrom) ||
    Boolean(filters.dateTo)

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">History</h1>
        <p className="text-muted-foreground">
          Risk episodes: what the system knew at alert, what it suggested, what
          staff decided, and delivery outcome when known.
        </p>
      </div>

      <HistoryFilters
        value={filters}
        onChange={setFilters}
        onClear={() => setFilters(emptyHistoryFilters())}
        modelOptions={modelOptions}
        warehouseOptions={warehouseOptions}
      />

      {loading ? (
        <div className="space-y-2" aria-busy="true" aria-label="Loading history">
          <div className="h-10 animate-pulse rounded-sm bg-muted" />
          <div className="h-40 animate-pulse rounded-sm bg-muted" />
        </div>
      ) : null}

      {error ? (
        <p className="rounded-sm border border-destructive/30 bg-destructive/5 px-3 py-2 text-destructive">
          {error}
        </p>
      ) : null}

      {!loading && !error && visible.length === 0 ? (
        <div className="rounded-sm border border-border bg-card px-3 py-3 text-sm text-muted-foreground">
          {filtersActive ? (
            <>
              <p>No episodes match the current filters.</p>
              <button
                type="button"
                className="mt-2 cursor-pointer text-primary underline-offset-2 hover:underline"
                onClick={() => setFilters(emptyHistoryFilters())}
              >
                Clear filters
              </button>
            </>
          ) : (
            <p>No risk episodes in session history yet.</p>
          )}
        </div>
      ) : null}

      {!loading && visible.length > 0 ? (
        <div
          className={[
            'grid gap-4',
            selected ? 'xl:grid-cols-[minmax(0,1fr)_24rem]' : '',
          ].join(' ')}
        >
          <HistoryTable
            rows={visible}
            selectedEpisodeId={selectedId}
            onSelect={onSelect}
          />
          {selected ? (
            <HistoryDetail row={selected} onClose={onCloseDetail} />
          ) : null}
        </div>
      ) : null}

      {!loading && selectedId && !selected && visible.length > 0 ? (
        <p className="text-sm text-muted-foreground">
          Episode not in the filtered list.{' '}
          <button
            type="button"
            className="cursor-pointer text-primary underline-offset-2 hover:underline"
            onClick={() => setFilters(emptyHistoryFilters())}
          >
            Clear filters
          </button>
        </p>
      ) : null}
    </section>
  )
}

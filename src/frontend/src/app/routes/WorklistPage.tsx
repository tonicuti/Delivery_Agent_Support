import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '@/api'
import type { WorklistResponse, WorklistRow } from '@/shared/types'
import { WorklistFilters } from '@/features/worklist/WorklistFilters'
import type { WorklistFilterState } from '@/features/worklist/WorklistFilters'
import { WorklistSummary } from '@/features/worklist/WorklistSummary'
import { WorklistTable } from '@/features/worklist/WorklistTable'
import { isUnacknowledged } from '@/features/worklist/worklistFormat'

function filtersFromSearch(params: URLSearchParams): WorklistFilterState {
  return {
    q: params.get('q') ?? '',
    risk: (params.get('risk') as WorklistFilterState['risk']) || '',
    customerType:
      (params.get('customer_type') as WorklistFilterState['customerType']) || '',
    stage: (params.get('stage') as WorklistFilterState['stage']) || '',
    ack: (params.get('ack') as WorklistFilterState['ack']) || '',
    includeLow: params.get('include_low') === '1',
  }
}

function searchFromFilters(f: WorklistFilterState): URLSearchParams {
  const p = new URLSearchParams()
  if (f.q.trim()) p.set('q', f.q.trim())
  if (f.risk) p.set('risk', f.risk)
  if (f.customerType) p.set('customer_type', f.customerType)
  if (f.stage) p.set('stage', f.stage)
  if (f.ack) p.set('ack', f.ack)
  if (f.includeLow) p.set('include_low', '1')
  return p
}

function applyClientFilters(
  items: WorklistRow[],
  f: WorklistFilterState,
): WorklistRow[] {
  const q = f.q.trim().toLowerCase()
  return items.filter((row) => {
    if (f.risk && row.risk_band !== f.risk) return false
    if (f.customerType && row.customer.customer_type !== f.customerType) return false
    if (f.stage && row.order_snapshot.warehouse_stage !== f.stage) return false
    if (f.ack === 'unacked' && !isUnacknowledged(row)) return false
    if (f.ack === 'acked') {
      if (!row.simulated_notification) return false
      if (row.simulated_notification.acknowledged_at_utc == null) return false
    }
    if (q) {
      const id = String(row.customer_order.order_id)
      const ext = row.customer_order.external_order_id.toLowerCase()
      if (!id.includes(q) && !ext.includes(q)) return false
    }
    return true
  })
}

export function WorklistPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const filters = useMemo(() => filtersFromSearch(searchParams), [searchParams])

  const [data, setData] = useState<WorklistResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [pendingNotificationId, setPendingNotificationId] = useState<string | null>(
    null,
  )
  const [undoAck, setUndoAck] = useState<{
    notificationId: string
    orderLabel: string
  } | null>(null)

  const load = useCallback(async (opts?: { soft?: boolean }) => {
    if (opts?.soft) setRefreshing(true)
    else setLoading(true)
    setError(null)
    try {
      const res = await api.getWorklist({
        warehouse_id: 1,
        status: 'active',
        include_low_risk: true,
      })
      setData(res)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load worklist')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const key = 'worklist-scroll'
    const saved = sessionStorage.getItem(key)
    if (saved) {
      requestAnimationFrame(() => {
        window.scrollTo(0, Number(saved))
        sessionStorage.removeItem(key)
      })
    }
  }, [data])

  const setFilters = (next: WorklistFilterState) => {
    setSearchParams(searchFromFilters(next), { replace: true })
  }

  const visible = useMemo(() => {
    if (!data) return []
    let rows = applyClientFilters(data.items, filters)
    if (!filters.includeLow) {
      rows = rows.filter((r) => r.risk_band !== 'Low')
    }
    return rows
  }, [data, filters])

  const summaryExtras = useMemo(() => {
    if (!data) {
      return { acknowledgedActive: 0 }
    }
    const acknowledgedActive = data.items.filter(
      (r) =>
        r.simulated_notification != null &&
        r.simulated_notification.acknowledged_at_utc != null,
    ).length
    return { acknowledgedActive }
  }, [data])

  const filtersActive =
    Boolean(filters.q.trim()) ||
    Boolean(filters.risk) ||
    Boolean(filters.customerType) ||
    Boolean(filters.stage) ||
    Boolean(filters.ack) ||
    filters.includeLow

  const onReview = (orderId: number) => {
    sessionStorage.setItem('worklist-scroll', String(window.scrollY))
    sessionStorage.setItem('worklist-search', searchParams.toString())
    navigate(`/cases/${orderId}`)
  }

  const restoreAlert = useCallback(
    async (notificationId: string) => {
      setPendingNotificationId(notificationId)
      try {
        await api.unacknowledgeNotification({ notification_id: notificationId })
        setUndoAck((prev) =>
          prev?.notificationId === notificationId ? null : prev,
        )
        await load({ soft: true })
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Restore alert failed')
      } finally {
        setPendingNotificationId(null)
      }
    },
    [load],
  )

  const onAcknowledge = async (row: WorklistRow) => {
    const ntf = row.simulated_notification
    if (!ntf) return
    setPendingNotificationId(ntf.notification_id)
    try {
      await api.acknowledgeNotification({
        notification_id: ntf.notification_id,
        acknowledged_at_utc: new Date().toISOString(),
      })
      setUndoAck({
        notificationId: ntf.notification_id,
        orderLabel: row.customer_order.external_order_id,
      })
      await load({ soft: true })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Acknowledge failed')
    } finally {
      setPendingNotificationId(null)
    }
  }

  const onRestoreAlert = (row: WorklistRow) => {
    const ntf = row.simulated_notification
    if (!ntf) return
    void restoreAlert(ntf.notification_id)
  }

  useEffect(() => {
    if (!undoAck) return
    const t = window.setTimeout(() => setUndoAck(null), 10_000)
    return () => window.clearTimeout(t)
  }, [undoAck])

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">
          Orders needing attention
        </h1>
        <p className="text-muted-foreground">
          Prioritized worklist for the current warehouse scope. Sorted by{' '}
          <span className="font-mono text-xs">p_late</span> (high first).
        </p>
      </div>

      {data ? (
        <WorklistSummary
          visibleCount={visible.length}
          activeCount={data.summary.active_count}
          unacknowledgedCount={data.summary.unacknowledged_count}
          acknowledgedActiveCount={summaryExtras.acknowledgedActive}
          staleScoreCount={data.summary.stale_score_count}
        />
      ) : null}

      <WorklistFilters
        value={filters}
        onChange={setFilters}
        onClear={() => setSearchParams(new URLSearchParams(), { replace: true })}
        onRefresh={() => void load({ soft: true })}
        refreshing={refreshing}
      />

      {refreshing && data ? (
        <p className="text-xs text-muted-foreground" role="status">
          Refreshing… showing last snapshot.
        </p>
      ) : null}

      {error ? (
        <p className="rounded-sm border border-destructive/30 bg-destructive/5 px-3 py-2 text-destructive">
          {error}
          {data ? (
            <span className="mt-1 block text-xs text-muted-foreground">
              Showing last successful snapshot from {data.generated_at_utc}.
            </span>
          ) : null}
        </p>
      ) : null}

      {loading && !data ? (
        <div className="space-y-2" aria-busy="true" aria-label="Loading worklist">
          <div className="h-10 animate-pulse rounded-sm bg-muted" />
          <div className="h-40 animate-pulse rounded-sm bg-muted" />
        </div>
      ) : null}

      {data && visible.length === 0 && !filtersActive ? (
        <p className="rounded-sm border border-border bg-card px-3 py-3 text-sm text-muted-foreground">
          No orders currently need review.
        </p>
      ) : null}

      {data && visible.length === 0 && filtersActive ? (
        <div className="rounded-sm border border-border bg-card px-3 py-3 text-sm text-muted-foreground">
          <p>No orders match the current filters.</p>
          <button
            type="button"
            className="mt-2 cursor-pointer text-primary underline-offset-2 hover:underline"
            onClick={() =>
              setSearchParams(new URLSearchParams(), { replace: true })
            }
          >
            Clear filters
          </button>
        </div>
      ) : null}

      {data && visible.length > 0 ? (
        <WorklistTable
          rows={visible}
          onReview={onReview}
          onAcknowledge={(row) => void onAcknowledge(row)}
          onRestoreAlert={onRestoreAlert}
          pendingNotificationId={pendingNotificationId}
        />
      ) : null}

      {undoAck ? (
        <div
          className="fixed bottom-4 left-1/2 z-50 flex max-w-md -translate-x-1/2 items-center gap-3 rounded-sm border border-border bg-card px-3 py-2 text-sm shadow-md"
          role="status"
        >
          <span>
            Alert for{' '}
            <span className="font-medium">{undoAck.orderLabel}</span> acknowledged.
          </span>
          <button
            type="button"
            className="cursor-pointer font-medium text-primary underline-offset-2 hover:underline"
            disabled={pendingNotificationId === undoAck.notificationId}
            onClick={() => void restoreAlert(undoAck.notificationId)}
          >
            Undo
          </button>
          <button
            type="button"
            className="cursor-pointer text-muted-foreground underline-offset-2 hover:underline"
            onClick={() => setUndoAck(null)}
            aria-label="Dismiss"
          >
            Dismiss
          </button>
        </div>
      ) : null}
    </section>
  )
}

import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ShieldAlert, X } from 'lucide-react'
import { api } from '@/api'
import type { WorklistRow } from '@/shared/types'
import { Button } from '@/shared/ui/button'
import { cn } from '@/shared/lib/utils'
import { isUnacknowledged } from '@/features/worklist/worklistFormat'

export type UrgencyLevel = 'High' | 'Very High'

export type UrgentAlert = {
  id: string
  orderId: number
  orderRef: string
  level: UrgencyLevel
  title: string
  detail: string
}

const DISMISSED_KEY = 'dra-urgent-alerts-dismissed'
const POLL_MS = 12_000

function readDismissed(): Set<string> {
  try {
    const raw = sessionStorage.getItem(DISMISSED_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? new Set(parsed.map(String)) : new Set()
  } catch {
    return new Set()
  }
}

function writeDismissed(ids: Set<string>) {
  sessionStorage.setItem(DISMISSED_KEY, JSON.stringify([...ids]))
}

function fromWorklistRow(row: WorklistRow): UrgentAlert | null {
  if (row.risk_band !== 'High') return null
  if (!isUnacknowledged(row) && !row.risk_increased) return null
  const orderId = row.customer_order.order_id
  const orderRef = row.customer_order.external_order_id
  const id =
    row.simulated_notification?.notification_id ??
    `high-${row.risk_episode.episode_id}`
  return {
    id,
    orderId,
    orderRef,
    level: 'High',
    title: `High risk · ${orderRef}`,
    detail: 'This order needs attention soon — open it to review and decide.',
  }
}

function returnAlertFromFlags(
  rows: WorklistRow[],
  simulateReturn: boolean,
): UrgentAlert | null {
  if (!simulateReturn || rows.length === 0) return null
  // Prefer a High-risk open order so the demo feels consistent.
  const row =
    rows.find((r) => r.risk_band === 'High') ??
    rows.find((r) => r.worklist_item.status === 'active') ??
    rows[0]!
  const orderId = row.customer_order.order_id
  const orderRef = row.customer_order.external_order_id
  return {
    id: `return-${orderId}`,
    orderId,
    orderRef,
    level: 'Very High',
    title: `Very High · ${orderRef} returned`,
    detail:
      'Delivery reached the address but was returned. Handle this urgently — contact the customer or replan.',
  }
}

/**
 * Top-of-screen urgent alerts for High / Very High (returned delivery).
 * Polls the worklist while the shell is open.
 */
export function UrgentAlerts() {
  const [alerts, setAlerts] = useState<UrgentAlert[]>([])
  const [dismissed, setDismissed] = useState<Set<string>>(() => readDismissed())

  const refresh = useCallback(async () => {
    try {
      const [worklist, flags] = await Promise.all([
        api.getWorklist({
          warehouse_id: 1,
          status: 'active',
          include_low_risk: true,
        }),
        api.getSessionFlags(),
      ])

      const next: UrgentAlert[] = []
      const ret = returnAlertFromFlags(
        worklist.items,
        flags.simulate_delivery_return,
      )
      if (ret) next.push(ret)

      for (const row of worklist.items) {
        const alert = fromWorklistRow(row)
        if (!alert) continue
        // Avoid duplicating the same order when return scenario is on.
        if (ret && alert.orderId === ret.orderId) continue
        next.push(alert)
      }

      // Very High first, then High.
      next.sort((a, b) => {
        if (a.level === b.level) return 0
        return a.level === 'Very High' ? -1 : 1
      })

      setAlerts(next)
    } catch {
      /* keep last good alerts */
    }
  }, [])

  useEffect(() => {
    void refresh()
    const t = window.setInterval(() => void refresh(), POLL_MS)
    return () => window.clearInterval(t)
  }, [refresh])

  // Re-check when presenter flips demo flags or the window regains focus.
  useEffect(() => {
    const onFocus = () => void refresh()
    const onFlags = () => {
      setDismissed(readDismissed())
      void refresh()
    }
    window.addEventListener('focus', onFocus)
    window.addEventListener('dra-session-flags-changed', onFlags)
    return () => {
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('dra-session-flags-changed', onFlags)
    }
  }, [refresh])

  const visible = alerts.filter((a) => !dismissed.has(a.id))
  if (visible.length === 0) return null

  const dismiss = (id: string) => {
    setDismissed((prev) => {
      const next = new Set(prev)
      next.add(id)
      writeDismissed(next)
      return next
    })
  }

  return (
    <div
      className="fixed inset-x-0 top-0 z-50 flex flex-col gap-2 p-3 pointer-events-none sm:left-auto sm:right-3 sm:top-3 sm:w-[24rem] sm:p-0"
      aria-live="assertive"
    >
      {visible.slice(0, 3).map((a) => (
        <UrgentCard key={a.id} alert={a} onDismiss={() => dismiss(a.id)} />
      ))}
    </div>
  )
}

function UrgentCard({
  alert,
  onDismiss,
}: {
  alert: UrgentAlert
  onDismiss: () => void
}) {
  const very = alert.level === 'Very High'
  return (
    <div
      role="alert"
      className={cn(
        'pointer-events-auto rounded-sm border px-3 py-2.5 shadow-md',
        very
          ? 'border-risk-high/50 bg-risk-high text-risk-high-foreground'
          : 'border-risk-high/40 bg-card text-foreground',
      )}
    >
      <div className="flex items-start gap-2">
        <span
          className={cn(
            'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-sm',
            very ? 'bg-white/15' : 'bg-risk-high/10 text-risk-high',
          )}
        >
          {very ? (
            <ShieldAlert className="size-4" aria-hidden />
          ) : (
            <AlertTriangle className="size-4" aria-hidden />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                'rounded-sm px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                very ? 'bg-white/20' : 'bg-risk-high/10 text-risk-high',
              )}
            >
              {alert.level}
            </span>
            <p className="text-sm font-semibold">{alert.title}</p>
          </div>
          <p
            className={cn(
              'mt-1 text-xs leading-5',
              very ? 'text-white/90' : 'text-muted-foreground',
            )}
          >
            {alert.detail}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Link
              to={`/cases/${alert.orderId}`}
              className={cn(
                'inline-flex h-7 items-center rounded-sm px-2.5 text-xs font-medium',
                very
                  ? 'bg-white text-risk-high hover:bg-white/90'
                  : 'bg-risk-high text-risk-high-foreground hover:bg-risk-high/90',
              )}
            >
              Open order
            </Link>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className={cn(
                'h-7 px-2 text-xs',
                very && 'text-white hover:bg-white/10 hover:text-white',
              )}
              onClick={onDismiss}
            >
              Dismiss
            </Button>
          </div>
        </div>
        <button
          type="button"
          className={cn(
            'shrink-0 rounded-sm p-1',
            very
              ? 'text-white/80 hover:bg-white/10 hover:text-white'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground',
          )}
          aria-label="Dismiss alert"
          onClick={onDismiss}
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>
    </div>
  )
}

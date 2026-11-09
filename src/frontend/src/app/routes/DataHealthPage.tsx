import { useCallback, useEffect, useState } from 'react'
import { api } from '@/api'
import type { DataHealthSnapshot } from '@/shared/types'
import {
  canOpenDataHealth,
  canSeeDataHealthDetail,
  getDemoRole,
  setDemoRole,
  type DemoRole,
} from '@/shared/demoRole'
import {
  DataHealthPanel,
  aiAssistBadgeClass,
  aiAssistStatus,
} from '@/features/data-health'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'

export function DataHealthPage() {
  const [role, setRole] = useState<DemoRole>(() => getDemoRole())
  const [snap, setSnap] = useState<DataHealthSnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [toggling, setToggling] = useState(false)

  const allowed = canOpenDataHealth(role)
  const detailLevel = canSeeDataHealthDetail(role) ? 'full' : 'summary'

  const load = useCallback(async (soft?: boolean) => {
    if (soft) setRefreshing(true)
    else setLoading(true)
    setError(null)
    try {
      setSnap(await api.getDataHealth())
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load data health')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    if (allowed) void load()
    else {
      setLoading(false)
      setSnap(null)
    }
  }, [allowed, load])

  const onRoleChange = (next: DemoRole) => {
    setDemoRole(next)
    setRole(next)
  }

  const onToggleAgent = async (enabled: boolean) => {
    setToggling(true)
    setError(null)
    try {
      setSnap(await api.setAgentEnabled(enabled))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to toggle agent')
    } finally {
      setToggling(false)
    }
  }

  const ai = snap ? aiAssistStatus(snap) : null

  return (
    <section className="space-y-3">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
          <h1 className="text-lg font-semibold tracking-tight">Data health</h1>

          <label className="flex items-center gap-1 text-xs text-muted-foreground">
            <span className="sr-only">Demo role</span>
            <select
              className="h-7 cursor-pointer rounded-sm border border-border bg-background px-1.5 text-xs text-foreground"
              value={role}
              onChange={(e) => onRoleChange(e.target.value as DemoRole)}
              aria-label="Demo role"
              title="Demo role stub — not real auth"
            >
              <option value="dispatcher">dispatcher</option>
              <option value="operator">operator</option>
              <option value="viewer">viewer</option>
            </select>
          </label>

          {allowed ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 px-2 text-xs"
              disabled={refreshing || loading}
              title="Reloads session DB health only — does not sync ERP/TMS"
              onClick={() => void load(true)}
            >
              {refreshing ? 'Refreshing…' : 'Refresh'}
            </Button>
          ) : null}

          {allowed && snap && ai ? (
            <span className="ml-auto flex flex-wrap items-center gap-1.5">
              <Badge
                variant="outline"
                className={aiAssistBadgeClass(ai)}
                title="AI assist: Available / Unavailable / Incomplete (F7)"
              >
                AI assist · {ai}
              </Badge>
              {detailLevel === 'full' ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs"
                  disabled={toggling}
                  title="Session demo flag only — not ERP sync"
                  onClick={() => void onToggleAgent(!snap.agent_enabled)}
                >
                  {snap.agent_enabled ? 'Turn AI off' : 'Turn AI on'}
                </Button>
              ) : null}
            </span>
          ) : null}
        </div>

        <p className="text-xs text-muted-foreground">
          Is current data fresh enough to decide? Separate from Performance
          (delivery outcomes / pilot metrics).
        </p>
      </header>

      {!allowed ? (
        <div
          className="rounded-sm border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm"
          role="alert"
        >
          <span className="font-medium text-destructive">403</span>
          <span className="text-muted-foreground">
            {' '}
            — viewer cannot open data health. Use dispatcher or operator.
          </span>
        </div>
      ) : null}

      {allowed && loading && !snap ? (
        <div
          className="space-y-2"
          aria-busy="true"
          aria-label="Loading data health"
        >
          <div className="h-7 animate-pulse rounded-sm bg-muted" />
          <div className="h-40 animate-pulse rounded-sm bg-muted" />
        </div>
      ) : null}

      {allowed && error ? (
        <div className="flex flex-wrap items-center gap-2">
          <p className="rounded-sm border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void load()}
          >
            Retry
          </Button>
        </div>
      ) : null}

      {allowed && snap ? (
        <DataHealthPanel
          snap={snap}
          detailLevel={detailLevel}
          agentOff={!snap.agent_enabled}
        />
      ) : null}
    </section>
  )
}

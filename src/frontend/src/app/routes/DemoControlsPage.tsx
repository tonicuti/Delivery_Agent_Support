import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { Link } from 'react-router-dom'
import { api } from '@/api'
import type { SessionFlags } from '@/shared/types'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'

/**
 * F8 demo affordances — session flags only. Not production ops.
 */
export function DemoControlsPage() {
  const [flags, setFlags] = useState<SessionFlags | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setError(null)
    try {
      setFlags(await api.getSessionFlags())
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load flags')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const patch = async (partial: Partial<SessionFlags>) => {
    setBusy(true)
    setError(null)
    try {
      setFlags(await api.setSessionFlags(partial))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update flags')
    } finally {
      setBusy(false)
    }
  }

  const active = useMemo(() => {
    if (!flags) return [] as string[]
    const out: string[] = []
    if (!flags.agent_enabled) out.push('AI assist off')
    if (flags.force_ai_unavailable) out.push('Force AI unavailable')
    if (flags.force_stale_scores) out.push('Force stale scores')
    if (flags.simulate_conflict_on_save) out.push('Next save → conflict 409')
    if (flags.simulate_risk_increase) out.push('Risk increased badge')
    return out
  }, [flags])

  return (
    <section className="mx-auto max-w-2xl space-y-4">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-lg font-semibold tracking-tight">
            Demo controls
          </h1>
          <Badge variant="secondary">Not production</Badge>
          <Badge variant="outline">Session DB only</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Toggle simulated F8 scenarios (AI failure, stale data, save conflict,
          risk increase). Affects the session DB copy only — not ERP/TMS and not
          the team source database.
        </p>
      </div>

      <div
        className="rounded-sm border border-border bg-card px-3 py-2 text-sm"
        role="status"
      >
        <div className="text-xs font-medium text-muted-foreground">
          Currently active
        </div>
        {active.length === 0 ? (
          <p className="mt-0.5 text-muted-foreground">
            None — worklist and cases use normal session data.
          </p>
        ) : (
          <ul className="mt-1 flex flex-wrap gap-1.5">
            {active.map((a) => (
              <li key={a}>
                <Badge variant="outline">{a}</Badge>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error ? (
        <p className="rounded-sm border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {!flags ? (
        <div className="h-24 animate-pulse rounded-sm bg-muted" aria-busy="true" />
      ) : (
        <div className="space-y-4">
          <FlagGroup title="1. AI assist">
            <FlagRow
              label="AI assist enabled"
              what="Allow agent suggestions on cases."
              where="Data health badge · Case → AI recommendation"
              checked={flags.agent_enabled}
              disabled={busy}
              onChange={(v) => void patch({ agent_enabled: v })}
              onLabel="On"
              offLabel="Off → Unavailable"
            />
            <FlagRow
              label="Force AI unavailable"
              what="Mask every suggestion as Unavailable (even if AI is on)."
              where="Worklist AI n/a chip · Case Decide still works (manual)"
              checked={flags.force_ai_unavailable}
              disabled={busy}
              onChange={(v) => void patch({ force_ai_unavailable: v })}
            />
          </FlagGroup>

          <FlagGroup title="2. Data freshness">
            <FlagRow
              label="Force stale scores"
              what="Shift scored_at_utc past the 90-minute demo threshold."
              where="Worklist Flags · Stale · Case banner / Stale score"
              checked={flags.force_stale_scores}
              disabled={busy}
              onChange={(v) => void patch({ force_stale_scores: v })}
            />
          </FlagGroup>

          <FlagGroup title="3. Decision resilience">
            <FlagRow
              label="Simulate concurrent decision"
              what="Next Save decision returns 409 once, then clears itself."
              where="Open case → Decide → Save · form kept · Reload case"
              checked={flags.simulate_conflict_on_save}
              disabled={busy}
              onChange={(v) => void patch({ simulate_conflict_on_save: v })}
            />
            <FlagRow
              label="Simulate risk increase"
              what="Force Risk increased badge (same episode, no duplicate row)."
              where="Worklist Risk column · Case header"
              checked={flags.simulate_risk_increase}
              disabled={busy}
              onChange={(v) => void patch({ simulate_risk_increase: v })}
            />
          </FlagGroup>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => void load()}
        >
          Refresh flags
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={busy || active.length === 0}
          onClick={() =>
            void patch({
              agent_enabled: true,
              force_ai_unavailable: false,
              force_stale_scores: false,
              simulate_conflict_on_save: false,
              simulate_risk_increase: false,
            })
          }
        >
          Clear all forces
        </Button>
        <Link
          to="/dashboard"
          className="ml-auto text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          ← Back to worklist to verify
        </Link>
      </div>
    </section>
  )
}

function FlagGroup({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <section className="space-y-2">
      <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {title}
      </h2>
      <ul className="space-y-2">{children}</ul>
    </section>
  )
}

function FlagRow({
  label,
  what,
  where,
  checked,
  disabled,
  onChange,
  onLabel = 'On',
  offLabel = 'Off',
}: {
  label: string
  what: string
  where: string
  checked: boolean
  disabled: boolean
  onChange: (next: boolean) => void
  onLabel?: string
  offLabel?: string
}) {
  return (
    <li
      className={[
        'rounded-sm border px-3 py-2.5',
        checked
          ? 'border-foreground/25 bg-muted/40'
          : 'border-border bg-card',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="text-sm font-medium">{label}</div>
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground/80">What: </span>
            {what}
          </p>
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground/80">Check on: </span>
            {where}
          </p>
        </div>
        <label className="flex shrink-0 cursor-pointer flex-col items-end gap-1 text-xs">
          <span
            className={
              checked
                ? 'font-semibold text-foreground'
                : 'text-muted-foreground'
            }
          >
            {checked ? onLabel : offLabel}
          </span>
          <input
            type="checkbox"
            className="size-4 cursor-pointer"
            checked={checked}
            disabled={disabled}
            onChange={(e) => onChange(e.target.checked)}
            aria-label={label}
          />
        </label>
      </div>
    </li>
  )
}

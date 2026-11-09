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
import { PageHero } from '@/shared/ui/PageHero'

/**
 * Presenter-only switches — turn on edge cases during a live demo.
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
      setError(err instanceof Error ? err.message : 'Could not load demo settings')
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
      window.dispatchEvent(new Event('dra-session-flags-changed'))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not update demo settings')
    } finally {
      setBusy(false)
    }
  }

  const active = useMemo(() => {
    if (!flags) return [] as string[]
    const out: string[] = []
    if (!flags.agent_enabled) out.push('Suggestions off')
    if (flags.force_ai_unavailable) out.push('Suggestions unavailable')
    if (flags.force_stale_scores) out.push('Outdated checks')
    if (flags.simulate_conflict_on_save) out.push('Next save may conflict')
    if (flags.simulate_risk_increase) out.push('Getting riskier badge')
    if (flags.simulate_delivery_return) out.push('Returned delivery (Very High)')
    return out
  }, [flags])

  return (
    <section className="mx-auto max-w-2xl space-y-4">
      <PageHero
        tone="home"
        title="Demo controls"
        description="For the person running the demo. Flip these switches to show special situations (no suggestion, outdated data, save conflict). They only change this demo — not real warehouse or transport systems."
      />

      <div className="rounded-sm border border-border bg-card px-3 py-3 text-sm">
        <h2 className="text-sm font-semibold">What is this for?</h2>
        <ol className="mt-2 list-decimal space-y-1.5 pl-4 text-muted-foreground">
          <li>Keep everything off for the normal happy-path demo.</li>
          <li>
            Turn one switch on when you want to show an edge case (for example
            “suggestions unavailable”).
          </li>
          <li>
            Go to{' '}
            <Link to="/dashboard" className="font-medium text-primary hover:underline">
              Orders needing attention
            </Link>{' '}
            (or an order page) and point at the badge / message that appeared.
          </li>
          <li>Use Clear all before the next scenario.</li>
        </ol>
      </div>

      <div
        className="rounded-sm border border-border bg-card px-3 py-2 text-sm"
        role="status"
      >
        <div className="text-xs font-medium text-muted-foreground">
          Currently on
        </div>
        {active.length === 0 ? (
          <p className="mt-0.5 text-muted-foreground">
            None — normal demo data. Good for the main walkthrough.
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
          <FlagGroup title="Suggestions">
            <FlagRow
              label="Suggestions enabled"
              when="Leave on for the normal demo."
              effect="Suggested next steps appear on orders."
              checked={flags.agent_enabled}
              disabled={busy}
              onChange={(v) => void patch({ agent_enabled: v })}
              onLabel="On"
              offLabel="Off → no suggestion"
            />
            <FlagRow
              label="Make suggestions unavailable"
              when="You want to show “no suggestion available” and decide by hand."
              effect="Every order shows No suggestion. Choosing an action still works."
              checked={flags.force_ai_unavailable}
              disabled={busy}
              onChange={(v) => void patch({ force_ai_unavailable: v })}
            />
          </FlagGroup>

          <FlagGroup title="Data freshness">
            <FlagRow
              label="Make checks look outdated"
              when="You want to show the Outdated warning."
              effect="Orders get an Outdated badge and a banner on the order page."
              checked={flags.force_stale_scores}
              disabled={busy}
              onChange={(v) => void patch({ force_stale_scores: v })}
            />
          </FlagGroup>

          <FlagGroup title="Urgent screen alerts">
            <FlagRow
              label="Simulate returned delivery (Very High)"
              when="You want a pop-up while working: arrived but returned."
              effect="A red Very High alert appears on screen with Open order."
              checked={flags.simulate_delivery_return}
              disabled={busy}
              onChange={(v) => {
                if (v) {
                  try {
                    sessionStorage.removeItem('dra-urgent-alerts-dismissed')
                  } catch {
                    /* ignore */
                  }
                }
                void patch({ simulate_delivery_return: v })
              }}
            />
            <FlagRow
              label="Show “Getting riskier”"
              when="You want to show risk rising on the same alert."
              effect="Orders list and order header show Getting riskier."
              checked={flags.simulate_risk_increase}
              disabled={busy}
              onChange={(v) => void patch({ simulate_risk_increase: v })}
            />
          </FlagGroup>

          <FlagGroup title="While saving a decision">
            <FlagRow
              label="Simulate a save conflict"
              when="You want to show two people saving at once."
              effect="The next save fails once with a conflict, then clears itself."
              checked={flags.simulate_conflict_on_save}
              disabled={busy}
              onChange={(v) => void patch({ simulate_conflict_on_save: v })}
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
          Refresh
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
              simulate_delivery_return: false,
            })
          }
        >
          Clear all
        </Button>
        <Link
          to="/dashboard"
          className="ml-auto text-xs font-medium text-primary underline-offset-2 hover:underline"
        >
          Go check on orders →
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
  when,
  effect,
  checked,
  disabled,
  onChange,
  onLabel = 'On',
  offLabel = 'Off',
}: {
  label: string
  when: string
  effect: string
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
        checked ? 'border-foreground/25 bg-muted/40' : 'border-border bg-card',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="text-sm font-medium">{label}</div>
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground/80">Use when: </span>
            {when}
          </p>
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground/80">What you will see: </span>
            {effect}
          </p>
        </div>
        <label className="flex shrink-0 cursor-pointer flex-col items-end gap-1 text-xs">
          <span
            className={
              checked ? 'font-semibold text-foreground' : 'text-muted-foreground'
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

import type { DataHealthSnapshot } from '@/shared/types'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import {
  buildHealthSignals,
  formatAge,
  formatUtc,
} from './healthFormat'

type Props = {
  snap: DataHealthSnapshot
  refreshing?: boolean
  togglingAgent?: boolean
  onRefresh: () => void
  onToggleAgent: (enabled: boolean) => void
}

export function DataHealthPanel({
  snap,
  refreshing,
  togglingAgent,
  onRefresh,
  onToggleAgent,
}: Props) {
  const signals = buildHealthSignals(snap)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={refreshing}
          title="Reloads session DB health signals only — does not force ERP/TMS to export new data"
          onClick={onRefresh}
        >
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </Button>
        <span className="text-xs text-muted-foreground">
          Reloads app/session data only — does not push ERP to export.
        </span>
      </div>

      <div className="rounded-sm border border-border bg-card px-3 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold">Agent process</h2>
            <p className="text-xs text-muted-foreground">
              Session demo flag (`.data/session_flags.json`), not a schema column.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={snap.agent_enabled ? 'secondary' : 'outline'}>
              {snap.agent_enabled ? 'Agent ON' : 'Agent OFF'}
            </Badge>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={togglingAgent}
              onClick={() => onToggleAgent(!snap.agent_enabled)}
            >
              {snap.agent_enabled ? 'Turn off' : 'Turn on'}
            </Button>
          </div>
        </div>
        {!snap.agent_enabled ? (
          <p className="mt-2 text-sm text-risk-medium" role="status">
            Agent is off for this session. New recommendations will not be
            produced until turned back on (case UI still shows last stored
            recommendation).
          </p>
        ) : null}
      </div>

      <div className="overflow-x-auto rounded-sm border border-border bg-card">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead className="border-b border-border bg-muted/60 text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Signal</th>
              <th className="px-3 py-2 font-medium">Last update</th>
              <th className="px-3 py-2 font-medium">Age</th>
              <th className="px-3 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {signals.map((s) => (
              <tr key={s.id} className="border-b border-border last:border-0">
                <td className="px-3 py-2">
                  <div className="font-medium">{s.label}</div>
                  <div className="font-mono text-[10px] text-muted-foreground">
                    {s.sourceHint}
                  </div>
                </td>
                <td className="px-3 py-2 text-xs">{formatUtc(s.at_utc)}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {formatAge(s.at_utc)}
                </td>
                <td className="px-3 py-2">
                  {!s.at_utc ? (
                    <Badge variant="outline">Missing</Badge>
                  ) : s.stale ? (
                    <Badge variant="outline" className="text-risk-medium">
                      Stale (&gt;{snap.stale_after_minutes}m)
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Fresh</Badge>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <dl className="grid gap-3 rounded-sm border border-border bg-card px-3 py-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <dt className="text-xs text-muted-foreground">Model / rules version</dt>
          <dd className="break-all font-mono text-xs">
            {snap.model_version ?? '—'}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">
            Stale scores (active worklist)
          </dt>
          <dd>{snap.stale_score_count}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">
            Missing promised window (active)
          </dt>
          <dd>{snap.missing_promise_count}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Stale policy</dt>
          <dd>{snap.stale_after_minutes} minutes (DATA_STALE)</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Snapshot generated</dt>
          <dd className="text-xs">{formatUtc(snap.generated_at_utc)}</dd>
        </div>
      </dl>
    </div>
  )
}

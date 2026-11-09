import { useState } from 'react'
import type { DataHealthSnapshot } from '@/shared/types'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import {
  buildHealthSignals,
  formatAge,
  formatUtc,
  primaryStatus,
  statusBadgeClass,
  type HealthSignal,
} from './healthFormat'

type Props = {
  snap: DataHealthSnapshot
  detailLevel: 'full' | 'summary'
  agentOff?: boolean
}

export function DataHealthPanel({ snap, detailLevel, agentOff }: Props) {
  const signals = buildHealthSignals(snap)
  const attention = signals.filter((s) => primaryStatus(s.statuses) !== 'Fresh')

  return (
    <div className="space-y-3">
      {agentOff ? (
        <p
          className="rounded-sm border border-risk-medium/40 bg-risk-medium/10 px-3 py-1.5 text-xs"
          role="status"
        >
          AI assist is Unavailable — last stored recommendations may still appear
          on cases; verify evidence manually.
        </p>
      ) : null}

      {detailLevel === 'full' ? (
        <OperatorFeedTable snap={snap} signals={signals} />
      ) : (
        <DispatcherImpactView
          snap={snap}
          attention={attention}
          total={signals.length}
        />
      )}
    </div>
  )
}

/** IT / data operator — F7 UI cấp 2 table + row detail. */
function OperatorFeedTable({
  snap,
  signals,
}: {
  snap: DataHealthSnapshot
  signals: HealthSignal[]
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = signals.find((s) => s.id === selectedId) ?? null

  const toggle = (id: string) => {
    setSelectedId((cur) => (cur === id ? null : id))
  }

  return (
    <section className="space-y-1.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold tracking-tight">Feed status</h2>
        <p
          className="text-[10px] text-muted-foreground"
          title="Demo MCP DATA_STALE policy — not a production SLA per feed"
        >
          Click a row for detail · Stale after {snap.stale_after_minutes} min
          (demo policy)
        </p>
      </div>

      <div className="overflow-x-auto rounded-sm border border-border bg-card">
        <table className="w-full min-w-[62rem] table-fixed text-left text-sm">
          <colgroup>
            <col className="w-[11rem]" />
            <col className="w-[9rem]" />
            <col className="w-[8.5rem]" />
            <col className="w-[8.5rem]" />
            <col className="w-[8.5rem]" />
            <col className="w-[5.5rem]" />
            <col className="w-[4.5rem]" />
            <col />
            <col className="w-[7.5rem]" />
          </colgroup>
          <thead className="border-b border-border bg-muted/60 text-xs text-muted-foreground">
            <tr>
              <th className="px-2.5 py-1.5 font-medium">Source</th>
              <th className="px-2.5 py-1.5 font-medium">Scope</th>
              <th className="px-2.5 py-1.5 font-medium">Status</th>
              <th className="px-2.5 py-1.5 font-medium">Last update</th>
              <th className="px-2.5 py-1.5 font-medium">Last success</th>
              <th className="px-2.5 py-1.5 font-medium">Age</th>
              <th className="px-2.5 py-1.5 font-medium">Affected</th>
              <th className="px-2.5 py-1.5 font-medium">Issue</th>
              <th className="px-2.5 py-1.5 font-medium">Owner</th>
            </tr>
          </thead>
          <tbody>
            {signals.map((s) => {
              const issue =
                [s.errorHint, s.affectedHint].filter(Boolean).join(' · ') ||
                '—'
              const open = selectedId === s.id
              return (
                <tr
                  key={s.id}
                  tabIndex={0}
                  role="button"
                  aria-expanded={open}
                  aria-controls={`feed-detail-${s.id}`}
                  aria-label={`${s.label} — view detail`}
                  className={[
                    'cursor-pointer border-b border-border last:border-0 outline-none',
                    'hover:bg-muted/50 focus-visible:bg-muted/60',
                    open ? 'bg-muted/40' : '',
                  ].join(' ')}
                  onClick={() => toggle(s.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      toggle(s.id)
                    }
                  }}
                >
                  <td className="truncate px-2.5 py-1.5 font-medium leading-tight" title={s.label}>
                    {s.label}
                  </td>
                  <td
                    className="truncate px-2.5 py-1.5 text-xs text-muted-foreground"
                    title={s.scopeHint}
                  >
                    {s.scopeHint}
                  </td>
                  <td className="px-2.5 py-1.5">
                    <div className="flex flex-nowrap gap-0.5 overflow-hidden">
                      {s.statuses.map((st) => (
                        <Badge
                          key={st}
                          variant="outline"
                          className={`shrink-0 whitespace-nowrap ${statusBadgeClass(st)}`}
                        >
                          {st}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-2.5 py-1.5 text-xs tabular-nums">
                    {formatUtc(s.at_utc)}
                  </td>
                  <td
                    className="whitespace-nowrap px-2.5 py-1.5 text-xs tabular-nums text-muted-foreground"
                    title="Session DB has one latest clock per source — not a separate success vs attempt column"
                  >
                    {formatUtc(s.last_success_utc)}
                  </td>
                  <td className="whitespace-nowrap px-2.5 py-1.5 font-mono text-xs text-muted-foreground">
                    {formatAge(s.at_utc)}
                  </td>
                  <td className="whitespace-nowrap px-2.5 py-1.5 font-mono text-xs tabular-nums">
                    {s.affectedCount != null ? s.affectedCount : '—'}
                  </td>
                  <td
                    className="truncate px-2.5 py-1.5 text-xs text-muted-foreground"
                    title={issue === '—' ? undefined : issue}
                  >
                    {issue}
                  </td>
                  <td
                    className="truncate px-2.5 py-1.5 text-xs text-muted-foreground"
                    title={s.ownerHint}
                  >
                    {s.ownerHint}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {selected ? (
        <FeedSourceDetail
          signal={selected}
          staleAfterMinutes={snap.stale_after_minutes}
          onClose={() => setSelectedId(null)}
        />
      ) : null}

      <p className="text-[10px] text-muted-foreground">
        Model {snap.model_version ?? '—'} · Snapshot {formatUtc(snap.generated_at_utc)} ·
        Refresh reloads this view only (does not sync ERP/TMS)
      </p>
    </section>
  )
}

function FeedSourceDetail({
  signal,
  staleAfterMinutes,
  onClose,
}: {
  signal: HealthSignal
  staleAfterMinutes: number
  onClose: () => void
}) {
  const primary = primaryStatus(signal.statuses)

  return (
    <aside
      id={`feed-detail-${signal.id}`}
      className="rounded-sm border border-border bg-card px-3 py-3"
      aria-label={`${signal.label} detail`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold">{signal.label}</h3>
            <Badge variant="outline" className={statusBadgeClass(primary)}>
              {primary}
            </Badge>
            {signal.statuses
              .filter((st) => st !== primary)
              .map((st) => (
                <Badge
                  key={st}
                  variant="outline"
                  className={statusBadgeClass(st)}
                >
                  {st}
                </Badge>
              ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Full feed detail for operators — session view only, not a live sync
            console.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs"
          onClick={onClose}
        >
          Close
        </Button>
      </div>

      <dl className="mt-3 grid gap-2 sm:grid-cols-2">
        <DetailField label="Scope" value={signal.scopeHint} />
        <DetailField label="Owner to contact" value={signal.ownerHint} />
        <DetailField
          label="Last update"
          value={`${formatUtc(signal.at_utc)} · ${formatAge(signal.at_utc)}`}
        />
        <DetailField
          label="Last success"
          value={formatUtc(signal.last_success_utc)}
          hint="Same clock as last update in this demo session DB"
        />
        <DetailField
          label="Stale policy"
          value={`Older than ${staleAfterMinutes} min → Stale (demo)`}
        />
        <DetailField
          label="Records affected"
          value={
            signal.affectedCount != null
              ? String(signal.affectedCount)
              : 'Not measured in session'
          }
        />
        <DetailField
          label="Issue"
          value={signal.errorHint ?? 'None reported'}
          className="sm:col-span-2"
        />
        <DetailField
          label="Impact if wrong / old"
          value={signal.affectedHint ?? 'No specific impact note'}
          className="sm:col-span-2"
        />
        <DetailField
          label="What to do"
          value={whatToDo(signal)}
          className="sm:col-span-2"
        />
      </dl>
    </aside>
  )
}

function whatToDo(signal: HealthSignal): string {
  const primary = primaryStatus(signal.statuses)
  if (primary === 'Fresh' && signal.statuses.length === 1) {
    return 'No action — feed looks fresh within the demo threshold. Refresh this page if you need a newer snapshot.'
  }
  if (signal.id === 'ai') {
    return 'Dispatchers can still decide manually from case evidence. Turn AI on (header) only if this was a demo/session disable; check failed runs with agent ops if Failed persists.'
  }
  if (primary === 'Missing' || primary === 'Failed') {
    return `Contact ${signal.ownerHint}. Keep using the last known snapshot if shown, and tell dispatchers this source is not trustworthy until restored.`
  }
  if (primary === 'Stale' || primary === 'Partial') {
    return `Verify the latest values in the source system (${signal.ownerHint}). Warn dispatchers before they act on this feed alone.`
  }
  return `Review with ${signal.ownerHint} before dispatchers rely on this feed.`
}

function DetailField({
  label,
  value,
  hint,
  className,
}: {
  label: string
  value: string
  hint?: string
  className?: string
}) {
  return (
    <div className={className}>
      <dt className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm" title={hint}>
        {value}
      </dd>
    </div>
  )
}

/**
 * Dispatcher / dispatch lead — impact only, no internal feed dump (F7 role gate).
 */
function DispatcherImpactView({
  snap,
  attention,
  total,
}: {
  snap: DataHealthSnapshot
  attention: HealthSignal[]
  total: number
}) {
  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold tracking-tight">
          Decision impact
        </h2>
        <span className="text-[10px] text-muted-foreground">
          Operator role → full feed table
        </span>
      </div>

      <ul className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
        <ImpactTile
          label="Stale scores"
          value={snap.stale_score_count}
          hint="Active worklist scores older than demo threshold"
        />
        <ImpactTile
          label="Missing promise"
          value={snap.missing_promise_count}
          hint="Cannot assess — promised window missing"
        />
        <ImpactTile
          label="AI unavailable"
          value={snap.recommendation_unavailable_count}
          hint="Recommendations with validation_status unavailable"
        />
        <ImpactTile
          label="Failed agent runs"
          value={snap.agent_run_failed_count}
          hint="agent_run.status = failed"
        />
      </ul>

      {attention.length === 0 ? (
        <p className="rounded-sm border border-border bg-card px-3 py-2 text-sm text-muted-foreground">
          All {total} tracked sources look Fresh within the demo{' '}
          {snap.stale_after_minutes}m threshold.
        </p>
      ) : (
        <ul className="space-y-1.5" aria-label="Sources needing attention">
          {attention.map((s) => {
            const primary = primaryStatus(s.statuses)
            return (
              <li
                key={s.id}
                className="flex flex-wrap items-center gap-2 rounded-sm border border-border bg-card px-2.5 py-1.5 text-sm"
              >
                <span className="font-medium">{s.label}</span>
                <Badge variant="outline" className={statusBadgeClass(primary)}>
                  {primary}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {formatAge(s.at_utc)}
                </span>
                {s.affectedHint || s.errorHint ? (
                  <span className="w-full text-xs text-muted-foreground sm:ml-auto sm:w-auto">
                    {s.affectedHint ?? s.errorHint}
                  </span>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}

      <p className="text-[10px] text-muted-foreground">
        Stale after {snap.stale_after_minutes} min (demo) ·{' '}
        {formatUtc(snap.generated_at_utc)}
      </p>
    </section>
  )
}

function ImpactTile({
  label,
  value,
  hint,
}: {
  label: string
  value: number
  hint: string
}) {
  const hot = value > 0
  return (
    <li
      className="rounded-sm border border-border bg-card px-2.5 py-2"
      title={hint}
    >
      <div className="text-xs text-muted-foreground">{label}</div>
      <div
        className={
          hot
            ? 'mt-0.5 text-lg font-semibold tabular-nums'
            : 'mt-0.5 text-lg tabular-nums text-muted-foreground'
        }
      >
        {value}
      </div>
    </li>
  )
}

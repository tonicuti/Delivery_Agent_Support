import { Badge } from '@/shared/ui/badge'
import { formatUtc, type CaseReason } from './caseFormat'

type Props = { reasons: CaseReason[] }

export function CaseReasons({ reasons }: Props) {
  return (
    <section className="space-y-3" aria-labelledby="case-reasons-heading">
      <h2 id="case-reasons-heading" className="text-sm font-semibold tracking-tight">
        Why this order is at risk
      </h2>
      {reasons.length === 0 ? (
        <p className="rounded-sm border border-border bg-card px-3 py-3 text-sm text-muted-foreground">
          No structured reason codes or observable delay signals in the current
          snapshot. Review evidence sections below before acting.
        </p>
      ) : (
        <ul className="space-y-2">
          {reasons.map((r) => (
            <li
              key={r.id}
              className="rounded-sm border border-border bg-card px-3 py-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-medium">{r.label}</h3>
                {r.needsVerification ? (
                  <Badge variant="outline">Needs verification</Badge>
                ) : null}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{r.evidence}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                Source: {r.source} · Updated: {formatUtc(r.updated_at_utc)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

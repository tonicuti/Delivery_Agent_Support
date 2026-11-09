import type { CaseReason } from './caseFormat'

type Props = { reasons: CaseReason[] }

export function CaseReasons({ reasons }: Props) {
  return (
    <section className="space-y-2" aria-labelledby="case-reasons-heading">
      <h2
        id="case-reasons-heading"
        className="text-sm font-semibold tracking-tight"
      >
        Why this order may be late
      </h2>
      {reasons.length === 0 ? (
        <p className="rounded-sm border border-border bg-card px-3 py-2 text-sm text-muted-foreground">
          No clear reason yet. Check stock and delivery times below.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {reasons.map((r) => (
            <li
              key={r.id}
              className="rounded-sm border border-border bg-card px-3 py-2"
            >
              <h3 className="text-sm font-medium">{r.label}</h3>
              {r.evidence ? (
                <p className="mt-0.5 text-sm text-muted-foreground">{r.evidence}</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

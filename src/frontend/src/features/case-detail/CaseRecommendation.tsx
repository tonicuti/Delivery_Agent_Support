import type { CaseDetail } from '@/shared/types'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import {
  decisionBlockedReason,
  formatUtc,
  parseRecommendationOutput,
  playbookLabel,
  recommendationUiStatus,
  type RecommendationViewStatus,
} from './caseFormat'

type Props = {
  detail: CaseDetail
  onDecide?: () => void
}

const STATUS_COPY: Record<
  RecommendationViewStatus,
  { label: string; hint: string }
> = {
  checking: {
    label: 'Checking',
    hint: 'Recommendation is still being prepared.',
  },
  ready: {
    label: 'Ready',
    hint: 'Validated suggestion — verify evidence before deciding.',
  },
  incomplete: {
    label: 'Incomplete',
    hint: 'Suggestion incomplete/invalid. Manual action is available.',
  },
  unavailable: {
    label: 'Unavailable',
    hint: 'No usable AI suggestion. Decide manually from evidence.',
  },
}

export function CaseRecommendation({ detail, onDecide }: Props) {
  const status = recommendationUiStatus(detail)
  const copy = STATUS_COPY[status]
  const rec = detail.agent_recommendation
  const parsed = parseRecommendationOutput(detail)
  const blocked = decisionBlockedReason(detail)
  const canDecide =
    !blocked &&
    (status === 'ready' || status === 'incomplete' || status === 'unavailable')

  return (
    <section
      className="space-y-2.5 rounded-sm border border-border bg-card px-3 py-3"
      aria-labelledby="case-ai-heading"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2
          id="case-ai-heading"
          className="text-sm font-semibold tracking-tight"
        >
          AI recommendation
        </h2>
        <Badge
          variant={status === 'ready' ? 'secondary' : 'outline'}
          title={copy.hint}
        >
          {copy.label}
        </Badge>
      </div>

      <p className="text-sm font-medium capitalize">
        {playbookLabel(rec?.action_id ?? null)}
      </p>
      {parsed.summary ? (
        <p className="text-sm text-muted-foreground">{parsed.summary}</p>
      ) : (
        <p className="text-xs text-muted-foreground">{copy.hint}</p>
      )}

      {(parsed.missing_information.length > 0 ||
        parsed.supporting_evidence_ids.length > 0 ||
        parsed.error ||
        rec) && (
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer select-none hover:text-foreground">
            Suggestion detail
          </summary>
          <div className="mt-1.5 space-y-1.5">
            {rec ? (
              <p>Generated {formatUtc(rec.created_at_utc)}</p>
            ) : null}
            {parsed.suggested_owner ? (
              <p>Owner: {parsed.suggested_owner}</p>
            ) : null}
            {parsed.suggested_response_deadline ? (
              <p>
                Deadline: {formatUtc(parsed.suggested_response_deadline)}
              </p>
            ) : null}
            {parsed.error ? (
              <p className="font-mono">{parsed.error}</p>
            ) : null}
            {parsed.missing_information.length > 0 ? (
              <ul className="list-inside list-disc">
                {parsed.missing_information.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            ) : null}
            {parsed.supporting_evidence_ids.length > 0 ? (
              <p className="font-mono">
                Evidence: {parsed.supporting_evidence_ids.join(', ')}
              </p>
            ) : null}
          </div>
        </details>
      )}

      {blocked ? (
        <p className="rounded-sm border border-border bg-muted/40 px-2.5 py-1.5 text-xs text-muted-foreground">
          {blocked}
        </p>
      ) : null}

      {canDecide ? (
        <Button type="button" size="sm" className="w-full" onClick={onDecide}>
          Decide action
        </Button>
      ) : null}
    </section>
  )
}

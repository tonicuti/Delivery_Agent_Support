import type { CaseDetail } from '@/shared/types'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import {
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
    hint: 'Validated playbook suggestion — verify evidence before deciding.',
  },
  incomplete: {
    label: 'Incomplete',
    hint: 'Suggestion exists but is incomplete or invalid. Manual action is available.',
  },
  unavailable: {
    label: 'Unavailable',
    hint: 'No usable AI suggestion. Review evidence and choose an action manually.',
  },
}

export function CaseRecommendation({ detail, onDecide }: Props) {
  const status = recommendationUiStatus(detail)
  const copy = STATUS_COPY[status]
  const rec = detail.agent_recommendation
  const parsed = parseRecommendationOutput(detail)
  const canDecide = status === 'ready' || status === 'incomplete' || status === 'unavailable'

  return (
    <section
      className="space-y-3 rounded-sm border border-border bg-card px-3 py-3"
      aria-labelledby="case-ai-heading"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="case-ai-heading" className="text-sm font-semibold tracking-tight">
          AI recommendation
        </h2>
        <Badge
          variant={status === 'ready' ? 'secondary' : 'outline'}
          title={copy.hint}
        >
          {copy.label}
        </Badge>
      </div>

      <p className="text-xs text-muted-foreground">{copy.hint}</p>

      {parsed.summary ? (
        <div>
          <h3 className="text-xs font-medium text-muted-foreground">Assessment</h3>
          <p className="mt-0.5 text-sm">{parsed.summary}</p>
        </div>
      ) : null}

      {parsed.error ? (
        <p className="text-sm text-muted-foreground">
          Detail: <span className="font-mono text-xs">{parsed.error}</span>
        </p>
      ) : null}

      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs text-muted-foreground">Playbook action</dt>
          <dd className="capitalize">
            {playbookLabel(rec?.action_id ?? null)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Generated at</dt>
          <dd>{rec ? formatUtc(rec.created_at_utc) : '—'}</dd>
        </div>
        {parsed.suggested_owner ? (
          <div>
            <dt className="text-xs text-muted-foreground">Suggested owner</dt>
            <dd>{parsed.suggested_owner}</dd>
          </div>
        ) : null}
        {parsed.suggested_response_deadline ? (
          <div>
            <dt className="text-xs text-muted-foreground">Response deadline</dt>
            <dd>{formatUtc(parsed.suggested_response_deadline)}</dd>
          </div>
        ) : null}
      </dl>

      {parsed.supporting_evidence_ids.length > 0 ? (
        <div>
          <h3 className="text-xs font-medium text-muted-foreground">
            Supporting evidence
          </h3>
          <ul className="mt-1 flex flex-wrap gap-1">
            {parsed.supporting_evidence_ids.map((id) => (
              <li key={id}>
                <Badge variant="outline" className="font-mono font-normal">
                  {id}
                </Badge>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {parsed.missing_information.length > 0 ? (
        <div>
          <h3 className="text-xs font-medium text-muted-foreground">
            Missing data / preconditions
          </h3>
          <ul className="mt-1 list-inside list-disc text-sm text-muted-foreground">
            {parsed.missing_information.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {canDecide ? (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button type="button" size="sm" onClick={onDecide}>
            Decide action
          </Button>
          <span className="text-xs text-muted-foreground">
            Opens decision modal — saves to session planner_feedback only.
          </span>
        </div>
      ) : null}
    </section>
  )
}

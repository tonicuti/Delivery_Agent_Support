import type { CaseDetail } from '@/shared/types'
import { Button } from '@/shared/ui/button'
import {
  decisionBlockedReason,
  parseRecommendationOutput,
  playbookLabel,
  recommendationUiStatus,
} from './caseFormat'

type Props = {
  detail: CaseDetail
  onDecide?: () => void
}

export function CaseRecommendation({ detail, onDecide }: Props) {
  const status = recommendationUiStatus(detail)
  const rec = detail.agent_recommendation
  const parsed = parseRecommendationOutput(detail)
  const blocked = decisionBlockedReason(detail)
  const action = playbookLabel(rec?.action_id ?? null)
  const hasAction = Boolean(rec?.action_id)

  return (
    <section
      className="space-y-3 rounded-sm border border-border bg-card px-3 py-3"
      aria-labelledby="case-ai-heading"
    >
      <h2
        id="case-ai-heading"
        className="text-sm font-semibold tracking-tight"
      >
        What you can do
      </h2>

      {hasAction ? (
        <>
          <p className="text-sm font-medium">{action}</p>
          {parsed.summary ? (
            <p className="text-sm text-muted-foreground">{parsed.summary}</p>
          ) : null}
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          {status === 'checking'
            ? 'Still preparing a suggestion…'
            : 'No ready suggestion. Use the details on this page to decide.'}
        </p>
      )}

      {blocked ? (
        <p className="text-xs text-muted-foreground">{blocked}</p>
      ) : (
        <Button type="button" size="sm" className="w-full" onClick={onDecide}>
          Choose action
        </Button>
      )}
    </section>
  )
}

import { useState } from 'react'
import type { CaseDetail, PlaybookActionId, PlannerFeedback } from '@/shared/types'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { formatUtc } from '@/features/case-detail/caseFormat'
import {
  encodeDecisionNotes,
  executionBadgeLabel,
  parseDecisionNotes,
  type DecisionNotesPayload,
} from './decisionNotes'
import { DISMISS_GROUPS, playbookLabel } from './playbooks'

type Props = {
  detail: CaseDetail
  feedback: PlannerFeedback
  onUpdate: (input: {
    recommendation_id: string
    chosen_action_id: PlaybookActionId | null
    notes: string
    recorded_by: string
    recorded_at_utc: string
  }) => Promise<void>
  onDelete: (feedback_id: string) => Promise<void>
  onRecordAnother: () => void
}

export function DecisionRecord({
  detail,
  feedback,
  onUpdate,
  onDelete,
  onRecordAnother,
}: Props) {
  const parsed = parseDecisionNotes(feedback.notes)
  const [unableReason, setUnableReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showUnable, setShowUnable] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const erpHref = `#demo-erp-${detail.customer_order.external_order_id}`
  const tmsHref = `#demo-tms-${detail.shipment?.shipment_id ?? detail.customer_order.order_id}`

  const persist = async (next: DecisionNotesPayload) => {
    setBusy(true)
    setError(null)
    try {
      await onUpdate({
        recommendation_id: feedback.recommendation_id,
        chosen_action_id: feedback.chosen_action_id,
        notes: encodeDecisionNotes(next),
        recorded_by: feedback.recorded_by,
        recorded_at_utc: new Date().toISOString(),
      })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not update')
    } finally {
      setBusy(false)
    }
  }

  const onConfirmPerformed = () => {
    if (!parsed) return
    void persist({
      ...parsed,
      execution: {
        status: 'user_confirmed_performed',
        reason: null,
        recorded_at_utc: new Date().toISOString(),
      },
    })
  }

  const onUnable = async () => {
    if (!parsed) return
    if (!unableReason.trim()) {
      setError('Please say why it could not be done.')
      return
    }
    await persist({
      ...parsed,
      execution: {
        status: 'unable_to_perform',
        reason: unableReason.trim(),
        recorded_at_utc: new Date().toISOString(),
      },
    })
    setShowUnable(false)
    setUnableReason('')
  }

  const dismissLabel = parsed?.dismiss_group
    ? DISMISS_GROUPS.find((g) => g.id === parsed.dismiss_group)?.label
    : null

  return (
    <section
      className="space-y-3 rounded-sm border border-border bg-card px-3 py-3"
      aria-labelledby="decision-record-heading"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2
          id="decision-record-heading"
          className="text-sm font-semibold tracking-tight"
        >
          Decision recorded
        </h2>
        {parsed ? (
          <Badge variant="secondary" className="capitalize">
            {parsed.decision}
          </Badge>
        ) : null}
      </div>

      <p className="text-xs text-muted-foreground">
        This app only saved your choice. Your order, warehouse, and transport
        systems are unchanged.
      </p>

      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs text-muted-foreground">Chosen action</dt>
          <dd>{playbookLabel(feedback.chosen_action_id)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Recorded</dt>
          <dd>
            {formatUtc(feedback.recorded_at_utc)} · {feedback.recorded_by}
          </dd>
        </div>
        {parsed?.reason ? (
          <div className="sm:col-span-2">
            <dt className="text-xs text-muted-foreground">Reason</dt>
            <dd>{parsed.reason}</dd>
          </div>
        ) : null}
        {dismissLabel ? (
          <div className="sm:col-span-2">
            <dt className="text-xs text-muted-foreground">Why dismissed</dt>
            <dd>{dismissLabel}</dd>
          </div>
        ) : null}
        {parsed?.business_notes ? (
          <div className="sm:col-span-2">
            <dt className="text-xs text-muted-foreground">Notes</dt>
            <dd>{parsed.business_notes}</dd>
          </div>
        ) : null}
        {parsed?.follow_up_at_utc ? (
          <div>
            <dt className="text-xs text-muted-foreground">Follow-up</dt>
            <dd>{formatUtc(parsed.follow_up_at_utc)}</dd>
          </div>
        ) : null}
        <div>
          <dt className="text-xs text-muted-foreground">Follow-up</dt>
          <dd>
            <Badge variant="outline">
              {executionBadgeLabel(parsed?.execution.status ?? 'pending')}
            </Badge>
            <span className="ml-2 text-xs text-muted-foreground">
              (not checked by this app)
            </span>
          </dd>
        </div>
        {parsed?.execution.reason ? (
          <div className="sm:col-span-2">
            <dt className="text-xs text-muted-foreground">Follow-up note</dt>
            <dd>{parsed.execution.reason}</dd>
          </div>
        ) : null}
      </dl>

      <div className="space-y-2 border-t border-border pt-3">
        <p className="text-xs font-medium text-muted-foreground">
          Do the work in your own systems, then confirm here
        </p>
        <div className="flex flex-wrap gap-2">
          <a
            href={erpHref}
            className="inline-flex h-8 items-center rounded-sm border border-border bg-background px-2.5 text-xs text-muted-foreground hover:bg-muted"
          >
            Open order system
            <span className="ml-1 text-[10px]">Demo link</span>
          </a>
          <a
            href={tmsHref}
            className="inline-flex h-8 items-center rounded-sm border border-border bg-background px-2.5 text-xs text-muted-foreground hover:bg-muted"
          >
            Open transport system
            <span className="ml-1 text-[10px]">Demo link</span>
          </a>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            disabled={busy || parsed?.execution.status === 'user_confirmed_performed'}
            onClick={onConfirmPerformed}
          >
            Confirm it was done
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => setShowUnable((v) => !v)}
          >
            Could not do it
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={onRecordAnother}
          >
            Record another decision
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="text-destructive hover:bg-destructive/10"
            disabled={busy}
            onClick={() => setConfirmDelete(true)}
          >
            Withdraw decision
          </Button>
        </div>
        {confirmDelete ? (
          <div className="rounded-sm border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm">
            <p>
              Withdraw this decision? If there is no earlier decision, the order
              returns to Orders needing attention.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="destructive"
                disabled={busy}
                onClick={() => {
                  void (async () => {
                    setBusy(true)
                    setError(null)
                    try {
                      await onDelete(feedback.feedback_id)
                      setConfirmDelete(false)
                    } catch (e: unknown) {
                      setError(
                        e instanceof Error ? e.message : 'Could not withdraw',
                      )
                    } finally {
                      setBusy(false)
                    }
                  })()
                }}
              >
                Yes, withdraw
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => setConfirmDelete(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : null}
        {showUnable ? (
          <div className="space-y-2">
            <label className="block space-y-1 text-sm">
              <span className="text-xs text-muted-foreground">
                Why it could not be done (required)
              </span>
              <textarea
                className="min-h-[3rem] w-full rounded-sm border border-border bg-background px-2 py-1.5 text-sm"
                value={unableReason}
                disabled={busy}
                onChange={(e) => setUnableReason(e.target.value)}
              />
            </label>
            <Button
              type="button"
              size="sm"
              disabled={busy}
              onClick={() => void onUnable()}
            >
              Save
            </Button>
          </div>
        ) : null}
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  )
}

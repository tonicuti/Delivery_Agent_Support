import { useEffect, useId, useRef, useState } from 'react'
import type { CaseDetail, PlaybookActionId } from '@/shared/types'
import { Button } from '@/shared/ui/button'
import { RiskBadge } from '@/shared/ui/risk-badge'
import {
  formatPromiseWindow,
  formatUtc,
  playbookLabel as casePlaybookLabel,
} from '@/features/case-detail/caseFormat'
import {
  encodeDecisionNotes,
  type DecisionKind,
  type DecisionNotesPayload,
} from './decisionNotes'
import {
  DISMISS_GROUPS,
  PLAYBOOK_ACTIONS,
  type DismissGroupId,
} from './playbooks'

type Props = {
  detail: CaseDetail
  open: boolean
  onClose: () => void
  onReload?: () => Promise<void>
  onSubmit: (input: {
    recommendation_id: string
    chosen_action_id: PlaybookActionId | null
    notes: string
    recorded_by: string
    recorded_at_utc: string
    expected_feedback_id: string | null
  }) => Promise<void>
}

export function DecisionModal({
  detail,
  open,
  onClose,
  onReload,
  onSubmit,
}: Props) {
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const firstFieldRef = useRef<HTMLButtonElement>(null)
  const rec = detail.agent_recommendation

  const [kind, setKind] = useState<DecisionKind>('edit')
  const [chosenAction, setChosenAction] = useState<PlaybookActionId | ''>(
    rec?.action_id ?? '',
  )
  const [reason, setReason] = useState('')
  const [dismissGroup, setDismissGroup] = useState<DismissGroupId | ''>('')
  const [businessNotes, setBusinessNotes] = useState('')
  const [followUp, setFollowUp] = useState('')
  const [actingRole, setActingRole] = useState('dispatcher@demo')
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    setKind(rec?.action_id ? 'approve' : 'edit')
    setChosenAction(rec?.action_id ?? '')
    setReason('')
    setDismissGroup('')
    setBusinessNotes('')
    setFollowUp('')
    setActingRole('dispatcher@demo')
    setFieldError(null)
    setSubmitError(null)
    const t = window.setTimeout(() => firstFieldRef.current?.focus(), 0)
    return () => window.clearTimeout(t)
  }, [open, rec?.action_id])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose, submitting])

  if (!open) return null

  if (!rec) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="w-full max-w-lg rounded-sm border border-border bg-card p-4 shadow-lg"
        >
          <h2 id={titleId} className="text-base font-semibold">
            Cannot record decision
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            This order has no suggestion yet, so a decision cannot be saved.
          </p>
          <Button type="button" className="mt-4" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    )
  }

  const validate = (): string | null => {
    if (!actingRole.trim()) return 'Your role is required.'
    if (kind === 'approve') {
      if (!rec.action_id) {
        return 'Approve needs a ready suggestion. Use Edit or Dismiss instead.'
      }
    }
    if (kind === 'edit') {
      if (!chosenAction) return 'Choose an action.'
      if (!reason.trim()) return 'Please add a reason when changing the suggestion.'
    }
    if (kind === 'dismiss') {
      if (!dismissGroup) return 'Select why you are dismissing this.'
      if (!reason.trim()) return 'Please add a reason when dismissing.'
    }
    return null
  }

  const handleSubmit = async () => {
    const err = validate()
    if (err) {
      setFieldError(err)
      return
    }
    setFieldError(null)
    setSubmitError(null)

    let chosen: PlaybookActionId | null = null
    if (kind === 'approve') chosen = rec.action_id
    else if (kind === 'edit') chosen = chosenAction as PlaybookActionId
    else chosen = null

    const payload: DecisionNotesPayload = {
      v: 1,
      decision: kind,
      reason: reason.trim() || null,
      dismiss_group: kind === 'dismiss' ? (dismissGroup as DismissGroupId) : null,
      business_notes: businessNotes.trim() || null,
      follow_up_at_utc: followUp.trim()
        ? new Date(followUp).toISOString()
        : null,
      acting_role: actingRole.trim(),
      recommended_action_id: rec.action_id,
      execution: {
        status: 'pending',
        reason: null,
        recorded_at_utc: null,
      },
    }

    setSubmitting(true)
    try {
      await onSubmit({
        recommendation_id: rec.recommendation_id,
        chosen_action_id: chosen,
        notes: encodeDecisionNotes(payload),
        recorded_by: actingRole.trim(),
        recorded_at_utc: new Date().toISOString(),
        expected_feedback_id: detail.planner_feedback?.feedback_id ?? null,
      })
    } catch (e: unknown) {
      setSubmitError(
        e instanceof Error
          ? e.message
          : 'Could not save your decision',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose()
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-sm border border-border bg-card p-4 shadow-lg"
      >
        <h2 id={titleId} className="text-base font-semibold tracking-tight">
          Record decision
        </h2>

        <div
          className="mt-3 rounded-sm border border-risk-medium/40 bg-risk-medium/10 px-3 py-2 text-sm text-foreground"
          role="note"
        >
          This only saves your choice. Your order and transport systems are not changed.
        </div>

        <dl className="mt-3 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
          <div>
            <dt className="inline">Order </dt>
            <dd className="inline text-foreground">
              {detail.customer_order.external_order_id}
            </dd>
          </div>
          <div className="flex items-center gap-1">
            <dt>Chance of delay</dt>
            <dd>
              <RiskBadge risk={detail.risk_band} />
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="inline">Promised delivery </dt>
            <dd className="inline text-foreground">
              {formatPromiseWindow(detail)}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="inline">Last updated </dt>
            <dd className="inline text-foreground">
              {formatUtc(detail.order_snapshot.as_of_utc)} · last check{' '}
              {formatUtc(detail.risk_score.scored_at_utc)}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="inline">Current suggestion </dt>
            <dd className="inline text-foreground">
              {casePlaybookLabel(rec.action_id)}
            </dd>
          </div>
        </dl>

        <fieldset className="mt-4 space-y-2">
          <legend className="text-xs font-medium text-muted-foreground">
            Decision type
          </legend>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ['approve', 'Approve', Boolean(rec.action_id)],
                ['edit', 'Edit', true],
                ['dismiss', 'Dismiss', true],
              ] as const
            ).map(([value, label, enabled], i) => (
              <button
                key={value}
                ref={i === 0 ? firstFieldRef : undefined}
                type="button"
                disabled={!enabled || submitting}
                className={[
                  'h-8 rounded-sm border px-2.5 text-xs font-medium',
                  kind === value
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-card hover:bg-muted',
                  !enabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer',
                ].join(' ')}
                onClick={() => setKind(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </fieldset>

        {kind === 'edit' ? (
          <label className="mt-3 block space-y-1 text-sm">
            <span className="text-xs font-medium text-muted-foreground">
              Chosen action
            </span>
            <select
              className="h-9 w-full cursor-pointer rounded-sm border border-border bg-background px-2 text-sm"
              value={chosenAction}
              disabled={submitting}
              onChange={(e) =>
                setChosenAction(e.target.value as PlaybookActionId | '')
              }
            >
              <option value="">Select action…</option>
              {PLAYBOOK_ACTIONS.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {kind === 'dismiss' ? (
          <label className="mt-3 block space-y-1 text-sm">
            <span className="text-xs font-medium text-muted-foreground">
              Why dismiss?
            </span>
            <select
              className="h-9 w-full cursor-pointer rounded-sm border border-border bg-background px-2 text-sm"
              value={dismissGroup}
              disabled={submitting}
              onChange={(e) =>
                setDismissGroup(e.target.value as DismissGroupId | '')
              }
            >
              <option value="">Select…</option>
              {DISMISS_GROUPS.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {kind === 'edit' || kind === 'dismiss' ? (
          <label className="mt-3 block space-y-1 text-sm">
            <span className="text-xs font-medium text-muted-foreground">
              Reason (required)
            </span>
            <textarea
              className="min-h-[4.5rem] w-full rounded-sm border border-border bg-background px-2 py-1.5 text-sm"
              value={reason}
              disabled={submitting}
              onChange={(e) => setReason(e.target.value)}
              onBlur={() => {
                if (!reason.trim()) {
                  setFieldError('Please add a reason for Edit or Dismiss.')
                }
              }}
            />
          </label>
        ) : null}

        <label className="mt-3 block space-y-1 text-sm">
          <span className="text-xs font-medium text-muted-foreground">
            Notes
          </span>
          <textarea
            className="min-h-[3.5rem] w-full rounded-sm border border-border bg-background px-2 py-1.5 text-sm"
            value={businessNotes}
            disabled={submitting}
            onChange={(e) => setBusinessNotes(e.target.value)}
          />
        </label>

        <label className="mt-3 block space-y-1 text-sm">
          <span className="text-xs font-medium text-muted-foreground">
            Follow-up (optional)
          </span>
          <input
            type="datetime-local"
            className="h-9 w-full rounded-sm border border-border bg-background px-2 text-sm"
            value={followUp}
            disabled={submitting}
            onChange={(e) => setFollowUp(e.target.value)}
          />
        </label>
        <p className="mt-1 text-[10px] text-muted-foreground">
          Recorded as {actingRole} (demo)
        </p>

        {fieldError ? (
          <p className="mt-3 text-sm text-destructive" role="alert">
            {fieldError}
          </p>
        ) : null}
        {submitError ? (
          <div className="mt-3 space-y-2" role="alert">
            <p className="text-sm text-destructive">{submitError}</p>
            {onReload ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={submitting}
                onClick={() => void onReload()}
              >
                Reload order
              </Button>
            ) : null}
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={submitting}
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={submitting}
            onClick={() => void handleSubmit()}
          >
            {submitting ? 'Saving…' : 'Save decision'}
          </Button>
        </div>
      </div>
    </div>
  )
}

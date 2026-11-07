import type { PlaybookActionId } from '@/shared/types'
import type { DismissGroupId } from './playbooks'

export type DecisionKind = 'approve' | 'edit' | 'dismiss'

export type ExecutionStatus =
  | 'pending'
  | 'user_confirmed_performed'
  | 'unable_to_perform'

export type DecisionNotesPayload = {
  v: 1
  decision: DecisionKind
  reason: string | null
  dismiss_group: DismissGroupId | null
  business_notes: string | null
  follow_up_at_utc: string | null
  acting_role: string
  recommended_action_id: PlaybookActionId | null
  execution: {
    status: ExecutionStatus
    reason: string | null
    recorded_at_utc: string | null
  }
}

const MARKER = 'DRA_DECISION_V1:'

export function encodeDecisionNotes(payload: DecisionNotesPayload): string {
  return MARKER + JSON.stringify(payload)
}

export function parseDecisionNotes(
  notes: string | null | undefined,
): DecisionNotesPayload | null {
  if (!notes) return null
  if (!notes.startsWith(MARKER)) {
    return {
      v: 1,
      decision: 'edit',
      reason: null,
      dismiss_group: null,
      business_notes: notes,
      follow_up_at_utc: null,
      acting_role: 'unknown',
      recommended_action_id: null,
      execution: {
        status: 'pending',
        reason: null,
        recorded_at_utc: null,
      },
    }
  }
  try {
    const raw = JSON.parse(notes.slice(MARKER.length)) as DecisionNotesPayload
    if (raw?.v !== 1 || !raw.decision) return null
    return raw
  } catch {
    return null
  }
}

export function executionBadgeLabel(status: ExecutionStatus): string {
  switch (status) {
    case 'user_confirmed_performed':
      return 'User-confirmed'
    case 'unable_to_perform':
      return 'Unable to perform'
    default:
      return 'Execution pending'
  }
}

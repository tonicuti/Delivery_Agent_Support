import type { PlaybookActionId } from '@/shared/types'

/** Matches backend agent/playbooks.py PLAYBOOKS — UI allow-list only. */
export const PLAYBOOK_ACTIONS: {
  id: PlaybookActionId
  label: string
  description: string
}[] = [
  {
    id: 'check_stock',
    label: 'Check stock',
    description: 'Ask the warehouse to verify stock availability.',
  },
  {
    id: 'prioritize_picking',
    label: 'Prioritize picking',
    description: 'Ask the warehouse to prioritize picking or packing.',
  },
  {
    id: 'confirm_route',
    label: 'Confirm route',
    description: 'Ask transport to confirm the route and ETA.',
  },
  {
    id: 'review_conflicting_evidence',
    label: 'Review conflicting evidence',
    description: 'Ask the planner to review missing or conflicting evidence.',
  },
]

export const DISMISS_GROUPS = [
  { id: 'wrong_stale_data', label: 'Wrong / stale data' },
  { id: 'not_applicable', label: 'Alert not applicable' },
  { id: 'already_handled', label: 'Already handled in another system' },
  { id: 'no_feasible', label: 'No feasible action' },
  { id: 'other', label: 'Other' },
] as const

export type DismissGroupId = (typeof DISMISS_GROUPS)[number]['id']

export function playbookDescription(id: PlaybookActionId | null): string {
  if (!id) return 'No suggestion'
  return PLAYBOOK_ACTIONS.find((a) => a.id === id)?.description ?? id
}

export function playbookLabel(id: PlaybookActionId | null): string {
  if (!id) return 'None (dismiss)'
  return PLAYBOOK_ACTIONS.find((a) => a.id === id)?.label ?? id
}

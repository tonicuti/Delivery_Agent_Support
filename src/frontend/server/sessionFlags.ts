import type { CaseDetail, WorklistResponse, WorklistRow } from '../src/shared/types'

/** Demo-only resilience flags (F8) — stored beside session DB, not schema. */
export type SessionFlags = {
  agent_enabled: boolean
  /** Mask recommendations as validation_status=unavailable. */
  force_ai_unavailable: boolean
  /** Shift scored_at_utc into the past so Stale chips/banners fire. */
  force_stale_scores: boolean
  /**
   * Next planner_feedback save returns 409 conflict once, then clears.
   * Simulates another reviewer saving first.
   */
  simulate_conflict_on_save: boolean
  /** Force Risk increased badge on worklist rows (demo). */
  simulate_risk_increase: boolean
}

export const DEFAULT_SESSION_FLAGS: SessionFlags = {
  agent_enabled: true,
  force_ai_unavailable: false,
  force_stale_scores: false,
  simulate_conflict_on_save: false,
  simulate_risk_increase: false,
}

export function normalizeSessionFlags(
  raw: Partial<SessionFlags> | null | undefined,
): SessionFlags {
  return {
    agent_enabled: raw?.agent_enabled !== false,
    force_ai_unavailable: Boolean(raw?.force_ai_unavailable),
    force_stale_scores: Boolean(raw?.force_stale_scores),
    simulate_conflict_on_save: Boolean(raw?.simulate_conflict_on_save),
    simulate_risk_increase: Boolean(raw?.simulate_risk_increase),
  }
}

function staleTimestamp(hoursAgo = 3): string {
  return new Date(Date.now() - hoursAgo * 60 * 60_000).toISOString()
}

function maskRecommendation(
  rec: CaseDetail['agent_recommendation'] | WorklistRow['agent_recommendation'],
  flags: SessionFlags,
): CaseDetail['agent_recommendation'] {
  if (!rec) return null
  if (!flags.agent_enabled || flags.force_ai_unavailable) {
    return {
      ...rec,
      validation_status: 'unavailable',
      action_id: null,
    }
  }
  return rec
}

export function applyFlagsToCase(
  detail: CaseDetail,
  flags: SessionFlags,
): CaseDetail {
  const risk_score = flags.force_stale_scores
    ? { ...detail.risk_score, scored_at_utc: staleTimestamp() }
    : detail.risk_score

  return {
    ...detail,
    risk_score,
    agent_recommendation: maskRecommendation(detail.agent_recommendation, flags),
    risk_increased:
      detail.risk_increased || flags.simulate_risk_increase,
  }
}

export function applyFlagsToWorklist(
  res: WorklistResponse,
  flags: SessionFlags,
): WorklistResponse {
  const items = res.items.map((row) => {
    const risk_score = flags.force_stale_scores
      ? { ...row.risk_score, scored_at_utc: staleTimestamp() }
      : row.risk_score
    return {
      ...row,
      risk_score,
      agent_recommendation: maskRecommendation(row.agent_recommendation, flags),
      risk_increased: row.risk_increased || flags.simulate_risk_increase,
    }
  })

  let stale_score_count = res.summary.stale_score_count
  if (flags.force_stale_scores) {
    stale_score_count = items.filter((r) => r.worklist_item.status === 'active')
      .length
  }

  return {
    ...res,
    items,
    summary: { ...res.summary, stale_score_count },
  }
}

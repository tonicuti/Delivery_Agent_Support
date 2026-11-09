import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '@/api'
import type { CaseDetail, PlaybookActionId } from '@/shared/types'
import {
  CaseHeader,
  CaseOrderLines,
  CaseReasons,
  CaseRecommendation,
  CaseRiskHistory,
  CaseTransport,
  CaseWarehouseTimeline,
  buildCaseReasons,
  buildRiskHistory,
} from '@/features/case-detail'
import { DecisionModal, DecisionRecord } from '@/features/decision'
import { CustomerMessageDraft } from '@/features/customer-draft'
import { CaseDataHealthBanners } from '@/features/data-health'
import { decisionBlockedReason } from '@/features/case-detail/caseFormat'

const WORKLIST_SEARCH_KEY = 'worklist-search'

type FeedbackInput = {
  recommendation_id: string
  chosen_action_id: PlaybookActionId | null
  notes: string
  recorded_by: string
  recorded_at_utc: string
  expected_feedback_id?: string | null
}

export function CaseDetailPage() {
  const { orderId } = useParams()
  const id = Number(orderId)

  const [detail, setDetail] = useState<CaseDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const backTo = useMemo(() => {
    const saved =
      typeof sessionStorage !== 'undefined'
        ? sessionStorage.getItem(WORKLIST_SEARCH_KEY)
        : null
    return saved ? `/dashboard?${saved}` : '/dashboard'
  }, [])

  const load = useCallback(async () => {
    if (!Number.isFinite(id)) {
      setError('Invalid order number')
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await api.getCase(id)
      setDetail(res)
    } catch (err: unknown) {
      setDetail(null)
      setError(err instanceof Error ? err.message : 'Could not load this order')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 8_000)
    return () => window.clearTimeout(t)
  }, [toast])

  const saveFeedback = async (input: FeedbackInput) => {
    await api.savePlannerFeedback(input)
    await load()
  }

  const deleteFeedback = async (feedback_id: string) => {
    const result = await api.deletePlannerFeedback(feedback_id)
    await load()
    setToast(
      result.worklist_reopened
        ? 'Decision withdrawn. Order is open again on Orders needing attention.'
        : 'Decision withdrawn.',
    )
  }

  const onDecide = () => {
    if (detail && decisionBlockedReason(detail)) {
      setToast(decisionBlockedReason(detail))
      return
    }
    setModalOpen(true)
  }

  const onDecisionSaved = async (input: FeedbackInput) => {
    await saveFeedback(input)
    setModalOpen(false)
    setToast('Your choice was saved.')
  }

  const reasons = useMemo(
    () => (detail ? buildCaseReasons(detail) : []),
    [detail],
  )
  const history = useMemo(
    () => (detail ? buildRiskHistory(detail) : []),
    [detail],
  )

  return (
    <section className="space-y-4 pb-8">
      {loading && !detail ? (
        <div className="space-y-2" aria-busy="true" aria-label="Loading order">
          <div className="h-10 animate-pulse rounded-sm bg-muted" />
          <div className="h-40 animate-pulse rounded-sm bg-muted" />
        </div>
      ) : null}

      {error ? (
        <div className="space-y-2">
          <Link
            to={backTo}
            className="inline-flex h-8 cursor-pointer items-center rounded-sm border border-border bg-card px-3 text-sm hover:bg-muted"
          >
            ← Back to orders
          </Link>
          <p className="rounded-sm border border-destructive/30 bg-destructive/5 px-3 py-2 text-destructive">
            {error}
          </p>
        </div>
      ) : null}

      {detail ? (
        <>
          <CaseHeader detail={detail} backTo={backTo} onDecide={onDecide} />

          <CaseDataHealthBanners detail={detail} />

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
            <div className="min-w-0 space-y-4">
              <CaseReasons reasons={reasons} />
              <CaseOrderLines detail={detail} />
              <CaseWarehouseTimeline detail={detail} />
              <CaseTransport detail={detail} />

              <details className="rounded-sm border border-border bg-card px-3 py-2">
                <summary className="cursor-pointer select-none text-sm font-medium text-muted-foreground hover:text-foreground">
                  More options
                </summary>
                <div className="mt-3 space-y-4">
                  <CustomerMessageDraft
                    detail={detail}
                    onToast={(message) => setToast(message)}
                  />
                  <CaseRiskHistory events={history} />
                  <p className="text-xs text-muted-foreground">
                    <Link
                      to={`/chat?order=${detail.customer_order.order_id}&ref=${encodeURIComponent(detail.customer_order.external_order_id)}`}
                      className="text-primary underline-offset-2 hover:underline"
                    >
                      Ask about this order
                    </Link>
                  </p>
                </div>
              </details>
            </div>

            <aside className="min-w-0 space-y-3 xl:sticky xl:top-4 xl:self-start">
              <CaseRecommendation detail={detail} onDecide={onDecide} />
              {detail.planner_feedback ? (
                <DecisionRecord
                  detail={detail}
                  feedback={detail.planner_feedback}
                  onUpdate={saveFeedback}
                  onDelete={deleteFeedback}
                  onRecordAnother={() => setModalOpen(true)}
                />
              ) : null}
            </aside>
          </div>

          <DecisionModal
            detail={detail}
            open={modalOpen}
            onClose={() => setModalOpen(false)}
            onReload={async () => {
              await load()
              setToast('Page refreshed.')
            }}
            onSubmit={onDecisionSaved}
          />
        </>
      ) : null}

      {toast ? (
        <div
          className="fixed bottom-4 left-1/2 z-50 max-w-lg -translate-x-1/2 rounded-sm border border-border bg-card px-3 py-2 text-sm shadow-md"
          role="status"
        >
          {toast}
          <button
            type="button"
            className="ml-3 cursor-pointer text-xs text-muted-foreground underline-offset-2 hover:underline"
            onClick={() => setToast(null)}
          >
            Dismiss
          </button>
        </div>
      ) : null}
    </section>
  )
}

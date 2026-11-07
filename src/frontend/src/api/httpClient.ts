import type {
  AcknowledgeNotificationInput,
  CaseDetail,
  DataHealthSnapshot,
  DeliveryRiskApi,
  HistoryQuery,
  HistoryRow,
  DeletePlannerFeedbackResult,
  SavePlannerFeedbackInput,
  PlannerFeedback,
  SimulatedNotification,
  UnacknowledgeNotificationInput,
  WorklistQuery,
  WorklistResponse,
} from '@/shared/types'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })
  const body = (await res.json()) as T & { error?: string }
  if (!res.ok) {
    throw new Error(body.error ?? `${res.status} ${res.statusText}`)
  }
  return body
}

function toQuery(params: WorklistQuery): string {
  const q = new URLSearchParams()
  if (params.warehouse_id != null) q.set('warehouse_id', String(params.warehouse_id))
  if (params.status) q.set('status', params.status)
  if (params.order_id != null) q.set('order_id', String(params.order_id))
  if (params.external_order_id) q.set('external_order_id', params.external_order_id)
  if (params.include_low_risk) q.set('include_low_risk', '1')
  if (params.risk_band?.length) q.set('risk_band', params.risk_band.join(','))
  const s = q.toString()
  return s ? `?${s}` : ''
}

/** Browser client → Vite /api middleware → team SQLite. */
export const httpClient: DeliveryRiskApi = {
  getWorklist(params) {
    return request<WorklistResponse>(`/api/worklist${toQuery(params)}`)
  },
  getCase(order_id) {
    return request<CaseDetail>(`/api/cases/${order_id}`)
  },
  savePlannerFeedback(input: SavePlannerFeedbackInput) {
    return request<PlannerFeedback>('/api/planner-feedback', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },
  deletePlannerFeedback(feedback_id: string) {
    return request<DeletePlannerFeedbackResult>(
      `/api/planner-feedback/${encodeURIComponent(feedback_id)}`,
      { method: 'DELETE' },
    )
  },
  acknowledgeNotification(input: AcknowledgeNotificationInput) {
    return request<SimulatedNotification>('/api/notifications/ack', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },
  unacknowledgeNotification(input: UnacknowledgeNotificationInput) {
    return request<SimulatedNotification>('/api/notifications/unack', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },
  getHistory(_params: HistoryQuery) {
    return request<HistoryRow[]>('/api/history')
  },
  getDataHealth() {
    return request<DataHealthSnapshot>('/api/data-health')
  },
}

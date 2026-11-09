/**
 * Read/write shapes for the UI API layer.
 * Joins only schema tables — no invented workflow columns.
 * When REST exists, responses should match these joins.
 */

import type {
  AgentRecommendation,
  Carrier,
  Customer,
  CustomerOrder,
  DeliverySite,
  EtaUpdate,
  OriginalDeliveryOutcome,
  OrderLine,
  OrderSnapshot,
  PlannerFeedback,
  PlaybookActionId,
  Product,
  PromiseVersion,
  RiskBand,
  RiskEpisode,
  RiskScore,
  Shipment,
  ShipmentStop,
  SimulatedNotification,
  StockEvent,
  Warehouse,
  WarehouseEvent,
  WorklistItem,
  WorklistItemStatus,
} from './schema'

export type OrderLineView = OrderLine & {
  product: Product
  latest_stock_event: StockEvent | null
}

export type ShipmentView = Shipment & {
  warehouse: Warehouse
  carrier: Carrier | null
  stop: ShipmentStop | null
  warehouse_events: WarehouseEvent[]
  latest_eta_update: EtaUpdate | null
}

/** Worklist row = worklist_item + joined score/order/promise fields that exist in schema. */
export type WorklistRow = {
  worklist_item: WorklistItem
  risk_episode: RiskEpisode
  risk_score: RiskScore
  /** Derived like backend predictor.risk_band(p_late). */
  risk_band: RiskBand
  /**
   * F8: latest score meaningfully worse than episode opening score.
   * UI-derived (not a DB column). May also be forced by demo flags.
   */
  risk_increased: boolean
  customer_order: CustomerOrder
  customer: Customer
  promise_version: PromiseVersion | null
  order_snapshot: OrderSnapshot
  agent_recommendation: AgentRecommendation | null
  simulated_notification: SimulatedNotification | null
}

export type WorklistQuery = {
  warehouse_id?: number
  status?: WorklistItemStatus
  risk_band?: RiskBand[]
  order_id?: number
  external_order_id?: string
  /** When false (default), omit Low band — UI filter only, not a DB column. */
  include_low_risk?: boolean
}

export type WorklistResponse = {
  items: WorklistRow[]
  summary: {
    active_count: number
    unacknowledged_count: number
    stale_score_count: number
  }
  scope: {
    warehouse_id: number | null
  }
  generated_at_utc: string
}

export type CaseDetail = {
  customer_order: CustomerOrder
  customer: Customer
  delivery_site: DeliverySite
  promise_version: PromiseVersion | null
  order_lines: OrderLineView[]
  shipment: ShipmentView | null
  order_snapshot: OrderSnapshot
  risk_score: RiskScore
  risk_band: RiskBand
  /** F8: latest vs opening score (UI-derived). */
  risk_increased: boolean
  risk_episode: RiskEpisode
  worklist_item: WorklistItem
  agent_recommendation: AgentRecommendation | null
  simulated_notification: SimulatedNotification | null
  planner_feedback: PlannerFeedback | null
  original_delivery_outcome: OriginalDeliveryOutcome | null
}

/** Demo resilience flags (F8) — session_flags.json, not schema. */
export type SessionFlags = {
  agent_enabled: boolean
  force_ai_unavailable: boolean
  force_stale_scores: boolean
  simulate_conflict_on_save: boolean
  simulate_risk_increase: boolean
}

export type HistoryRow = {
  risk_episode: RiskEpisode
  customer_order: CustomerOrder
  risk_score: RiskScore
  risk_band: RiskBand
  agent_recommendation: AgentRecommendation | null
  planner_feedback: PlannerFeedback | null
  original_delivery_outcome: OriginalDeliveryOutcome | null
  order_snapshot: OrderSnapshot
}

export type HistoryQuery = {
  warehouse_id?: number
  order_id?: number
  external_order_id?: string
  label_status?: 'known' | 'unknown'
  original_late?: 0 | 1
}

export type DataHealthSnapshot = {
  /** Closest ERP/order feature clock: MAX(order_snapshot.as_of_utc). */
  order_snapshot_latest_utc: string | null
  /** Inventory-ish: MAX(stock_event.recorded_at_utc). */
  stock_event_latest_utc: string | null
  /** WMS: MAX(warehouse_event.recorded_at_utc). */
  warehouse_event_latest_utc: string | null
  /** TMS: MAX(eta_update.recorded_at_utc). */
  eta_update_latest_utc: string | null
  weather_latest_utc: string | null
  holiday_latest_utc: string | null
  travel_latest_utc: string | null
  risk_score_latest_utc: string | null
  agent_recommendation_latest_utc: string | null
  model_version: string | null
  /** Session demo flag only — not a DB column. */
  agent_enabled: boolean
  stale_after_minutes: number
  stale_score_count: number
  missing_promise_count: number
  /** agent_run.status = 'failed' in session. */
  agent_run_failed_count: number
  /** agent_recommendation.validation_status = 'unavailable'. */
  recommendation_unavailable_count: number
  /** agent_recommendation.validation_status = 'invalid'. */
  recommendation_invalid_count: number
  generated_at_utc: string
}

export type SavePlannerFeedbackInput = {
  recommendation_id: string
  chosen_action_id: PlaybookActionId | null
  notes: string | null
  recorded_by: string
  recorded_at_utc: string
  /**
   * F8 concurrent review: feedback_id known when the modal opened.
   * null = expect no feedback yet. Mismatch → 409, no overwrite.
   */
  expected_feedback_id?: string | null
}

export type AcknowledgeNotificationInput = {
  notification_id: string
  acknowledged_at_utc: string
}

export type UnacknowledgeNotificationInput = {
  notification_id: string
}

export type DeletePlannerFeedbackResult = {
  deleted: true
  order_id: number | null
  worklist_reopened: boolean
}

export interface DeliveryRiskApi {
  getWorklist(params: WorklistQuery): Promise<WorklistResponse>
  getCase(order_id: number): Promise<CaseDetail>
  savePlannerFeedback(input: SavePlannerFeedbackInput): Promise<PlannerFeedback>
  deletePlannerFeedback(feedback_id: string): Promise<DeletePlannerFeedbackResult>
  acknowledgeNotification(input: AcknowledgeNotificationInput): Promise<SimulatedNotification>
  unacknowledgeNotification(
    input: UnacknowledgeNotificationInput,
  ): Promise<SimulatedNotification>
  getHistory(params: HistoryQuery): Promise<HistoryRow[]>
  getDataHealth(): Promise<DataHealthSnapshot>
  setAgentEnabled(agent_enabled: boolean): Promise<DataHealthSnapshot>
  getSessionFlags(): Promise<SessionFlags>
  setSessionFlags(patch: Partial<SessionFlags>): Promise<SessionFlags>
}

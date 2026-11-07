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
  risk_episode: RiskEpisode
  worklist_item: WorklistItem
  agent_recommendation: AgentRecommendation | null
  simulated_notification: SimulatedNotification | null
  planner_feedback: PlannerFeedback | null
  original_delivery_outcome: OriginalDeliveryOutcome | null
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
  /** Latest recorded_at_utc seen in warehouse_event seed (demo). */
  warehouse_event_latest_utc: string | null
  eta_update_latest_utc: string | null
  risk_score_latest_utc: string | null
  agent_recommendation_latest_utc: string | null
  model_version: string | null
  /** From agent process — not a DB column; demo flag only until ops table exists. */
  agent_enabled: boolean
  stale_after_minutes: number
}

export type SavePlannerFeedbackInput = {
  recommendation_id: string
  chosen_action_id: PlaybookActionId | null
  notes: string | null
  recorded_by: string
  recorded_at_utc: string
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
}

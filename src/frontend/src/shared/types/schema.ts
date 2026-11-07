/**
 * Types mirrored from schema_fresh.sql + migrations/0001_agent.sql.
 * Column names stay snake_case for 1:1 mapping to SQLite / future REST.
 * Do not invent columns here — extend only when schema migrations add them.
 */

export type CustomerType = 'B2B' | 'B2C'
export type StockStatus = 'in_stock' | 'short' | 'backorder'
export type ShipmentType = 'original' | 'replacement'
export type ShipmentStatus =
  | 'planned'
  | 'packing'
  | 'loaded'
  | 'departed'
  | 'delivered'
  | 'cancelled'
export type WarehouseStage =
  | 'waiting'
  | 'pick_started'
  | 'packed'
  | 'loaded'
  | 'departed'
export type WorklistItemStatus = 'active' | 'closed'
export type AgentRunStatus = 'running' | 'completed' | 'ineligible' | 'failed'
export type RecommendationValidationStatus = 'valid' | 'invalid' | 'unavailable'
export type NotificationKind = 'initial' | 'follow_up'
export type OutcomeLabelStatus = 'known' | 'unknown'
export type LifecycleEventType = 'created' | 'cancelled' | 'delivered'
export type ExternalEvidenceKind = 'weather' | 'holiday'
export type ExternalEvidenceValidation = 'valid' | 'invalid' | 'failed'

/** Matches backend predictor.risk_band — not a DB column. */
export type RiskBand = 'Low' | 'Medium' | 'High'

/** Matches src/backend/agent/playbooks.py PLAYBOOKS keys. */
export type PlaybookActionId =
  | 'check_stock'
  | 'prioritize_picking'
  | 'confirm_route'
  | 'review_conflicting_evidence'

export const RISK_LOW_MAX = 0.2
export const RISK_MEDIUM_MAX = 0.5
export const DATA_STALE_MINUTES = 90

export function risk_band(p_late: number): RiskBand {
  if (p_late < RISK_LOW_MAX) return 'Low'
  if (p_late <= RISK_MEDIUM_MAX) return 'Medium'
  return 'High'
}

/* —— schema_fresh.sql —— */

export type Customer = {
  customer_id: number
  source_system: string
  external_customer_id: string
  customer_type: CustomerType
}

export type DeliverySite = {
  site_id: number
  region_id: number
  postcode: string
  latitude: number | null
  longitude: number | null
  time_zone: string
  country_code: string | null
}

export type Product = {
  product_id: number
  category_id: number
  source_system: string
  external_product_id: string
  name: string
  unit: string
  unit_weight_kg: number | null
  unit_volume_m3: number | null
  special_handling: 0 | 1
}

export type Warehouse = {
  warehouse_id: number
  name: string
  latitude: number | null
  longitude: number | null
}

export type Carrier = {
  carrier_id: number
  name: string
  own_fleet: 0 | 1
}

export type CustomerOrder = {
  order_id: number
  source_system: string
  external_order_id: string
  customer_id: number
  category_id: number
  site_id: number
  management_team_id: number
  created_at_utc: string
  cancelled_at_utc: string | null
}

export type PromiseVersion = {
  order_id: number
  version_no: number
  window_start_utc: string
  window_end_utc: string
  site_time_zone: string
  effective_at_utc: string
  recorded_at_utc: string
}

export type OrderLine = {
  order_id: number
  line_no: number
  category_id: number
  product_id: number
  ordered_qty: number
}

export type StockEvent = {
  event_id: string
  order_id: number
  line_no: number
  stock_status: StockStatus
  occurred_at_utc: string
  recorded_at_utc: string
  recorded_by: string
}

export type Shipment = {
  shipment_id: string
  shipment_type: ShipmentType
  warehouse_id: number
  carrier_id: number | null
  planned_departure_at_utc: string | null
  planned_arrival_at_utc: string | null
  vehicle_type: string | null
  vehicle_capacity_kg: number | null
  status: ShipmentStatus
}

export type ShipmentStop = {
  stop_id: number
  shipment_id: string
  site_id: number
  stop_sequence: number
  planned_eta_at_utc: string | null
}

export type WarehouseEvent = {
  event_id: string
  shipment_id: string
  stage: WarehouseStage
  occurred_at_utc: string
  recorded_at_utc: string
  recorded_by: string
}

export type EtaUpdate = {
  update_id: string
  stop_id: number
  current_eta_at_utc: string
  occurred_at_utc: string
  recorded_at_utc: string
  recorded_by: string
}

export type OrderSnapshot = {
  snapshot_id: string
  order_id: number
  promise_version_no: number
  as_of_utc: string
  feature_schema_version: string
  promised_to_utc: string
  hours_to_deadline: number
  customer_type: CustomerType | null
  item_count: number | null
  item_quantity: number | null
  weight_kg: number | null
  volume_m3: number | null
  special_handling: 0 | 1 | null
  stock_status: StockStatus | null
  warehouse_stage: WarehouseStage | null
  planned_departure_at_utc: string | null
  actual_departure_delay_minutes: number | null
  planned_eta_at_utc: string | null
  current_eta_at_utc: string | null
  eta_delay_minutes: number | null
  travel_hours: number | null
  region_name: string | null
  warehouse_name: string | null
  carrier_name: string | null
  weather_severity: 0 | 1 | 2 | null
  holiday_flag: 0 | 1 | null
}

export type RiskScore = {
  score_id: number
  snapshot_id: string
  model_version: string
  scored_at_utc: string
  p_late: number
  reason_codes_json: string
}

export type OriginalDeliveryOutcome = {
  order_id: number
  original_completed_at_utc: string | null
  label_status: OutcomeLabelStatus
  original_late: 0 | 1 | null
  evaluated_at_utc: string
}

/* —— migrations/0001_agent.sql —— */

export type RiskEpisode = {
  episode_id: string
  order_id: number
  opened_at_utc: string
  closed_at_utc: string | null
  opening_score_id: number
  latest_score_id: number
}

export type WorklistItem = {
  order_id: number
  episode_id: string
  latest_score_id: number
  status: WorklistItemStatus
  updated_at_utc: string
}

export type AgentRun = {
  run_id: string
  trigger_id: string | null
  order_id: number
  decision_time_utc: string
  status: AgentRunStatus
  eligibility_reason: string | null
  score_id: number | null
  next_due_at_utc: string | null
  error_message: string | null
  created_at_utc: string
}

export type AgentRecommendation = {
  recommendation_id: string
  run_id: string
  score_id: number
  action_id: PlaybookActionId | null
  output_json: string | null
  validation_status: RecommendationValidationStatus
  created_at_utc: string
}

export type SimulatedNotification = {
  notification_id: string
  episode_id: string
  recommendation_id: string | null
  kind: NotificationKind
  payload_json: string
  created_at_utc: string
  acknowledged_at_utc: string | null
}

export type PlannerFeedback = {
  feedback_id: string
  recommendation_id: string
  chosen_action_id: PlaybookActionId | null
  notes: string | null
  recorded_by: string
  recorded_at_utc: string
}

export type OrderLifecycleEvent = {
  event_id: string
  order_id: number
  event_type: LifecycleEventType
  occurred_at_utc: string
  recorded_at_utc: string
}

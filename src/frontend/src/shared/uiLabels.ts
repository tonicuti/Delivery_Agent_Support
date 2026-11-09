/**
 * Plain-language UI labels for end users (no schema / model jargon).
 */
import type { PlaybookActionId, WarehouseStage } from '@/shared/types'

export const WAREHOUSE_STAGE_LABEL: Record<WarehouseStage, string> = {
  waiting: 'Waiting to start',
  pick_started: 'Picking',
  packed: 'Packed',
  loaded: 'Loaded',
  departed: 'On the way',
}

export function warehouseStageLabel(
  stage: string | null | undefined,
): string {
  if (!stage) return '—'
  return (
    WAREHOUSE_STAGE_LABEL[stage as WarehouseStage] ??
    stage.replace(/_/g, ' ')
  )
}

export const STOCK_STATUS_LABEL: Record<string, string> = {
  in_stock: 'In stock',
  short: 'Low stock',
  backorder: 'On backorder',
  unknown: 'Unknown',
}

export function stockStatusLabel(status: string | null | undefined): string {
  if (!status) return '—'
  return STOCK_STATUS_LABEL[status] ?? status.replace(/_/g, ' ')
}

export const RISK_BAND_LABEL = {
  High: 'High chance of delay',
  Medium: 'Some chance of delay',
  Low: 'Looking okay',
} as const

/** Short badge text for risk band. */
export const RISK_BAND_SHORT = {
  High: 'High',
  Medium: 'Medium',
  Low: 'Low',
} as const

export const REASON_CODE_LABEL: Record<string, string> = {
  stock_short: 'Low stock on items',
  stock_backorder: 'Items on backorder',
  pick_behind: 'Picking is behind',
  pack_missing: 'Packing not recorded yet',
  eta_delay: 'Arrival later than promised',
  departure_delay: 'Truck left later than planned',
}

export function reasonCodeLabel(code: string): string {
  return REASON_CODE_LABEL[code] ?? code.replace(/_/g, ' ')
}

const ACTION_LABEL: Record<string, string> = {
  check_stock: 'Check stock',
  replan_route: 'Replan route',
  contact_customer: 'Contact customer',
  expedite_pick: 'Speed up picking',
  expedite_pack: 'Speed up packing',
  hold_shipment: 'Hold shipment',
  split_shipment: 'Split shipment',
  use_backup_carrier: 'Use backup carrier',
  do_nothing: 'No action needed',
  dismiss: 'Dismiss alert',
  monitor: 'Keep monitoring',
  escalate: 'Escalate',
  reschedule_delivery: 'Reschedule delivery',
  partial_ship: 'Ship what is ready',
}

export function actionIdLabel(
  actionId: PlaybookActionId | string | null | undefined,
): string {
  if (!actionId) return '—'
  return ACTION_LABEL[actionId] ?? String(actionId).replace(/_/g, ' ')
}

export const VALIDATION_STATUS_LABEL: Record<string, string> = {
  valid: 'Ready',
  invalid: 'Needs review',
  unavailable: 'No suggestion',
}

export function validationStatusLabel(status: string | null | undefined): string {
  if (!status) return '—'
  return VALIDATION_STATUS_LABEL[status] ?? status.replace(/_/g, ' ')
}

export const UI = {
  notEnoughInfo: 'Not enough info',
  outdated: 'Outdated',
  unread: 'Unread',
  markedSeen: 'Marked as seen',
  noSuggestion: 'No suggestion',
  gettingRiskier: 'Getting riskier',
  suggestedNextStep: 'Suggested next step',
  alerts: 'Alerts',
  orderNumber: 'Order number',
  promisedDelivery: 'Promised delivery',
  timeLeft: 'Time left',
  chanceOfDelay: 'Chance of delay',
  reviewOrder: 'Review order',
  markAsSeen: 'Mark as seen',
  bringBackAlert: 'Bring alert back',
  demoData: 'Demo data',
  stockholmWarehouse: 'Stockholm warehouse',
  orderSystem: 'Order system',
  warehouseSystem: 'Warehouse system',
  transportSystem: 'Transport system',
  openOrders: 'Orders needing attention',
  backToOrders: '← Back to orders',
  lastUpdate: 'Last update',
  lastCheck: 'Last check',
  yourDecision: 'Your decision',
  alertHistory: 'Alert history',
  onTimeDelivery: 'On-time delivery',
  actionTaken: 'Action taken',
  waitingDeliveryResult: 'Waiting for delivery result',
  missingPromise: 'Not enough info — promised delivery time is missing',
  pastPromise: (h: string) => `${h}h past promised time`,
  toPromiseMin: (m: number) => `${m} min left`,
  toPromiseH: (h: string) => `${h} h left`,
} as const

import type { DatabaseSync } from 'node:sqlite'
import { randomUUID } from 'node:crypto'
import {
  DATA_STALE_MINUTES,
  risk_band,
  type DataHealthSnapshot,
  type HistoryRow,
  type PlaybookActionId,
  type WorklistQuery,
  type WorklistResponse,
  type WorklistRow,
} from '../src/shared/types'

export { queryCase } from './queryCase'

type Row = Record<string, unknown>

function all(db: DatabaseSync, sql: string, params: ReadonlyArray<string | number | null> = []): Row[] {
  // node:sqlite typing is strict; values are bound scalars only.
  return db.prepare(sql).all(...(params as string[])) as Row[]
}

function get(
  db: DatabaseSync,
  sql: string,
  params: ReadonlyArray<string | number | null> = [],
): Row | undefined {
  return db.prepare(sql).get(...(params as string[])) as Row | undefined
}

function minutesSince(iso: string, now = new Date()): number {
  return Math.max(0, Math.round((now.getTime() - Date.parse(iso)) / 60_000))
}

function mapWorklistRow(r: Row): WorklistRow {
  const p_late = Number(r.p_late)
  return {
    worklist_item: {
      order_id: Number(r.order_id),
      episode_id: String(r.episode_id),
      latest_score_id: Number(r.latest_score_id),
      status: r.wl_status as 'active' | 'closed',
      updated_at_utc: String(r.wl_updated_at_utc),
    },
    risk_episode: {
      episode_id: String(r.episode_id),
      order_id: Number(r.order_id),
      opened_at_utc: String(r.opened_at_utc),
      closed_at_utc: (r.closed_at_utc as string | null) ?? null,
      opening_score_id: Number(r.opening_score_id),
      latest_score_id: Number(r.latest_score_id),
    },
    risk_score: {
      score_id: Number(r.score_id),
      snapshot_id: String(r.snapshot_id),
      model_version: String(r.model_version),
      scored_at_utc: String(r.scored_at_utc),
      p_late,
      reason_codes_json: String(r.reason_codes_json ?? '[]'),
    },
    risk_band: risk_band(p_late),
    customer_order: {
      order_id: Number(r.order_id),
      source_system: String(r.source_system),
      external_order_id: String(r.external_order_id),
      customer_id: Number(r.customer_id),
      category_id: Number(r.category_id),
      site_id: Number(r.site_id),
      management_team_id: Number(r.management_team_id),
      created_at_utc: String(r.created_at_utc),
      cancelled_at_utc: (r.cancelled_at_utc as string | null) ?? null,
    },
    customer: {
      customer_id: Number(r.customer_id),
      source_system: String(r.customer_source_system),
      external_customer_id: String(r.external_customer_id),
      customer_type: r.customer_type as 'B2B' | 'B2C',
    },
    promise_version:
      r.promise_version_no == null
        ? null
        : {
            order_id: Number(r.order_id),
            version_no: Number(r.promise_version_no),
            window_start_utc: String(r.window_start_utc),
            window_end_utc: String(r.window_end_utc),
            site_time_zone: String(r.site_time_zone),
            effective_at_utc: String(r.effective_at_utc),
            recorded_at_utc: String(r.promise_recorded_at_utc),
          },
    order_snapshot: {
      snapshot_id: String(r.snapshot_id),
      order_id: Number(r.order_id),
      promise_version_no: Number(r.snap_promise_version_no),
      as_of_utc: String(r.as_of_utc),
      feature_schema_version: String(r.feature_schema_version),
      promised_to_utc: String(r.promised_to_utc),
      hours_to_deadline: Number(r.hours_to_deadline),
      customer_type: (r.snap_customer_type as 'B2B' | 'B2C' | null) ?? null,
      item_count: r.item_count == null ? null : Number(r.item_count),
      item_quantity: r.item_quantity == null ? null : Number(r.item_quantity),
      weight_kg: r.weight_kg == null ? null : Number(r.weight_kg),
      volume_m3: r.volume_m3 == null ? null : Number(r.volume_m3),
      special_handling:
        r.special_handling == null ? null : (Number(r.special_handling) as 0 | 1),
      stock_status: (r.stock_status as WorklistRow['order_snapshot']['stock_status']) ?? null,
      warehouse_stage:
        (r.warehouse_stage as WorklistRow['order_snapshot']['warehouse_stage']) ?? null,
      planned_departure_at_utc: (r.planned_departure_at_utc as string | null) ?? null,
      actual_departure_delay_minutes:
        r.actual_departure_delay_minutes == null
          ? null
          : Number(r.actual_departure_delay_minutes),
      planned_eta_at_utc: (r.planned_eta_at_utc as string | null) ?? null,
      current_eta_at_utc: (r.current_eta_at_utc as string | null) ?? null,
      eta_delay_minutes:
        r.eta_delay_minutes == null ? null : Number(r.eta_delay_minutes),
      travel_hours: r.travel_hours == null ? null : Number(r.travel_hours),
      region_name: (r.region_name as string | null) ?? null,
      warehouse_name: (r.warehouse_name as string | null) ?? null,
      carrier_name: (r.carrier_name as string | null) ?? null,
      weather_severity:
        r.weather_severity == null ? null : (Number(r.weather_severity) as 0 | 1 | 2),
      holiday_flag: r.holiday_flag == null ? null : (Number(r.holiday_flag) as 0 | 1),
    },
    agent_recommendation:
      r.recommendation_id == null
        ? null
        : {
            recommendation_id: String(r.recommendation_id),
            run_id: String(r.run_id),
            score_id: Number(r.rec_score_id),
            action_id: (r.action_id as PlaybookActionId | null) ?? null,
            output_json: (r.output_json as string | null) ?? null,
            validation_status: r.validation_status as
              | 'valid'
              | 'invalid'
              | 'unavailable',
            created_at_utc: String(r.rec_created_at_utc),
          },
    simulated_notification:
      r.notification_id == null
        ? null
        : {
            notification_id: String(r.notification_id),
            episode_id: String(r.episode_id),
            recommendation_id: (r.ntf_recommendation_id as string | null) ?? null,
            kind: r.ntf_kind as 'initial' | 'follow_up',
            payload_json: String(r.payload_json),
            created_at_utc: String(r.ntf_created_at_utc),
            acknowledged_at_utc: (r.acknowledged_at_utc as string | null) ?? null,
          },
  }
}

const WORKLIST_SQL = `
SELECT
  w.order_id, w.episode_id, w.latest_score_id,
  w.status AS wl_status, w.updated_at_utc AS wl_updated_at_utc,
  e.opened_at_utc, e.closed_at_utc, e.opening_score_id,
  rs.score_id, rs.snapshot_id, rs.model_version, rs.scored_at_utc,
  rs.p_late, rs.reason_codes_json,
  o.source_system, o.external_order_id, o.customer_id, o.category_id,
  o.site_id, o.management_team_id, o.created_at_utc, o.cancelled_at_utc,
  cu.source_system AS customer_source_system,
  cu.external_customer_id, cu.customer_type,
  pv.version_no AS promise_version_no, pv.window_start_utc, pv.window_end_utc,
  pv.site_time_zone, pv.effective_at_utc,
  pv.recorded_at_utc AS promise_recorded_at_utc,
  os.promise_version_no AS snap_promise_version_no, os.as_of_utc,
  os.feature_schema_version, os.promised_to_utc, os.hours_to_deadline,
  os.customer_type AS snap_customer_type, os.item_count, os.item_quantity,
  os.weight_kg, os.volume_m3, os.special_handling, os.stock_status,
  os.warehouse_stage, os.planned_departure_at_utc,
  os.actual_departure_delay_minutes, os.planned_eta_at_utc,
  os.current_eta_at_utc, os.eta_delay_minutes, os.travel_hours,
  os.region_name, os.warehouse_name, os.carrier_name,
  os.weather_severity, os.holiday_flag,
  ar.recommendation_id, ar.run_id, ar.score_id AS rec_score_id,
  ar.action_id, ar.output_json, ar.validation_status,
  ar.created_at_utc AS rec_created_at_utc,
  sn.notification_id, sn.recommendation_id AS ntf_recommendation_id,
  sn.kind AS ntf_kind, sn.payload_json,
  sn.created_at_utc AS ntf_created_at_utc, sn.acknowledged_at_utc
FROM worklist_item w
JOIN risk_episode e ON e.episode_id = w.episode_id
JOIN risk_score rs ON rs.score_id = w.latest_score_id
JOIN order_snapshot os ON os.snapshot_id = rs.snapshot_id
JOIN customer_order o ON o.order_id = w.order_id
JOIN customer cu ON cu.customer_id = o.customer_id
LEFT JOIN promise_version pv
  ON pv.order_id = o.order_id AND pv.version_no = os.promise_version_no
LEFT JOIN agent_run run ON run.score_id = rs.score_id AND run.order_id = w.order_id
LEFT JOIN agent_recommendation ar ON ar.run_id = run.run_id
LEFT JOIN simulated_notification sn
  ON sn.episode_id = w.episode_id AND sn.kind = 'initial'
`

export function queryWorklist(db: DatabaseSync, params: WorklistQuery): WorklistResponse {
  const status = params.status ?? 'active'
  let rows = all(db, WORKLIST_SQL).map(mapWorklistRow)

  const seen = new Set<number>()
  rows = rows.filter((r) => {
    if (seen.has(r.customer_order.order_id)) return false
    seen.add(r.customer_order.order_id)
    return true
  })

  rows = rows.filter((r) => r.worklist_item.status === status)

  if (params.warehouse_id != null) {
    const whRows = all(
      db,
      `SELECT DISTINCT si.order_id
       FROM shipment_item si
       JOIN shipment sh ON sh.shipment_id = si.shipment_id
       WHERE sh.warehouse_id = ?`,
      [params.warehouse_id],
    ).map((r) => Number(r.order_id))
    const allow = new Set(whRows)
    rows = rows.filter((r) => allow.has(r.customer_order.order_id))
  }

  if (params.order_id != null) {
    rows = rows.filter((r) => r.customer_order.order_id === params.order_id)
  }
  if (params.external_order_id) {
    const q = params.external_order_id.trim().toUpperCase()
    rows = rows.filter(
      (r) => r.customer_order.external_order_id.toUpperCase() === q,
    )
  }
  if (params.risk_band?.length) {
    rows = rows.filter((r) => params.risk_band!.includes(r.risk_band))
  }
  if (!params.include_low_risk) {
    rows = rows.filter((r) => r.risk_band !== 'Low')
  }

  rows.sort((a, b) => b.risk_score.p_late - a.risk_score.p_late)

  const active = all(
    db,
    `SELECT order_id FROM worklist_item WHERE status = 'active'`,
  )
  const unacked = all(
    db,
    `SELECT sn.notification_id
     FROM simulated_notification sn
     JOIN worklist_item w ON w.episode_id = sn.episode_id
     WHERE w.status = 'active' AND sn.acknowledged_at_utc IS NULL`,
  )
  const stale = all(
    db,
    `SELECT rs.scored_at_utc
     FROM worklist_item w
     JOIN risk_score rs ON rs.score_id = w.latest_score_id
     WHERE w.status = 'active'`,
  ).filter((r) => minutesSince(String(r.scored_at_utc)) >= DATA_STALE_MINUTES)

  return {
    items: rows,
    summary: {
      active_count: active.length,
      unacknowledged_count: unacked.length,
      stale_score_count: stale.length,
    },
    scope: { warehouse_id: params.warehouse_id ?? null },
    generated_at_utc: new Date().toISOString(),
  }
}

export function queryHistory(db: DatabaseSync): HistoryRow[] {
  const rows = all(
    db,
    `SELECT e.episode_id, e.order_id, e.opened_at_utc, e.closed_at_utc,
            e.opening_score_id, e.latest_score_id,
            o.external_order_id, o.source_system, o.customer_id, o.category_id,
            o.site_id, o.management_team_id, o.created_at_utc, o.cancelled_at_utc,
            rs.score_id, rs.snapshot_id, rs.model_version, rs.scored_at_utc,
            rs.p_late, rs.reason_codes_json,
            os.promise_version_no, os.as_of_utc, os.feature_schema_version,
            os.promised_to_utc, os.hours_to_deadline, os.customer_type,
            os.item_count, os.item_quantity, os.weight_kg, os.volume_m3,
            os.special_handling, os.stock_status, os.warehouse_stage,
            os.planned_departure_at_utc, os.actual_departure_delay_minutes,
            os.planned_eta_at_utc, os.current_eta_at_utc, os.eta_delay_minutes,
            os.travel_hours, os.region_name, os.warehouse_name, os.carrier_name,
            os.weather_severity, os.holiday_flag,
            ar.recommendation_id, ar.run_id, ar.action_id, ar.output_json,
            ar.validation_status, ar.created_at_utc AS rec_created_at_utc,
            pf.feedback_id, pf.chosen_action_id, pf.notes, pf.recorded_by,
            pf.recorded_at_utc,
            od.original_completed_at_utc, od.label_status, od.original_late,
            od.evaluated_at_utc
     FROM risk_episode e
     JOIN customer_order o ON o.order_id = e.order_id
     JOIN risk_score rs ON rs.score_id = e.opening_score_id
     JOIN order_snapshot os ON os.snapshot_id = rs.snapshot_id
     LEFT JOIN agent_run run ON run.score_id = rs.score_id AND run.order_id = e.order_id
     LEFT JOIN agent_recommendation ar ON ar.run_id = run.run_id
     LEFT JOIN planner_feedback pf ON pf.recommendation_id = ar.recommendation_id
     LEFT JOIN original_delivery_outcome od ON od.order_id = e.order_id
     ORDER BY e.opened_at_utc DESC, pf.recorded_at_utc DESC`,
  )

  const seen = new Set<string>()
  const out: HistoryRow[] = []
  for (const r of rows) {
    const ep = String(r.episode_id)
    if (seen.has(ep)) continue
    seen.add(ep)
    const p_late = Number(r.p_late)
    out.push({
      risk_episode: {
        episode_id: ep,
        order_id: Number(r.order_id),
        opened_at_utc: String(r.opened_at_utc),
        closed_at_utc: (r.closed_at_utc as string | null) ?? null,
        opening_score_id: Number(r.opening_score_id),
        latest_score_id: Number(r.latest_score_id),
      },
      customer_order: {
        order_id: Number(r.order_id),
        source_system: String(r.source_system),
        external_order_id: String(r.external_order_id),
        customer_id: Number(r.customer_id),
        category_id: Number(r.category_id),
        site_id: Number(r.site_id),
        management_team_id: Number(r.management_team_id),
        created_at_utc: String(r.created_at_utc),
        cancelled_at_utc: (r.cancelled_at_utc as string | null) ?? null,
      },
      risk_score: {
        score_id: Number(r.score_id),
        snapshot_id: String(r.snapshot_id),
        model_version: String(r.model_version),
        scored_at_utc: String(r.scored_at_utc),
        p_late,
        reason_codes_json: String(r.reason_codes_json ?? '[]'),
      },
      risk_band: risk_band(p_late),
      agent_recommendation: r.recommendation_id
        ? {
            recommendation_id: String(r.recommendation_id),
            run_id: String(r.run_id),
            score_id: Number(r.score_id),
            action_id: (r.action_id as PlaybookActionId | null) ?? null,
            output_json: (r.output_json as string | null) ?? null,
            validation_status: r.validation_status as
              | 'valid'
              | 'invalid'
              | 'unavailable',
            created_at_utc: String(r.rec_created_at_utc),
          }
        : null,
      planner_feedback: r.feedback_id
        ? {
            feedback_id: String(r.feedback_id),
            recommendation_id: String(r.recommendation_id),
            chosen_action_id: (r.chosen_action_id as PlaybookActionId | null) ?? null,
            notes: (r.notes as string | null) ?? null,
            recorded_by: String(r.recorded_by),
            recorded_at_utc: String(r.recorded_at_utc),
          }
        : null,
      original_delivery_outcome: r.label_status
        ? {
            order_id: Number(r.order_id),
            original_completed_at_utc:
              (r.original_completed_at_utc as string | null) ?? null,
            label_status: r.label_status as 'known' | 'unknown',
            original_late:
              r.original_late == null ? null : (Number(r.original_late) as 0 | 1),
            evaluated_at_utc: String(r.evaluated_at_utc),
          }
        : null,
      order_snapshot: {
        snapshot_id: String(r.snapshot_id),
        order_id: Number(r.order_id),
        promise_version_no: Number(r.promise_version_no),
        as_of_utc: String(r.as_of_utc),
        feature_schema_version: String(r.feature_schema_version),
        promised_to_utc: String(r.promised_to_utc),
        hours_to_deadline: Number(r.hours_to_deadline),
        customer_type: (r.customer_type as 'B2B' | 'B2C' | null) ?? null,
        item_count: r.item_count == null ? null : Number(r.item_count),
        item_quantity: r.item_quantity == null ? null : Number(r.item_quantity),
        weight_kg: r.weight_kg == null ? null : Number(r.weight_kg),
        volume_m3: r.volume_m3 == null ? null : Number(r.volume_m3),
        special_handling:
          r.special_handling == null ? null : (Number(r.special_handling) as 0 | 1),
        stock_status:
          (r.stock_status as HistoryRow['order_snapshot']['stock_status']) ?? null,
        warehouse_stage:
          (r.warehouse_stage as HistoryRow['order_snapshot']['warehouse_stage']) ?? null,
        planned_departure_at_utc: (r.planned_departure_at_utc as string | null) ?? null,
        actual_departure_delay_minutes:
          r.actual_departure_delay_minutes == null
            ? null
            : Number(r.actual_departure_delay_minutes),
        planned_eta_at_utc: (r.planned_eta_at_utc as string | null) ?? null,
        current_eta_at_utc: (r.current_eta_at_utc as string | null) ?? null,
        eta_delay_minutes:
          r.eta_delay_minutes == null ? null : Number(r.eta_delay_minutes),
        travel_hours: r.travel_hours == null ? null : Number(r.travel_hours),
        region_name: (r.region_name as string | null) ?? null,
        warehouse_name: (r.warehouse_name as string | null) ?? null,
        carrier_name: (r.carrier_name as string | null) ?? null,
        weather_severity:
          r.weather_severity == null ? null : (Number(r.weather_severity) as 0 | 1 | 2),
        holiday_flag: r.holiday_flag == null ? null : (Number(r.holiday_flag) as 0 | 1),
      },
    })
  }
  return out
}

export function queryDataHealth(db: DatabaseSync): DataHealthSnapshot {
  const wh = get(db, `SELECT MAX(recorded_at_utc) AS t FROM warehouse_event`)
  const eta = get(db, `SELECT MAX(recorded_at_utc) AS t FROM eta_update`)
  const score = get(
    db,
    `SELECT MAX(scored_at_utc) AS t, model_version FROM risk_score`,
  )
  const rec = get(db, `SELECT MAX(created_at_utc) AS t FROM agent_recommendation`)
  return {
    warehouse_event_latest_utc: (wh?.t as string | null) ?? null,
    eta_update_latest_utc: (eta?.t as string | null) ?? null,
    risk_score_latest_utc: (score?.t as string | null) ?? null,
    agent_recommendation_latest_utc: (rec?.t as string | null) ?? null,
    model_version: (score?.model_version as string | null) ?? null,
    agent_enabled: true,
    stale_after_minutes: DATA_STALE_MINUTES,
  }
}

export function writePlannerFeedback(
  db: DatabaseSync,
  input: {
    recommendation_id: string
    chosen_action_id: PlaybookActionId | null
    notes: string | null
    recorded_by: string
    recorded_at_utc: string
  },
) {
  const feedback_id = randomUUID()
  db.prepare(
    `INSERT INTO planner_feedback(
       feedback_id, recommendation_id, chosen_action_id, notes, recorded_by, recorded_at_utc
     ) VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    feedback_id,
    input.recommendation_id,
    input.chosen_action_id ?? null,
    input.notes ?? null,
    input.recorded_by,
    input.recorded_at_utc,
  )
  const order = get(
    db,
    `SELECT run.order_id
     FROM agent_recommendation ar
     JOIN agent_run run ON run.run_id = ar.run_id
     WHERE ar.recommendation_id = ?`,
    [input.recommendation_id],
  )
  if (order) {
    db.prepare(
      `UPDATE worklist_item SET status = 'closed', updated_at_utc = ? WHERE order_id = ?`,
    ).run(input.recorded_at_utc, Number(order.order_id))
  }
  return get(db, `SELECT * FROM planner_feedback WHERE feedback_id = ?`, [
    feedback_id,
  ])!
}

/**
 * Remove one planner_feedback row (session only).
 * If the order has no remaining feedback, reopen worklist_item as active.
 */
export function deletePlannerFeedback(
  db: DatabaseSync,
  feedback_id: string,
): { deleted: true; order_id: number | null; worklist_reopened: boolean } {
  const row = get(
    db,
    `SELECT pf.feedback_id, pf.recommendation_id, run.order_id
     FROM planner_feedback pf
     JOIN agent_recommendation ar ON ar.recommendation_id = pf.recommendation_id
     JOIN agent_run run ON run.run_id = ar.run_id
     WHERE pf.feedback_id = ?`,
    [feedback_id],
  )
  if (!row) {
    throw new Error(`planner_feedback ${feedback_id} not found`)
  }
  const order_id = Number(row.order_id)
  db.prepare(`DELETE FROM planner_feedback WHERE feedback_id = ?`).run(
    feedback_id,
  )

  const remaining = get(
    db,
    `SELECT pf.feedback_id
     FROM planner_feedback pf
     JOIN agent_recommendation ar ON ar.recommendation_id = pf.recommendation_id
     JOIN agent_run run ON run.run_id = ar.run_id
     WHERE run.order_id = ?
     LIMIT 1`,
    [order_id],
  )
  let worklist_reopened = false
  if (!remaining) {
    const now = new Date().toISOString()
    db.prepare(
      `UPDATE worklist_item SET status = 'active', updated_at_utc = ? WHERE order_id = ?`,
    ).run(now, order_id)
    worklist_reopened = true
  }
  return { deleted: true, order_id, worklist_reopened }
}

export function writeAck(
  db: DatabaseSync,
  input: { notification_id: string; acknowledged_at_utc: string },
) {
  db.prepare(
    `UPDATE simulated_notification SET acknowledged_at_utc = ? WHERE notification_id = ?`,
  ).run(input.acknowledged_at_utc, input.notification_id)
  return get(db, `SELECT * FROM simulated_notification WHERE notification_id = ?`, [
    input.notification_id,
  ])!
}

/** Clear ack so the alert returns to unacknowledged (undo / restore). */
export function writeUnack(db: DatabaseSync, notification_id: string) {
  db.prepare(
    `UPDATE simulated_notification SET acknowledged_at_utc = NULL WHERE notification_id = ?`,
  ).run(notification_id)
  return get(db, `SELECT * FROM simulated_notification WHERE notification_id = ?`, [
    notification_id,
  ])!
}

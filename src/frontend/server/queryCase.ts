import type { DatabaseSync } from 'node:sqlite'
import {
  risk_band,
  type CaseDetail,
  type PlaybookActionId,
} from '../src/shared/types'

type Row = Record<string, unknown>

function get(
  db: DatabaseSync,
  sql: string,
  params: ReadonlyArray<string | number | null> = [],
): Row | undefined {
  return db.prepare(sql).get(...(params as string[])) as Row | undefined
}

function all(
  db: DatabaseSync,
  sql: string,
  params: ReadonlyArray<string | number | null> = [],
): Row[] {
  return db.prepare(sql).all(...(params as string[])) as Row[]
}

export function queryCase(db: DatabaseSync, order_id: number): CaseDetail {
  const wl = get(
    db,
    `SELECT w.order_id, w.episode_id, w.latest_score_id, w.status, w.updated_at_utc,
            e.opened_at_utc, e.closed_at_utc, e.opening_score_id
     FROM worklist_item w
     JOIN risk_episode e ON e.episode_id = w.episode_id
     WHERE w.order_id = ?`,
    [order_id],
  )
  if (!wl) {
    throw new Error(
      `order_id ${order_id} has no worklist_item — score with backend agent first`,
    )
  }

  const rs = get(db, `SELECT * FROM risk_score WHERE score_id = ?`, [
    Number(wl.latest_score_id),
  ])
  if (!rs) throw new Error(`risk_score ${wl.latest_score_id} missing`)

  const os = get(db, `SELECT * FROM order_snapshot WHERE snapshot_id = ?`, [
    String(rs.snapshot_id),
  ])
  if (!os) throw new Error(`order_snapshot ${rs.snapshot_id} missing`)

  const o = get(db, `SELECT * FROM customer_order WHERE order_id = ?`, [order_id])
  if (!o) throw new Error(`customer_order ${order_id} missing`)

  const cu = get(db, `SELECT * FROM customer WHERE customer_id = ?`, [
    Number(o.customer_id),
  ])
  if (!cu) throw new Error(`customer ${o.customer_id} missing`)

  const ds = get(db, `SELECT * FROM delivery_site WHERE site_id = ?`, [
    Number(o.site_id),
  ])
  if (!ds) throw new Error(`delivery_site ${o.site_id} missing`)

  const pv = get(
    db,
    `SELECT * FROM promise_version WHERE order_id = ? AND version_no = ?`,
    [order_id, Number(os.promise_version_no)],
  )

  const lines = all(
    db,
    `SELECT ol.order_id, ol.line_no, ol.category_id, ol.product_id, ol.ordered_qty,
            p.source_system, p.external_product_id, p.name, p.unit,
            p.unit_weight_kg, p.unit_volume_m3, p.special_handling
     FROM order_line ol
     JOIN product p ON p.product_id = ol.product_id
     WHERE ol.order_id = ?
     ORDER BY ol.line_no`,
    [order_id],
  ).map((line) => {
    const stock = get(
      db,
      `SELECT * FROM stock_event
       WHERE order_id = ? AND line_no = ?
       ORDER BY recorded_at_utc DESC LIMIT 1`,
      [order_id, Number(line.line_no)],
    )
    return {
      order_id: Number(line.order_id),
      line_no: Number(line.line_no),
      category_id: Number(line.category_id),
      product_id: Number(line.product_id),
      ordered_qty: Number(line.ordered_qty),
      product: {
        product_id: Number(line.product_id),
        category_id: Number(line.category_id),
        source_system: String(line.source_system),
        external_product_id: String(line.external_product_id),
        name: String(line.name),
        unit: String(line.unit),
        unit_weight_kg:
          line.unit_weight_kg == null ? null : Number(line.unit_weight_kg),
        unit_volume_m3:
          line.unit_volume_m3 == null ? null : Number(line.unit_volume_m3),
        special_handling: Number(line.special_handling) as 0 | 1,
      },
      latest_stock_event: stock
        ? {
            event_id: String(stock.event_id),
            order_id: Number(stock.order_id),
            line_no: Number(stock.line_no),
            stock_status: stock.stock_status as 'in_stock' | 'short' | 'backorder',
            occurred_at_utc: String(stock.occurred_at_utc),
            recorded_at_utc: String(stock.recorded_at_utc),
            recorded_by: String(stock.recorded_by),
          }
        : null,
    }
  })

  const ship = get(
    db,
    `SELECT sh.shipment_id, sh.shipment_type, sh.warehouse_id, sh.carrier_id,
            sh.planned_departure_at_utc, sh.planned_arrival_at_utc,
            sh.vehicle_type, sh.vehicle_capacity_kg, sh.status,
            wh.name AS wh_name, wh.latitude AS wh_lat, wh.longitude AS wh_lng,
            ca.name AS ca_name, ca.own_fleet
     FROM shipment_item si
     JOIN shipment sh ON sh.shipment_id = si.shipment_id
     JOIN warehouse wh ON wh.warehouse_id = sh.warehouse_id
     LEFT JOIN carrier ca ON ca.carrier_id = sh.carrier_id
     WHERE si.order_id = ?
     ORDER BY sh.planned_departure_at_utc DESC
     LIMIT 1`,
    [order_id],
  )

  let shipment: CaseDetail['shipment'] = null
  if (ship) {
    const stop = get(
      db,
      `SELECT * FROM shipment_stop WHERE shipment_id = ? ORDER BY stop_sequence LIMIT 1`,
      [String(ship.shipment_id)],
    )
    const events = all(
      db,
      `SELECT * FROM warehouse_event WHERE shipment_id = ? ORDER BY recorded_at_utc`,
      [String(ship.shipment_id)],
    )
    const eta =
      stop == null
        ? undefined
        : get(
            db,
            `SELECT * FROM eta_update WHERE stop_id = ? ORDER BY recorded_at_utc DESC LIMIT 1`,
            [Number(stop.stop_id)],
          )
    shipment = {
      shipment_id: String(ship.shipment_id),
      shipment_type: ship.shipment_type as NonNullable<CaseDetail['shipment']>['shipment_type'],
      warehouse_id: Number(ship.warehouse_id),
      carrier_id: ship.carrier_id == null ? null : Number(ship.carrier_id),
      planned_departure_at_utc: (ship.planned_departure_at_utc as string | null) ?? null,
      planned_arrival_at_utc: (ship.planned_arrival_at_utc as string | null) ?? null,
      vehicle_type: (ship.vehicle_type as string | null) ?? null,
      vehicle_capacity_kg:
        ship.vehicle_capacity_kg == null ? null : Number(ship.vehicle_capacity_kg),
      status: ship.status as NonNullable<CaseDetail['shipment']>['status'],
      warehouse: {
        warehouse_id: Number(ship.warehouse_id),
        name: String(ship.wh_name),
        latitude: ship.wh_lat == null ? null : Number(ship.wh_lat),
        longitude: ship.wh_lng == null ? null : Number(ship.wh_lng),
      },
      carrier:
        ship.carrier_id == null
          ? null
          : {
              carrier_id: Number(ship.carrier_id),
              name: String(ship.ca_name),
              own_fleet: Number(ship.own_fleet) as 0 | 1,
            },
      stop: stop
        ? {
            stop_id: Number(stop.stop_id),
            shipment_id: String(stop.shipment_id),
            site_id: Number(stop.site_id),
            stop_sequence: Number(stop.stop_sequence),
            planned_eta_at_utc: (stop.planned_eta_at_utc as string | null) ?? null,
          }
        : null,
      warehouse_events: events.map((ev) => ({
        event_id: String(ev.event_id),
        shipment_id: String(ev.shipment_id),
        stage: ev.stage as NonNullable<
          CaseDetail['shipment']
        >['warehouse_events'][number]['stage'],
        occurred_at_utc: String(ev.occurred_at_utc),
        recorded_at_utc: String(ev.recorded_at_utc),
        recorded_by: String(ev.recorded_by),
      })),
      latest_eta_update: eta
        ? {
            update_id: String(eta.update_id),
            stop_id: Number(eta.stop_id),
            current_eta_at_utc: String(eta.current_eta_at_utc),
            occurred_at_utc: String(eta.occurred_at_utc),
            recorded_at_utc: String(eta.recorded_at_utc),
            recorded_by: String(eta.recorded_by),
          }
        : null,
    }
  }

  const rec = get(
    db,
    `SELECT ar.*
     FROM agent_recommendation ar
     JOIN agent_run run ON run.run_id = ar.run_id
     WHERE run.order_id = ?
     ORDER BY ar.created_at_utc DESC
     LIMIT 1`,
    [order_id],
  )
  const ntf = get(
    db,
    `SELECT * FROM simulated_notification WHERE episode_id = ? AND kind = 'initial'`,
    [String(wl.episode_id)],
  )
  const feedback =
    rec == null
      ? undefined
      : get(
          db,
          `SELECT * FROM planner_feedback WHERE recommendation_id = ? ORDER BY recorded_at_utc DESC LIMIT 1`,
          [String(rec.recommendation_id)],
        )
  const outcome = get(
    db,
    `SELECT * FROM original_delivery_outcome WHERE order_id = ?`,
    [order_id],
  )

  const p_late = Number(rs.p_late)

  return {
    customer_order: {
      order_id: Number(o.order_id),
      source_system: String(o.source_system),
      external_order_id: String(o.external_order_id),
      customer_id: Number(o.customer_id),
      category_id: Number(o.category_id),
      site_id: Number(o.site_id),
      management_team_id: Number(o.management_team_id),
      created_at_utc: String(o.created_at_utc),
      cancelled_at_utc: (o.cancelled_at_utc as string | null) ?? null,
    },
    customer: {
      customer_id: Number(cu.customer_id),
      source_system: String(cu.source_system),
      external_customer_id: String(cu.external_customer_id),
      customer_type: cu.customer_type as 'B2B' | 'B2C',
    },
    delivery_site: {
      site_id: Number(ds.site_id),
      region_id: Number(ds.region_id),
      postcode: String(ds.postcode),
      latitude: ds.latitude == null ? null : Number(ds.latitude),
      longitude: ds.longitude == null ? null : Number(ds.longitude),
      time_zone: String(ds.time_zone),
      country_code: (ds.country_code as string | null) ?? null,
    },
    promise_version: pv
      ? {
          order_id: Number(pv.order_id),
          version_no: Number(pv.version_no),
          window_start_utc: String(pv.window_start_utc),
          window_end_utc: String(pv.window_end_utc),
          site_time_zone: String(pv.site_time_zone),
          effective_at_utc: String(pv.effective_at_utc),
          recorded_at_utc: String(pv.recorded_at_utc),
        }
      : null,
    order_lines: lines,
    shipment,
    order_snapshot: {
      snapshot_id: String(os.snapshot_id),
      order_id: Number(os.order_id),
      promise_version_no: Number(os.promise_version_no),
      as_of_utc: String(os.as_of_utc),
      feature_schema_version: String(os.feature_schema_version),
      promised_to_utc: String(os.promised_to_utc),
      hours_to_deadline: Number(os.hours_to_deadline),
      customer_type: (os.customer_type as 'B2B' | 'B2C' | null) ?? null,
      item_count: os.item_count == null ? null : Number(os.item_count),
      item_quantity: os.item_quantity == null ? null : Number(os.item_quantity),
      weight_kg: os.weight_kg == null ? null : Number(os.weight_kg),
      volume_m3: os.volume_m3 == null ? null : Number(os.volume_m3),
      special_handling:
        os.special_handling == null ? null : (Number(os.special_handling) as 0 | 1),
      stock_status: (os.stock_status as CaseDetail['order_snapshot']['stock_status']) ?? null,
      warehouse_stage:
        (os.warehouse_stage as CaseDetail['order_snapshot']['warehouse_stage']) ?? null,
      planned_departure_at_utc: (os.planned_departure_at_utc as string | null) ?? null,
      actual_departure_delay_minutes:
        os.actual_departure_delay_minutes == null
          ? null
          : Number(os.actual_departure_delay_minutes),
      planned_eta_at_utc: (os.planned_eta_at_utc as string | null) ?? null,
      current_eta_at_utc: (os.current_eta_at_utc as string | null) ?? null,
      eta_delay_minutes:
        os.eta_delay_minutes == null ? null : Number(os.eta_delay_minutes),
      travel_hours: os.travel_hours == null ? null : Number(os.travel_hours),
      region_name: (os.region_name as string | null) ?? null,
      warehouse_name: (os.warehouse_name as string | null) ?? null,
      carrier_name: (os.carrier_name as string | null) ?? null,
      weather_severity:
        os.weather_severity == null ? null : (Number(os.weather_severity) as 0 | 1 | 2),
      holiday_flag: os.holiday_flag == null ? null : (Number(os.holiday_flag) as 0 | 1),
    },
    risk_score: {
      score_id: Number(rs.score_id),
      snapshot_id: String(rs.snapshot_id),
      model_version: String(rs.model_version),
      scored_at_utc: String(rs.scored_at_utc),
      p_late,
      reason_codes_json: String(rs.reason_codes_json ?? '[]'),
    },
    risk_band: risk_band(p_late),
    risk_episode: {
      episode_id: String(wl.episode_id),
      order_id: Number(wl.order_id),
      opened_at_utc: String(wl.opened_at_utc),
      closed_at_utc: (wl.closed_at_utc as string | null) ?? null,
      opening_score_id: Number(wl.opening_score_id),
      latest_score_id: Number(wl.latest_score_id),
    },
    worklist_item: {
      order_id: Number(wl.order_id),
      episode_id: String(wl.episode_id),
      latest_score_id: Number(wl.latest_score_id),
      status: wl.status as 'active' | 'closed',
      updated_at_utc: String(wl.updated_at_utc),
    },
    agent_recommendation: rec
      ? {
          recommendation_id: String(rec.recommendation_id),
          run_id: String(rec.run_id),
          score_id: Number(rec.score_id),
          action_id: (rec.action_id as PlaybookActionId | null) ?? null,
          output_json: (rec.output_json as string | null) ?? null,
          validation_status: rec.validation_status as
            | 'valid'
            | 'invalid'
            | 'unavailable',
          created_at_utc: String(rec.created_at_utc),
        }
      : null,
    simulated_notification: ntf
      ? {
          notification_id: String(ntf.notification_id),
          episode_id: String(ntf.episode_id),
          recommendation_id: (ntf.recommendation_id as string | null) ?? null,
          kind: ntf.kind as 'initial' | 'follow_up',
          payload_json: String(ntf.payload_json),
          created_at_utc: String(ntf.created_at_utc),
          acknowledged_at_utc: (ntf.acknowledged_at_utc as string | null) ?? null,
        }
      : null,
    planner_feedback: feedback
      ? {
          feedback_id: String(feedback.feedback_id),
          recommendation_id: String(feedback.recommendation_id),
          chosen_action_id: (feedback.chosen_action_id as PlaybookActionId | null) ?? null,
          notes: (feedback.notes as string | null) ?? null,
          recorded_by: String(feedback.recorded_by),
          recorded_at_utc: String(feedback.recorded_at_utc),
        }
      : null,
    original_delivery_outcome: outcome
      ? {
          order_id: Number(outcome.order_id),
          original_completed_at_utc:
            (outcome.original_completed_at_utc as string | null) ?? null,
          label_status: outcome.label_status as 'known' | 'unknown',
          original_late:
            outcome.original_late == null
              ? null
              : (Number(outcome.original_late) as 0 | 1),
          evaluated_at_utc: String(outcome.evaluated_at_utc),
        }
      : null,
  }
}

-- Synthetic practice cases extending backend/inference_seed.sql.
-- Load into a fresh database AFTER schema_fresh.sql and inference_seed.sql.
-- All timestamps are UTC. Use 2026-11-06T12:00:00Z as the first decision time.
PRAGMA foreign_keys = ON;
BEGIN;

INSERT INTO planning_region(region_id, name) VALUES (2, 'Gothenburg');
INSERT INTO management_team(team_id, name) VALUES (2, 'Gothenburg Order Team');
INSERT INTO customer(customer_id, source_system, external_customer_id, customer_type)
VALUES (3, 'practice', 'BUILDER-WEST', 'B2B');
INSERT INTO delivery_site(site_id, region_id, postcode, latitude, longitude, time_zone)
VALUES (2, 2, '411 03', 57.7089, 11.9746, 'Europe/Stockholm');
INSERT INTO product(product_id, category_id, source_system, external_product_id,
                    name, unit, unit_weight_kg, unit_volume_m3, special_handling)
VALUES (3, 1, 'practice', 'TREATED-BOARD', 'Treated board', 'board', 6.0, NULL, 1);
INSERT INTO warehouse(warehouse_id, name, latitude, longitude)
VALUES (3, 'Gothenburg', 57.72, 11.95);
INSERT INTO carrier(carrier_id, name, own_fleet)
VALUES (3, 'West Freight', 0);

INSERT INTO customer_order(order_id, source_system, external_order_id, customer_id,
                           category_id, site_id, management_team_id, created_at_utc,
                           cancelled_at_utc)
VALUES
  (1004, 'practice', 'ORDER-1004', 2, 1, 1, 1, '2026-11-05T09:30:00Z', NULL),
  (1005, 'practice', 'ORDER-1005', 1, 1, 1, 1, '2026-11-05T09:40:00Z', NULL),
  (1006, 'practice', 'ORDER-1006', 3, 1, 2, 2, '2026-11-05T09:50:00Z', NULL),
  (1007, 'practice', 'ORDER-1007', 2, 1, 1, 1, '2026-11-05T10:00:00Z', NULL),
  (1008, 'practice', 'ORDER-1008', 1, 1, 1, 1, '2026-11-05T10:10:00Z', NULL),
  (1009, 'practice', 'ORDER-1009', 2, 1, 1, 1, '2026-11-05T10:20:00Z', '2026-11-06T11:00:00Z'),
  (1010, 'practice', 'ORDER-1010', 3, 1, 2, 2, '2026-11-05T10:30:00Z', NULL);

INSERT INTO promise_version(order_id, version_no, window_start_utc, window_end_utc,
                            site_time_zone, effective_at_utc, recorded_at_utc)
VALUES
  (1004, 1, '2026-11-06T15:00:00Z', '2026-11-06T18:00:00Z', 'Europe/Stockholm', '2026-11-05T09:30:00Z', '2026-11-05T09:30:00Z'),
  (1005, 1, '2026-11-06T14:00:00Z', '2026-11-06T17:00:00Z', 'Europe/Stockholm', '2026-11-05T09:40:00Z', '2026-11-05T09:40:00Z'),
  (1006, 1, '2026-11-06T15:00:00Z', '2026-11-06T18:00:00Z', 'Europe/Stockholm', '2026-11-05T09:50:00Z', '2026-11-05T09:50:00Z'),
  (1007, 1, '2026-11-06T13:00:00Z', '2026-11-06T16:00:00Z', 'Europe/Stockholm', '2026-11-05T10:00:00Z', '2026-11-05T10:00:00Z'),
  (1008, 1, '2026-11-06T13:00:00Z', '2026-11-06T16:00:00Z', 'Europe/Stockholm', '2026-11-05T10:10:00Z', '2026-11-05T10:10:00Z'),
  (1009, 1, '2026-11-06T13:00:00Z', '2026-11-06T16:00:00Z', 'Europe/Stockholm', '2026-11-05T10:20:00Z', '2026-11-05T10:20:00Z'),
  (1010, 1, '2026-11-06T11:00:00Z', '2026-11-06T14:00:00Z', 'Europe/Stockholm', '2026-11-05T10:30:00Z', '2026-11-05T10:30:00Z');

INSERT INTO order_line(order_id, line_no, category_id, product_id, ordered_qty)
VALUES
  (1004, 1, 1, 1, 12),
  (1005, 1, 1, 3, 8),
  (1006, 1, 1, 1, 24), (1006, 2, 1, 2, 6),
  (1007, 1, 1, 2, 10),
  (1008, 1, 1, 1, 10),
  (1009, 1, 1, 1, 4),
  (1010, 1, 1, 2, 5);

INSERT INTO stock_event(event_id, order_id, line_no, stock_status,
                        occurred_at_utc, recorded_at_utc, recorded_by)
VALUES
  ('STOCK-1004', 1004, 1, 'in_stock', '2026-11-06T10:00:00Z', '2026-11-06T10:05:00Z', 'practice_staff'),
  ('STOCK-1006-1', 1006, 1, 'in_stock', '2026-11-06T09:00:00Z', '2026-11-06T09:05:00Z', 'practice_staff'),
  ('STOCK-1006-2', 1006, 2, 'in_stock', '2026-11-06T09:00:00Z', '2026-11-06T09:05:00Z', 'practice_staff'),
  ('STOCK-1007-SHORT', 1007, 1, 'short', '2026-11-06T11:00:00Z', '2026-11-06T11:05:00Z', 'practice_staff'),
  ('STOCK-1007-RESTORED', 1007, 1, 'in_stock', '2026-11-06T13:00:00Z', '2026-11-06T13:05:00Z', 'practice_staff'),
  ('STOCK-1008', 1008, 1, 'in_stock', '2026-11-06T08:00:00Z', '2026-11-06T08:05:00Z', 'practice_staff'),
  ('STOCK-1010', 1010, 1, 'in_stock', '2026-11-06T08:00:00Z', '2026-11-06T08:05:00Z', 'practice_staff');

INSERT INTO shipment(shipment_id, shipment_type, warehouse_id, carrier_id,
                     planned_departure_at_utc, planned_arrival_at_utc, status)
VALUES
  ('S1004', 'original', 1, 1, '2026-11-06T12:30:00Z', '2026-11-06T16:30:00Z', 'packing'),
  ('S1005', 'original', 1, 1, '2026-11-06T13:00:00Z', '2026-11-06T16:30:00Z', 'planned'),
  ('S1006-A', 'original', 3, 3, '2026-11-06T11:00:00Z', '2026-11-06T15:00:00Z', 'departed'),
  ('S1006-B', 'original', 2, 2, '2026-11-06T13:00:00Z', '2026-11-06T17:00:00Z', 'planned'),
  ('S1007', 'original', 1, 1, '2026-11-06T12:00:00Z', '2026-11-06T15:00:00Z', 'loaded'),
  ('S1008', 'original', 1, 1, '2026-11-06T09:00:00Z', '2026-11-06T11:30:00Z', 'delivered'),
  ('S1010', 'original', 3, 3, '2026-11-06T08:00:00Z', '2026-11-06T10:30:00Z', 'delivered');

INSERT INTO shipment_stop(stop_id, shipment_id, site_id, stop_sequence, planned_eta_at_utc)
VALUES
  (104, 'S1004', 1, 1, '2026-11-06T16:30:00Z'),
  (105, 'S1005', 1, 1, '2026-11-06T16:30:00Z'),
  (106, 'S1006-A', 2, 1, '2026-11-06T15:00:00Z'),
  (107, 'S1006-B', 2, 1, '2026-11-06T17:00:00Z'),
  (108, 'S1007', 1, 1, '2026-11-06T15:00:00Z'),
  (109, 'S1008', 1, 1, '2026-11-06T11:30:00Z'),
  (110, 'S1010', 2, 1, '2026-11-06T10:30:00Z');

INSERT INTO shipment_item(shipment_id, order_id, line_no, site_id, allocated_qty)
VALUES
  ('S1004', 1004, 1, 1, 12),
  ('S1005', 1005, 1, 1, 8),
  ('S1006-A', 1006, 1, 2, 24),
  ('S1006-B', 1006, 2, 2, 6),
  ('S1007', 1007, 1, 1, 10),
  ('S1008', 1008, 1, 1, 10),
  ('S1010', 1010, 1, 2, 5);

INSERT INTO warehouse_event(event_id, shipment_id, stage, occurred_at_utc,
                            recorded_at_utc, recorded_by)
VALUES
  ('WH-1004', 'S1004', 'packed', '2026-11-06T11:30:00Z', '2026-11-06T11:35:00Z', 'practice_staff'),
  ('WH-1006-A', 'S1006-A', 'departed', '2026-11-06T11:10:00Z', '2026-11-06T11:15:00Z', 'practice_staff'),
  ('WH-1006-B', 'S1006-B', 'waiting', '2026-11-06T11:20:00Z', '2026-11-06T11:25:00Z', 'practice_staff'),
  ('WH-1007-LOADED', 'S1007', 'loaded', '2026-11-06T11:40:00Z', '2026-11-06T11:45:00Z', 'practice_staff'),
  ('WH-1007-DEPARTED', 'S1007', 'departed', '2026-11-06T13:30:00Z', '2026-11-06T13:35:00Z', 'practice_staff'),
  ('WH-1008', 'S1008', 'departed', '2026-11-06T09:10:00Z', '2026-11-06T09:15:00Z', 'practice_staff'),
  ('WH-1010', 'S1010', 'departed', '2026-11-06T08:10:00Z', '2026-11-06T08:15:00Z', 'practice_staff');

INSERT INTO eta_update(update_id, stop_id, current_eta_at_utc,
                       occurred_at_utc, recorded_at_utc, recorded_by)
VALUES
  ('ETA-1006-B', 107, '2026-11-06T18:30:00Z', '2026-11-06T11:50:00Z', '2026-11-06T11:55:00Z', 'practice_coordinator'),
  ('ETA-1007-LATER', 108, '2026-11-06T17:30:00Z', '2026-11-06T13:10:00Z', '2026-11-06T13:15:00Z', 'practice_coordinator');

-- A claim exists for order 1008, but no representative has authorized replacement.
INSERT INTO handover(handover_id, stop_id, occurred_at_utc, recorded_at_utc, recorded_by)
VALUES
  ('HAND-1008', 109, '2026-11-06T11:40:00Z', '2026-11-06T11:42:00Z', 'practice_driver'),
  ('HAND-1010', 110, '2026-11-06T10:45:00Z', '2026-11-06T10:50:00Z', 'practice_driver');
INSERT INTO handover_line(handover_line_id, handover_id, shipment_id, order_id, line_no,
                          accepted_qty, damaged_qty, missing_qty)
VALUES
  (1008, 'HAND-1008', 'S1008', 1008, 1, 8, 2, 0),
  (1010, 'HAND-1010', 'S1010', 1010, 1, 5, 0, 0);
INSERT INTO claim(claim_id, order_id, opened_at_utc, recorded_at_utc, opened_by, status)
VALUES ('CLAIM-1008', 1008, '2026-11-06T11:50:00Z', '2026-11-06T11:52:00Z', 'practice_staff', 'open');
INSERT INTO claim_line(claim_line_id, claim_id, handover_line_id, reason, disputed_qty)
VALUES (1008, 'CLAIM-1008', 1008, 'damaged', 2);

INSERT INTO travel_observation(observation_id, stop_id, provider,
                               requested_departure_at_utc, travel_seconds, fetched_at_utc)
VALUES
  (1004, 104, 'practice_route', '2026-11-06T12:30:00Z', 10800, '2026-11-06T11:00:00Z'),
  (1006, 107, 'practice_route', '2026-11-06T13:00:00Z', 14400, '2026-11-06T11:30:00Z');
INSERT INTO holiday_observation(observation_id, region_id, local_date, is_holiday,
                                provider, fetched_at_utc)
VALUES
  (1004, 1, '2026-11-06', 0, 'practice_calendar', '2026-11-05T12:00:00Z'),
  (1006, 2, '2026-11-06', 0, 'practice_calendar', '2026-11-05T12:00:00Z');
INSERT INTO weather_observation(observation_id, site_id, provider, provider_run_at_utc,
                                valid_at_utc, fetched_at_utc, wind_gust_m_s,
                                precipitation_mm, thunderstorm_probability)
VALUES (1004, 1, 'practice_weather', '2026-11-06T10:00:00Z',
        '2026-11-06T16:00:00Z', '2026-11-06T11:00:00Z', 21.0, 16.0, 0.4);

COMMIT;

-- Evaluation fixture for schema_fresh.sql.
-- Apply this file only after creating a new database from schema_fresh.sql.
-- Run the agent for orders 9101 and 9102 as of 2026-11-07T12:00:00Z.
PRAGMA foreign_keys = ON;
BEGIN;

INSERT INTO planning_region (region_id, name) VALUES
    (1, 'Stockholm North'),
    (2, 'Stockholm South');

INSERT INTO management_team (team_id, name) VALUES
    (1, 'Stockholm Order Team');

INSERT INTO customer (customer_id, source_system, external_customer_id, customer_type) VALUES
    (1, 'evaluation', 'CUSTOMER-HIGH-RISK', 'B2B'),
    (2, 'evaluation', 'CUSTOMER-LOW-RISK', 'B2C');

INSERT INTO delivery_site
    (site_id, region_id, postcode, latitude, longitude, time_zone)
VALUES
    (1, 1, '111 22', 59.3326, 18.0649, 'Europe/Stockholm'),
    (2, 2, '118 20', 59.3150, 18.0340, 'Europe/Stockholm');

INSERT INTO commodity_category (category_id, name) VALUES
    (1, 'Industrial Components'),
    (2, 'Consumer Goods');

INSERT INTO product
    (product_id, category_id, source_system, external_product_id,
     name, unit, unit_weight_kg, unit_volume_m3, special_handling)
VALUES
    (1, 1, 'evaluation', 'PART-100', 'Hydraulic Control Unit', 'unit', 18.0, 0.08, 1),
    (2, 2, 'evaluation', 'ITEM-200', 'Home Storage Kit', 'unit', 4.0, 0.03, 0);

INSERT INTO warehouse (warehouse_id, name, latitude, longitude) VALUES
    (1, 'North Distribution Hub', 59.5000, 18.1000);

INSERT INTO carrier (carrier_id, name, own_fleet) VALUES
    (1, 'Nordic Freight', 0);

INSERT INTO customer_order
    (order_id, source_system, external_order_id, customer_id, category_id,
     site_id, management_team_id, created_at_utc)
VALUES
    (9101, 'evaluation', 'EVAL-9101', 1, 1, 1, 1, '2026-11-06T08:00:00Z'),
    (9102, 'evaluation', 'EVAL-9102', 2, 2, 2, 1, '2026-11-06T08:00:00Z');

INSERT INTO promise_version
    (order_id, version_no, window_start_utc, window_end_utc,
     site_time_zone, effective_at_utc, recorded_at_utc)
VALUES
    (9101, 1, '2026-11-08T11:00:00Z', '2026-11-08T12:00:00Z',
     'Europe/Stockholm', '2026-11-06T08:00:00Z', '2026-11-06T08:00:00Z'),
    (9102, 1, '2026-11-08T11:00:00Z', '2026-11-08T12:00:00Z',
     'Europe/Stockholm', '2026-11-06T08:00:00Z', '2026-11-06T08:00:00Z');

INSERT INTO order_line (order_id, line_no, category_id, product_id, ordered_qty) VALUES
    (9101, 1, 1, 1, 4),
    (9102, 1, 2, 2, 2);

INSERT INTO stock_event
    (event_id, order_id, line_no, stock_status, occurred_at_utc, recorded_at_utc, recorded_by)
VALUES
    ('STOCK-9101', 9101, 1, 'backorder', '2026-11-07T10:00:00Z', '2026-11-07T10:05:00Z', 'evaluation'),
    ('STOCK-9102', 9102, 1, 'in_stock', '2026-11-07T10:00:00Z', '2026-11-07T10:05:00Z', 'evaluation');

INSERT INTO shipment
    (shipment_id, shipment_type, warehouse_id, carrier_id,
     planned_departure_at_utc, planned_arrival_at_utc, status)
VALUES
    ('SHIP-9101', 'original', 1, 1, '2026-11-06T09:00:00Z', '2026-11-07T14:00:00Z', 'departed'),
    ('SHIP-9102', 'original', 1, 1, '2026-11-06T09:00:00Z', '2026-11-07T14:00:00Z', 'departed');

INSERT INTO shipment_stop
    (stop_id, shipment_id, site_id, stop_sequence, planned_eta_at_utc)
VALUES
    (1, 'SHIP-9101', 1, 1, '2026-11-07T14:00:00Z'),
    (2, 'SHIP-9102', 2, 1, '2026-11-07T14:00:00Z');

INSERT INTO shipment_item (shipment_id, order_id, line_no, site_id, allocated_qty) VALUES
    ('SHIP-9101', 9101, 1, 1, 4),
    ('SHIP-9102', 9102, 1, 2, 2);

INSERT INTO warehouse_event
    (event_id, shipment_id, stage, occurred_at_utc, recorded_at_utc, recorded_by)
VALUES
    ('WH-9101', 'SHIP-9101', 'departed', '2026-11-06T09:30:00Z', '2026-11-06T09:35:00Z', 'evaluation'),
    ('WH-9102', 'SHIP-9102', 'departed', '2026-11-06T09:00:00Z', '2026-11-06T09:05:00Z', 'evaluation');

INSERT INTO eta_update
    (update_id, stop_id, current_eta_at_utc, occurred_at_utc, recorded_at_utc, recorded_by)
VALUES
    ('ETA-9101', 1, '2026-11-08T10:00:00Z', '2026-11-07T11:30:00Z', '2026-11-07T11:35:00Z', 'evaluation'),
    ('ETA-9102', 2, '2026-11-07T13:00:00Z', '2026-11-07T11:30:00Z', '2026-11-07T11:35:00Z', 'evaluation');

INSERT INTO weather_observation
    (site_id, provider, valid_at_utc, fetched_at_utc, wind_gust_m_s, precipitation_mm,
     thunderstorm_probability)
VALUES
    (1, 'evaluation', '2026-11-08T12:00:00Z', '2026-11-07T11:50:00Z', 24.0, 18.0, 0.8),
    (2, 'evaluation', '2026-11-08T12:00:00Z', '2026-11-07T11:50:00Z', 3.0, 0.0, 0.0);

INSERT INTO travel_observation
    (stop_id, provider, requested_departure_at_utc, travel_seconds, fetched_at_utc)
VALUES
    (1, 'evaluation', '2026-11-07T12:00:00Z', 14400, '2026-11-07T11:50:00Z'),
    (2, 'evaluation', '2026-11-07T12:00:00Z', 7200, '2026-11-07T11:50:00Z');

INSERT INTO holiday_observation
    (region_id, local_date, is_holiday, provider, fetched_at_utc)
VALUES
    (1, '2026-11-08', 0, 'evaluation', '2026-11-07T11:50:00Z'),
    (2, '2026-11-08', 0, 'evaluation', '2026-11-07T11:50:00Z');

COMMIT;

-- Synthetic open orders for schema_fresh.sql / delivery_db.db.
-- Run once in DB Browser for SQLite. No predictions or outcomes are inserted.
-- Evaluate at 2026-11-06T12:00:00Z to replay the evidence below.

INSERT INTO planning_region(region_id, name) VALUES (1, 'Stockholm');
INSERT INTO management_team(team_id, name) VALUES (1, 'Stockholm Order Team');
INSERT INTO customer(customer_id, source_system, external_customer_id, customer_type)
VALUES (1, 'demo', 'BUILDER-1', 'B2B'),
       (2, 'demo', 'CONSUMER-1', 'B2C');
INSERT INTO delivery_site(site_id, region_id, postcode, latitude, longitude, time_zone)
VALUES (1, 1, '111 22', 59.3293, 18.0686, 'Europe/Stockholm');
INSERT INTO commodity_category(category_id, name) VALUES (1, 'Timber');
INSERT INTO product(product_id, category_id, source_system, external_product_id,
                    name, unit, unit_weight_kg, unit_volume_m3, special_handling)
VALUES (1, 1, 'demo', 'PINE-BOARD', 'Pine board', 'board', 4.0, 0.02, 0),
       (2, 1, 'demo', 'OAK-BOARD', 'Oak board', 'board', 5.0, 0.03, 0);
INSERT INTO warehouse(warehouse_id, name, latitude, longitude)
VALUES (1, 'Stockholm', 59.35, 18.0),
       (2, 'Norrkoping', 58.59, 16.18);
INSERT INTO carrier(carrier_id, name, own_fleet)
VALUES (1, 'Regional', 0),
       (2, 'North', 1);

INSERT INTO customer_order(order_id, source_system, external_order_id, customer_id,
                           category_id, site_id, management_team_id, created_at_utc)
VALUES (1001, 'demo', 'ORDER-1001', 1, 1, 1, 1, '2026-11-05T09:00:00Z'),
       (1002, 'demo', 'ORDER-1002', 2, 1, 1, 1, '2026-11-05T09:10:00Z'),
       (1003, 'demo', 'ORDER-1003', 1, 1, 1, 1, '2026-11-05T09:20:00Z');

INSERT INTO promise_version(order_id, version_no, window_start_utc, window_end_utc,
                            site_time_zone, effective_at_utc, recorded_at_utc)
VALUES (1001, 1, '2026-11-06T13:00:00Z', '2026-11-06T16:00:00Z',
        'Europe/Stockholm', '2026-11-05T09:00:00Z', '2026-11-05T09:00:00Z'),
       (1002, 1, '2026-11-06T13:00:00Z', '2026-11-06T16:00:00Z',
        'Europe/Stockholm', '2026-11-05T09:10:00Z', '2026-11-05T09:10:00Z'),
       (1003, 1, '2026-11-06T13:00:00Z', '2026-11-06T16:00:00Z',
        'Europe/Stockholm', '2026-11-05T09:20:00Z', '2026-11-05T09:20:00Z');

INSERT INTO order_line(order_id, line_no, category_id, product_id, ordered_qty)
VALUES (1001, 1, 1, 1, 20),
       (1002, 1, 1, 2, 18),
       (1003, 1, 1, 1, 30),
       (1003, 2, 1, 2, 10);

INSERT INTO stock_event(event_id, order_id, line_no, stock_status,
                        occurred_at_utc, recorded_at_utc, recorded_by)
VALUES ('STOCK-1001', 1001, 1, 'in_stock',
        '2026-11-06T07:00:00Z', '2026-11-06T07:05:00Z', 'demo_staff'),
       ('STOCK-1002', 1002, 1, 'short',
        '2026-11-06T10:00:00Z', '2026-11-06T10:05:00Z', 'demo_staff'),
       ('STOCK-1003-1', 1003, 1, 'in_stock',
        '2026-11-06T07:00:00Z', '2026-11-06T07:05:00Z', 'demo_staff'),
       ('STOCK-1003-2', 1003, 2, 'backorder',
        '2026-11-06T10:00:00Z', '2026-11-06T10:05:00Z', 'demo_staff');

INSERT INTO shipment(shipment_id, shipment_type, warehouse_id, carrier_id,
                     planned_departure_at_utc, planned_arrival_at_utc, status)
VALUES ('S1001', 'original', 1, 1, '2026-11-06T11:30:00Z',
        '2026-11-06T14:30:00Z', 'packing'),
       ('S1002', 'original', 1, 1, '2026-11-06T12:30:00Z',
        '2026-11-06T15:00:00Z', 'loaded'),
       ('S1003-A', 'original', 2, 2, '2026-11-06T11:00:00Z',
        '2026-11-06T14:00:00Z', 'departed'),
       ('S1003-B', 'original', 1, 1, '2026-11-06T12:30:00Z',
        '2026-11-06T15:00:00Z', 'packing');

INSERT INTO shipment_stop(stop_id, shipment_id, site_id, stop_sequence, planned_eta_at_utc)
VALUES (1, 'S1001', 1, 1, '2026-11-06T14:30:00Z'),
       (2, 'S1002', 1, 1, '2026-11-06T15:00:00Z'),
       (3, 'S1003-A', 1, 1, '2026-11-06T14:00:00Z'),
       (4, 'S1003-B', 1, 1, '2026-11-06T15:00:00Z');

INSERT INTO shipment_item(shipment_id, order_id, line_no, site_id, allocated_qty)
VALUES ('S1001', 1001, 1, 1, 20),
       ('S1002', 1002, 1, 1, 18),
       ('S1003-A', 1003, 1, 1, 30),
       ('S1003-B', 1003, 2, 1, 10);

INSERT INTO warehouse_event(event_id, shipment_id, stage, occurred_at_utc,
                            recorded_at_utc, recorded_by)
VALUES ('WH-1001', 'S1001', 'packed',
        '2026-11-06T11:00:00Z', '2026-11-06T11:03:00Z', 'demo_staff'),
       ('WH-1002', 'S1002', 'loaded',
        '2026-11-06T11:40:00Z', '2026-11-06T11:45:00Z', 'demo_staff'),
       ('WH-1003-A', 'S1003-A', 'departed',
        '2026-11-06T11:15:00Z', '2026-11-06T11:20:00Z', 'demo_staff'),
       ('WH-1003-B', 'S1003-B', 'pick_started',
        '2026-11-06T11:30:00Z', '2026-11-06T11:35:00Z', 'demo_staff');

INSERT INTO eta_update(update_id, stop_id, current_eta_at_utc,
                       occurred_at_utc, recorded_at_utc, recorded_by)
VALUES ('ETA-1002', 2, '2026-11-06T17:00:00Z',
        '2026-11-06T11:45:00Z', '2026-11-06T11:50:00Z', 'demo_coordinator'),
       ('ETA-1003-B', 4, '2026-11-06T17:30:00Z',
        '2026-11-06T11:50:00Z', '2026-11-06T11:55:00Z', 'demo_coordinator');

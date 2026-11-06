-- Swedish delivery risk pilot
-- Run in DB Browser for SQLite against a NEW empty database.
PRAGMA foreign_keys = ON;

CREATE TABLE planning_region (
    region_id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE management_team (
    team_id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE customer (
    customer_id INTEGER PRIMARY KEY,
    source_system TEXT NOT NULL,
    external_customer_id TEXT NOT NULL,
    customer_type TEXT NOT NULL CHECK (customer_type IN ('B2B', 'B2C')),
    UNIQUE (source_system, external_customer_id)
);

CREATE TABLE delivery_site (
    site_id INTEGER PRIMARY KEY,
    region_id INTEGER NOT NULL REFERENCES planning_region(region_id),
    postcode TEXT NOT NULL,
    latitude REAL,
    longitude REAL,
    time_zone TEXT NOT NULL,
    CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
    CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180)
);

CREATE TABLE commodity_category (
    category_id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE product (
    product_id INTEGER PRIMARY KEY,
    category_id INTEGER NOT NULL REFERENCES commodity_category(category_id),
    source_system TEXT NOT NULL,
    external_product_id TEXT NOT NULL,
    name TEXT NOT NULL,
    unit TEXT NOT NULL,
    unit_weight_kg REAL CHECK (unit_weight_kg >= 0),
    unit_volume_m3 REAL CHECK (unit_volume_m3 >= 0),
    special_handling INTEGER NOT NULL DEFAULT 0 CHECK (special_handling IN (0, 1)),
    UNIQUE (source_system, external_product_id),
    UNIQUE (product_id, category_id)
);

CREATE TABLE warehouse (
    warehouse_id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    latitude REAL,
    longitude REAL
);

CREATE TABLE carrier (
    carrier_id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    own_fleet INTEGER NOT NULL DEFAULT 0 CHECK (own_fleet IN (0, 1))
);

CREATE TABLE customer_order (
    order_id INTEGER PRIMARY KEY,
    source_system TEXT NOT NULL,
    external_order_id TEXT NOT NULL,
    customer_id INTEGER NOT NULL REFERENCES customer(customer_id),
    category_id INTEGER NOT NULL REFERENCES commodity_category(category_id),
    site_id INTEGER NOT NULL REFERENCES delivery_site(site_id),
    management_team_id INTEGER NOT NULL REFERENCES management_team(team_id),
    created_at_utc TEXT NOT NULL,
    cancelled_at_utc TEXT,
    UNIQUE (source_system, external_order_id),
    UNIQUE (order_id, category_id),
    UNIQUE (order_id, site_id)
);

CREATE TABLE promise_version (
    order_id INTEGER NOT NULL REFERENCES customer_order(order_id),
    version_no INTEGER NOT NULL CHECK (version_no > 0),
    window_start_utc TEXT NOT NULL,
    window_end_utc TEXT NOT NULL,
    site_time_zone TEXT NOT NULL,
    effective_at_utc TEXT NOT NULL,
    recorded_at_utc TEXT NOT NULL,
    PRIMARY KEY (order_id, version_no),
    CHECK (window_start_utc < window_end_utc)
);

CREATE TABLE order_line (
    order_id INTEGER NOT NULL,
    line_no INTEGER NOT NULL CHECK (line_no > 0),
    category_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    ordered_qty REAL NOT NULL CHECK (ordered_qty > 0),
    PRIMARY KEY (order_id, line_no),
    FOREIGN KEY (order_id, category_id) REFERENCES customer_order(order_id, category_id),
    FOREIGN KEY (product_id, category_id) REFERENCES product(product_id, category_id)
);

CREATE TABLE stock_event (
    event_id TEXT PRIMARY KEY,
    order_id INTEGER NOT NULL,
    line_no INTEGER NOT NULL,
    stock_status TEXT NOT NULL CHECK (stock_status IN ('in_stock', 'short', 'backorder')),
    occurred_at_utc TEXT NOT NULL,
    recorded_at_utc TEXT NOT NULL,
    recorded_by TEXT NOT NULL,
    FOREIGN KEY (order_id, line_no) REFERENCES order_line(order_id, line_no)
);

CREATE TABLE shipment (
    shipment_id TEXT PRIMARY KEY,
    shipment_type TEXT NOT NULL CHECK (shipment_type IN ('original', 'replacement')),
    warehouse_id INTEGER NOT NULL REFERENCES warehouse(warehouse_id),
    carrier_id INTEGER REFERENCES carrier(carrier_id),
    planned_departure_at_utc TEXT,
    planned_arrival_at_utc TEXT,
    vehicle_type TEXT,
    vehicle_capacity_kg REAL CHECK (vehicle_capacity_kg > 0),
    status TEXT NOT NULL DEFAULT 'planned'
        CHECK (status IN ('planned', 'packing', 'loaded', 'departed', 'delivered', 'cancelled'))
);

-- A physical shipment can visit multiple sites. ETA belongs to a stop.
CREATE TABLE shipment_stop (
    stop_id INTEGER PRIMARY KEY,
    shipment_id TEXT NOT NULL REFERENCES shipment(shipment_id),
    site_id INTEGER NOT NULL REFERENCES delivery_site(site_id),
    stop_sequence INTEGER NOT NULL CHECK (stop_sequence > 0),
    planned_eta_at_utc TEXT,
    UNIQUE (shipment_id, site_id),
    UNIQUE (shipment_id, stop_sequence),
    UNIQUE (stop_id, shipment_id, site_id)
);

CREATE TABLE claim (
    claim_id TEXT PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES customer_order(order_id),
    opened_at_utc TEXT NOT NULL,
    recorded_at_utc TEXT NOT NULL,
    opened_by TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('open', 'approved', 'declined', 'closed')),
    UNIQUE (claim_id, order_id)
);

CREATE TABLE inspection (
    inspection_id TEXT PRIMARY KEY,
    claim_id TEXT NOT NULL REFERENCES claim(claim_id),
    representative_id TEXT NOT NULL,
    finding TEXT NOT NULL,
    decision TEXT NOT NULL CHECK (decision IN ('approved', 'declined')),
    decided_at_utc TEXT NOT NULL,
    recorded_at_utc TEXT NOT NULL,
    UNIQUE (inspection_id, claim_id, decision)
);

CREATE TABLE shipment_item (
    shipment_id TEXT NOT NULL REFERENCES shipment(shipment_id),
    order_id INTEGER NOT NULL,
    line_no INTEGER NOT NULL,
    site_id INTEGER NOT NULL,
    allocated_qty REAL NOT NULL CHECK (allocated_qty > 0),
    authorization_line_id TEXT,
    PRIMARY KEY (shipment_id, order_id, line_no),
    FOREIGN KEY (order_id, line_no) REFERENCES order_line(order_id, line_no),
    FOREIGN KEY (order_id, site_id) REFERENCES customer_order(order_id, site_id),
    FOREIGN KEY (shipment_id, site_id) REFERENCES shipment_stop(shipment_id, site_id),
    FOREIGN KEY (authorization_line_id) REFERENCES authorization_line(authorization_line_id)
);

CREATE TABLE warehouse_event (
    event_id TEXT PRIMARY KEY,
    shipment_id TEXT NOT NULL REFERENCES shipment(shipment_id),
    stage TEXT NOT NULL CHECK (
        stage IN ('waiting', 'pick_started', 'packed', 'loaded', 'departed')
    ),
    occurred_at_utc TEXT NOT NULL,
    recorded_at_utc TEXT NOT NULL,
    recorded_by TEXT NOT NULL
);

CREATE TABLE eta_update (
    update_id TEXT PRIMARY KEY,
    stop_id INTEGER NOT NULL REFERENCES shipment_stop(stop_id),
    current_eta_at_utc TEXT NOT NULL,
    occurred_at_utc TEXT NOT NULL,
    recorded_at_utc TEXT NOT NULL,
    recorded_by TEXT NOT NULL
);

CREATE TABLE handover (
    handover_id TEXT PRIMARY KEY,
    stop_id INTEGER NOT NULL REFERENCES shipment_stop(stop_id),
    occurred_at_utc TEXT NOT NULL,
    recorded_at_utc TEXT NOT NULL,
    recorded_by TEXT NOT NULL
);

CREATE TABLE handover_line (
    handover_line_id INTEGER PRIMARY KEY,
    handover_id TEXT NOT NULL REFERENCES handover(handover_id),
    shipment_id TEXT NOT NULL,
    order_id INTEGER NOT NULL,
    line_no INTEGER NOT NULL,
    accepted_qty REAL NOT NULL DEFAULT 0 CHECK (accepted_qty >= 0),
    damaged_qty REAL NOT NULL DEFAULT 0 CHECK (damaged_qty >= 0),
    missing_qty REAL NOT NULL DEFAULT 0 CHECK (missing_qty >= 0),
    UNIQUE (handover_id, shipment_id, order_id, line_no),
    FOREIGN KEY (shipment_id, order_id, line_no)
        REFERENCES shipment_item(shipment_id, order_id, line_no)
);

CREATE TABLE claim_line (
    claim_line_id INTEGER PRIMARY KEY,
    claim_id TEXT NOT NULL REFERENCES claim(claim_id),
    handover_line_id INTEGER NOT NULL REFERENCES handover_line(handover_line_id),
    reason TEXT NOT NULL CHECK (reason IN ('damaged', 'missing')),
    disputed_qty REAL NOT NULL CHECK (disputed_qty > 0),
    UNIQUE (claim_id, handover_line_id, reason)
);

CREATE TABLE authorization_line (
    authorization_line_id TEXT PRIMARY KEY,
    inspection_id TEXT NOT NULL,
    claim_id TEXT NOT NULL,
    decision TEXT NOT NULL DEFAULT 'approved' CHECK (decision = 'approved'),
    claim_line_id INTEGER NOT NULL REFERENCES claim_line(claim_line_id),
    approved_qty REAL NOT NULL CHECK (approved_qty > 0),
    UNIQUE (inspection_id, claim_line_id),
    FOREIGN KEY (inspection_id, claim_id, decision)
        REFERENCES inspection(inspection_id, claim_id, decision)
);

CREATE TABLE redelivery_task (
    authorization_line_id TEXT PRIMARY KEY REFERENCES authorization_line(authorization_line_id),
    management_team_id INTEGER NOT NULL REFERENCES management_team(team_id),
    created_at_utc TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('urgent', 'in_progress', 'done'))
);

CREATE TABLE replacement_promise (
    shipment_id TEXT NOT NULL REFERENCES shipment(shipment_id),
    version_no INTEGER NOT NULL CHECK (version_no > 0),
    window_start_utc TEXT NOT NULL,
    window_end_utc TEXT NOT NULL,
    site_time_zone TEXT NOT NULL,
    confirmed_by TEXT NOT NULL,
    confirmed_at_utc TEXT NOT NULL,
    PRIMARY KEY (shipment_id, version_no),
    CHECK (window_start_utc < window_end_utc)
);

-- API responses are recorded before they become snapshot features.
CREATE TABLE weather_observation (
    observation_id INTEGER PRIMARY KEY,
    site_id INTEGER NOT NULL REFERENCES delivery_site(site_id),
    provider TEXT NOT NULL,
    provider_run_at_utc TEXT,
    valid_at_utc TEXT NOT NULL,
    fetched_at_utc TEXT NOT NULL,
    wind_gust_m_s REAL,
    precipitation_mm REAL,
    thunderstorm_probability REAL
);

CREATE TABLE travel_observation (
    observation_id INTEGER PRIMARY KEY,
    stop_id INTEGER NOT NULL REFERENCES shipment_stop(stop_id),
    provider TEXT NOT NULL,
    requested_departure_at_utc TEXT,
    travel_seconds INTEGER NOT NULL CHECK (travel_seconds >= 0),
    fetched_at_utc TEXT NOT NULL
);

CREATE TABLE holiday_observation (
    observation_id INTEGER PRIMARY KEY,
    region_id INTEGER NOT NULL REFERENCES planning_region(region_id),
    local_date TEXT NOT NULL,
    is_holiday INTEGER NOT NULL CHECK (is_holiday IN (0, 1)),
    provider TEXT NOT NULL,
    fetched_at_utc TEXT NOT NULL
);

-- One row per order and scoring time. NULL means unknown at that time.
CREATE TABLE order_snapshot (
    snapshot_id TEXT PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES customer_order(order_id),
    promise_version_no INTEGER NOT NULL,
    as_of_utc TEXT NOT NULL,
    feature_schema_version TEXT NOT NULL,
    promised_to_utc TEXT NOT NULL,
    hours_to_deadline REAL NOT NULL,
    customer_type TEXT,
    item_count INTEGER,
    item_quantity REAL,
    weight_kg REAL,
    volume_m3 REAL,
    special_handling INTEGER CHECK (special_handling IN (0, 1)),
    stock_status TEXT,
    warehouse_stage TEXT,
    planned_departure_at_utc TEXT,
    actual_departure_delay_minutes REAL,
    planned_eta_at_utc TEXT,
    current_eta_at_utc TEXT,
    eta_delay_minutes REAL,
    travel_hours REAL,
    region_name TEXT,
    warehouse_name TEXT,
    carrier_name TEXT,
    weather_severity INTEGER CHECK (weather_severity BETWEEN 0 AND 2),
    holiday_flag INTEGER CHECK (holiday_flag IN (0, 1)),
    UNIQUE (order_id, as_of_utc),
    FOREIGN KEY (order_id, promise_version_no)
        REFERENCES promise_version(order_id, version_no)
);

CREATE TABLE risk_score (
    score_id INTEGER PRIMARY KEY,
    snapshot_id TEXT NOT NULL REFERENCES order_snapshot(snapshot_id),
    model_version TEXT NOT NULL,
    scored_at_utc TEXT NOT NULL,
    p_late REAL NOT NULL CHECK (p_late BETWEEN 0 AND 1),
    reason_codes_json TEXT NOT NULL DEFAULT '[]',
    UNIQUE (snapshot_id, model_version)
);

CREATE TABLE original_delivery_outcome (
    order_id INTEGER PRIMARY KEY REFERENCES customer_order(order_id),
    original_completed_at_utc TEXT,
    label_status TEXT NOT NULL CHECK (label_status IN ('known', 'unknown')),
    original_late INTEGER CHECK (original_late IN (0, 1)),
    evaluated_at_utc TEXT NOT NULL,
    CHECK ((label_status = 'known' AND original_late IS NOT NULL)
        OR (label_status = 'unknown' AND original_late IS NULL))
);

CREATE TABLE training_assignment (
    experiment_id TEXT NOT NULL,
    order_id INTEGER NOT NULL REFERENCES customer_order(order_id),
    split TEXT NOT NULL CHECK (split IN ('train', 'validation', 'test')),
    PRIMARY KEY (experiment_id, order_id)
);

CREATE TABLE shift_list (
    shift_id TEXT PRIMARY KEY,
    region_id INTEGER NOT NULL REFERENCES planning_region(region_id),
    started_at_utc TEXT NOT NULL,
    review_capacity INTEGER NOT NULL CHECK (review_capacity > 0)
);

CREATE TABLE shift_candidate (
    shift_id TEXT NOT NULL REFERENCES shift_list(shift_id),
    order_id INTEGER NOT NULL REFERENCES customer_order(order_id),
    score_id INTEGER NOT NULL REFERENCES risk_score(score_id),
    rank_at_start INTEGER NOT NULL CHECK (rank_at_start > 0),
    selected_for_review INTEGER NOT NULL CHECK (selected_for_review IN (0, 1)),
    PRIMARY KEY (shift_id, order_id),
    UNIQUE (shift_id, rank_at_start)
);

CREATE INDEX stock_asof ON stock_event(order_id, line_no, recorded_at_utc);
CREATE INDEX warehouse_asof ON warehouse_event(shipment_id, recorded_at_utc);
CREATE INDEX eta_asof ON eta_update(stop_id, recorded_at_utc);
CREATE INDEX weather_asof ON weather_observation(site_id, valid_at_utc, fetched_at_utc);
CREATE INDEX travel_asof ON travel_observation(stop_id, fetched_at_utc);
CREATE INDEX holiday_asof ON holiday_observation(region_id, local_date, fetched_at_utc);
CREATE INDEX snapshot_order_time ON order_snapshot(order_id, as_of_utc);

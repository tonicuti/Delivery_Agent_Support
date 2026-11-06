-- Agent-owned history extends the existing business tables.
ALTER TABLE delivery_site ADD COLUMN country_code TEXT
    CHECK (country_code IS NULL OR length(country_code) = 2);

CREATE TABLE external_evidence (
    evidence_id TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('weather', 'holiday')),
    request_scope_json TEXT NOT NULL,
    fetched_at_utc TEXT NOT NULL,
    coverage_start_utc TEXT,
    coverage_end_utc TEXT,
    response_json TEXT,
    validation_status TEXT NOT NULL CHECK (validation_status IN ('valid', 'invalid', 'failed')),
    error_message TEXT
);
CREATE INDEX external_evidence_scope ON external_evidence(kind, provider, fetched_at_utc);

CREATE TABLE model_input_snapshot (
    snapshot_id TEXT PRIMARY KEY REFERENCES order_snapshot(snapshot_id),
    feature_values_json TEXT NOT NULL,
    missing_json TEXT NOT NULL,
    source_refs_json TEXT NOT NULL,
    limitations_json TEXT NOT NULL,
    saved_at_utc TEXT NOT NULL
);

CREATE TABLE agent_run (
    run_id TEXT PRIMARY KEY,
    trigger_id TEXT UNIQUE,
    order_id INTEGER NOT NULL REFERENCES customer_order(order_id),
    decision_time_utc TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'ineligible', 'failed')),
    eligibility_reason TEXT,
    score_id INTEGER REFERENCES risk_score(score_id),
    next_due_at_utc TEXT,
    error_message TEXT,
    created_at_utc TEXT NOT NULL
);
CREATE INDEX agent_run_order_time ON agent_run(order_id, decision_time_utc);

CREATE TABLE risk_episode (
    episode_id TEXT PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES customer_order(order_id),
    opened_at_utc TEXT NOT NULL,
    closed_at_utc TEXT,
    opening_score_id INTEGER NOT NULL REFERENCES risk_score(score_id),
    latest_score_id INTEGER NOT NULL REFERENCES risk_score(score_id),
    CHECK (closed_at_utc IS NULL OR closed_at_utc >= opened_at_utc)
);
CREATE UNIQUE INDEX one_active_episode_per_order ON risk_episode(order_id)
    WHERE closed_at_utc IS NULL;

CREATE TABLE worklist_item (
    order_id INTEGER PRIMARY KEY REFERENCES customer_order(order_id),
    episode_id TEXT NOT NULL REFERENCES risk_episode(episode_id),
    latest_score_id INTEGER NOT NULL REFERENCES risk_score(score_id),
    status TEXT NOT NULL CHECK (status IN ('active', 'closed')),
    updated_at_utc TEXT NOT NULL
);

CREATE TABLE agent_recommendation (
    recommendation_id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL UNIQUE REFERENCES agent_run(run_id),
    score_id INTEGER NOT NULL REFERENCES risk_score(score_id),
    action_id TEXT,
    output_json TEXT,
    validation_status TEXT NOT NULL CHECK (validation_status IN ('valid', 'invalid', 'unavailable')),
    created_at_utc TEXT NOT NULL
);

CREATE TABLE simulated_notification (
    notification_id TEXT PRIMARY KEY,
    episode_id TEXT NOT NULL REFERENCES risk_episode(episode_id),
    recommendation_id TEXT REFERENCES agent_recommendation(recommendation_id),
    kind TEXT NOT NULL CHECK (kind IN ('initial', 'follow_up')),
    payload_json TEXT NOT NULL,
    created_at_utc TEXT NOT NULL,
    acknowledged_at_utc TEXT
);
CREATE UNIQUE INDEX one_initial_per_episode ON simulated_notification(episode_id)
    WHERE kind = 'initial';

CREATE TABLE planner_feedback (
    feedback_id TEXT PRIMARY KEY,
    recommendation_id TEXT NOT NULL REFERENCES agent_recommendation(recommendation_id),
    chosen_action_id TEXT,
    notes TEXT,
    recorded_by TEXT NOT NULL,
    recorded_at_utc TEXT NOT NULL
);

CREATE TABLE schedule_state (
    order_id INTEGER PRIMARY KEY REFERENCES customer_order(order_id),
    next_due_at_utc TEXT,
    last_trigger_id TEXT,
    updated_at_utc TEXT NOT NULL
);

CREATE TABLE source_trigger (
    trigger_id TEXT PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES customer_order(order_id),
    kind TEXT NOT NULL,
    available_at_utc TEXT NOT NULL,
    lease_until_utc TEXT,
    processed_run_id TEXT UNIQUE REFERENCES agent_run(run_id)
);

CREATE TABLE order_lifecycle_event (
    event_id TEXT PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES customer_order(order_id),
    event_type TEXT NOT NULL CHECK (event_type IN ('created', 'cancelled', 'delivered')),
    occurred_at_utc TEXT NOT NULL,
    recorded_at_utc TEXT NOT NULL
);
CREATE INDEX lifecycle_order_visible ON order_lifecycle_event(order_id, recorded_at_utc);

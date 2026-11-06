-- =====================================================================
-- smartBed database schema v2 (PostgreSQL 14+)
--
-- Revised from docs/sql/schema.txt. See database/SCHEMA_REVIEW.md for
-- what changed and why. Summary:
--   * the person in the bed (resident) is separate from the people who
--     log in to watch over them (users), linked through bed_access
--   * readings are tagged with their measurement type, so one physical
--     sensor (DHT22) can report temperature AND humidity
--   * FSR402 and LDR values are stored as raw ADC counts (0-1023), not
--     kg / lux, because that is what the hardware actually produces
--   * per-bed thresholds, alarms, bed exits, sleep sessions, actuator
--     state changes and alerts now have tables
--
-- Create:  createdb smartbed && psql -d smartbed -f database/schema.sql
-- Demo:    psql -d smartbed -f database/seed_demo.sql
-- =====================================================================

DROP VIEW  IF EXISTS bed_latest_snapshot;
DROP TABLE IF EXISTS alerts, actuator_events, bed_exits, sleep_sessions,
                     alarms, bed_settings, readings, devices,
                     measurement_types, contacts, bed_access, beds,
                     residents, users CASCADE;

-- ---------------------------------------------------------------------
-- users: caretakers, relatives and care staff who log in
-- ---------------------------------------------------------------------
CREATE TABLE users (
    user_id        SERIAL        PRIMARY KEY,
    email          VARCHAR(255)  NOT NULL,
    password_hash  VARCHAR(255)  NOT NULL,
    display_name   VARCHAR(100)  NOT NULL,
    created_at     TIMESTAMPTZ   NOT NULL DEFAULT now()
);
-- Case-insensitive uniqueness: Maureen@x.ie and maureen@x.ie are one login
CREATE UNIQUE INDEX ux_users_email ON users (lower(email));

-- ---------------------------------------------------------------------
-- residents: the person who sleeps in the bed (may never log in)
-- ---------------------------------------------------------------------
CREATE TABLE residents (
    resident_id    SERIAL        PRIMARY KEY,
    display_name   VARCHAR(100)  NOT NULL,
    room           VARCHAR(50),
    support_tier   SMALLINT      NOT NULL DEFAULT 1 CHECK (support_tier BETWEEN 1 AND 4),
    tier_score     SMALLINT      CHECK (tier_score BETWEEN 0 AND 15),
    alert_style    VARCHAR(20)   NOT NULL DEFAULT 'visual_audible'
                   CHECK (alert_style IN ('visual', 'audible', 'visual_audible')),
    created_at     TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- beds: one physical smartBed, optionally assigned to a resident
-- ---------------------------------------------------------------------
CREATE TABLE beds (
    bed_id       SERIAL        PRIMARY KEY,
    resident_id  INT           REFERENCES residents(resident_id) ON DELETE SET NULL,
    name         VARCHAR(100)  NOT NULL DEFAULT 'My bed',
    timezone     VARCHAR(64)   NOT NULL DEFAULT 'Europe/Dublin',
    created_at   TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- bed_access: who may see / manage which bed, and in what role
-- (replaces the single "user owns bed" link)
-- ---------------------------------------------------------------------
CREATE TABLE bed_access (
    user_id     INT          NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    bed_id      INT          NOT NULL REFERENCES beds(bed_id)   ON DELETE CASCADE,
    role        VARCHAR(20)  NOT NULL CHECK (role IN ('self', 'family', 'care_staff', 'admin')),
    granted_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, bed_id)
);

-- ---------------------------------------------------------------------
-- contacts: next of kin / named contacts, with recorded consent
-- ---------------------------------------------------------------------
CREATE TABLE contacts (
    contact_id            SERIAL        PRIMARY KEY,
    resident_id           INT           NOT NULL REFERENCES residents(resident_id) ON DELETE CASCADE,
    name                  VARCHAR(100)  NOT NULL,
    relationship          VARCHAR(50),
    phone                 VARCHAR(30),
    priority              SMALLINT      NOT NULL DEFAULT 1,
    consent_confirmed_at  TIMESTAMPTZ   -- NULL = must not be notified
);

-- ---------------------------------------------------------------------
-- measurement_types: KINDS of value (unchanged idea, corrected units)
-- ---------------------------------------------------------------------
CREATE TABLE measurement_types (
    measurement_type_id  SERIAL       PRIMARY KEY,
    name                 VARCHAR(50)  NOT NULL UNIQUE,
    unit                 VARCHAR(20),
    value_kind           VARCHAR(10)  NOT NULL DEFAULT 'number'
                         CHECK (value_kind IN ('number', 'raw_adc', 'on_off'))
);

-- ---------------------------------------------------------------------
-- devices: one physical component fitted to one bed
-- ---------------------------------------------------------------------
CREATE TABLE devices (
    device_id      SERIAL        PRIMARY KEY,
    bed_id         INT           NOT NULL REFERENCES beds(bed_id) ON DELETE CASCADE,
    hardware_uid   VARCHAR(64)   NOT NULL UNIQUE,  -- e.g. '<pi-serial>:fsr0'; how PubNub messages are matched
    model          VARCHAR(30)   NOT NULL
                   CHECK (model IN ('FSR402', 'DHT22', 'LDR', 'buzzer', 'heater_led', 'status_led')),
    kind           VARCHAR(10)   NOT NULL CHECK (kind IN ('sensor', 'actuator')),
    label          VARCHAR(100),                   -- e.g. 'Left side pressure pad'
    adc_channel    SMALLINT      CHECK (adc_channel BETWEEN 0 AND 7),     -- MCP3008 input
    gpio_pin       SMALLINT,
    -- calibration: FSR occupied when raw >= threshold; LDR may read inverted
    occupancy_threshold  SMALLINT CHECK (occupancy_threshold BETWEEN 0 AND 1023),
    inverted       BOOLEAN       NOT NULL DEFAULT FALSE,
    is_active      BOOLEAN       NOT NULL DEFAULT TRUE,
    installed_at   TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX ix_devices_bed ON devices (bed_id);

-- ---------------------------------------------------------------------
-- readings: every value a sensor reports
-- ---------------------------------------------------------------------
CREATE TABLE readings (
    reading_id           BIGSERIAL      PRIMARY KEY,
    device_id            INT            NOT NULL REFERENCES devices(device_id) ON DELETE CASCADE,
    measurement_type_id  INT            NOT NULL REFERENCES measurement_types(measurement_type_id),
    value                NUMERIC(10,2)  NOT NULL,
    recorded_at          TIMESTAMPTZ    NOT NULL,              -- when the Pi took it
    received_at          TIMESTAMPTZ    NOT NULL DEFAULT now(), -- when the server got it
    -- PubNub can redeliver: the same sample must not be stored twice
    UNIQUE (device_id, measurement_type_id, recorded_at)
);
CREATE INDEX ix_readings_device_type_time
    ON readings (device_id, measurement_type_id, recorded_at DESC);

-- ---------------------------------------------------------------------
-- bed_settings: thresholds and goals, one row per bed
-- ---------------------------------------------------------------------
CREATE TABLE bed_settings (
    bed_id                   INT           PRIMARY KEY REFERENCES beds(bed_id) ON DELETE CASCADE,
    heating_enabled          BOOLEAN       NOT NULL DEFAULT TRUE,
    target_temperature_c     NUMERIC(4,1)  NOT NULL DEFAULT 21.0 CHECK (target_temperature_c BETWEEN 15 AND 30),
    low_temperature_c        NUMERIC(4,1)  NOT NULL DEFAULT 18.0,
    high_temperature_c       NUMERIC(4,1)  NOT NULL DEFAULT 26.0,
    humidity_limit_percent   SMALLINT      NOT NULL DEFAULT 70 CHECK (humidity_limit_percent BETWEEN 0 AND 100),
    light_warning_threshold  SMALLINT      NOT NULL DEFAULT 800 CHECK (light_warning_threshold BETWEEN 0 AND 1023),
    exit_grace_minutes       SMALLINT      NOT NULL DEFAULT 20 CHECK (exit_grace_minutes BETWEEN 0 AND 240),
    night_starts             TIME          NOT NULL DEFAULT '21:00',
    night_ends               TIME          NOT NULL DEFAULT '07:00',
    sleep_goal_minutes       SMALLINT      NOT NULL DEFAULT 450,
    target_bedtime           TIME          NOT NULL DEFAULT '22:30',
    updated_at               TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_by               INT           REFERENCES users(user_id) ON DELETE SET NULL,
    CHECK (low_temperature_c < high_temperature_c)
);

-- ---------------------------------------------------------------------
-- alarms: wake-up alarms played on the bed's buzzer
-- ---------------------------------------------------------------------
CREATE TABLE alarms (
    alarm_id             SERIAL       PRIMARY KEY,
    bed_id               INT          NOT NULL REFERENCES beds(bed_id) ON DELETE CASCADE,
    alarm_time           TIME         NOT NULL,             -- local to beds.timezone
    label                VARCHAR(80)  NOT NULL DEFAULT 'Wake up',
    enabled              BOOLEAN      NOT NULL DEFAULT TRUE,
    snooze_minutes       SMALLINT     NOT NULL DEFAULT 5 CHECK (snooze_minutes BETWEEN 1 AND 30),
    last_triggered_date  DATE,
    snoozed_until        TIMESTAMPTZ
);

-- ---------------------------------------------------------------------
-- sleep_sessions: in-bed periods for a night (feeds the sleep history)
-- ---------------------------------------------------------------------
CREATE TABLE sleep_sessions (
    sleep_session_id  BIGSERIAL    PRIMARY KEY,
    bed_id            INT          NOT NULL REFERENCES beds(bed_id) ON DELETE CASCADE,
    started_at        TIMESTAMPTZ  NOT NULL,
    ended_at          TIMESTAMPTZ,
    bed_exit_count    SMALLINT     NOT NULL DEFAULT 0,
    avg_temperature_c NUMERIC(4,1),
    CHECK (ended_at IS NULL OR ended_at >= started_at)
);
CREATE INDEX ix_sleep_sessions_bed_time ON sleep_sessions (bed_id, started_at DESC);
-- At most one open session per bed
CREATE UNIQUE INDEX ux_sleep_sessions_open ON sleep_sessions (bed_id) WHERE ended_at IS NULL;

-- ---------------------------------------------------------------------
-- bed_exits: each time the bed empties at night; drives "no return" alerts
-- ---------------------------------------------------------------------
CREATE TABLE bed_exits (
    bed_exit_id       BIGSERIAL    PRIMARY KEY,
    bed_id            INT          NOT NULL REFERENCES beds(bed_id) ON DELETE CASCADE,
    sleep_session_id  BIGINT       REFERENCES sleep_sessions(sleep_session_id) ON DELETE SET NULL,
    left_at           TIMESTAMPTZ  NOT NULL,
    returned_at       TIMESTAMPTZ,
    CHECK (returned_at IS NULL OR returned_at >= left_at)
);
CREATE INDEX ix_bed_exits_open ON bed_exits (bed_id) WHERE returned_at IS NULL;

-- ---------------------------------------------------------------------
-- actuator_events: heater / buzzer / LED switched on or off, and why
-- (kept out of readings: these are decisions, not measurements)
-- ---------------------------------------------------------------------
CREATE TABLE actuator_events (
    actuator_event_id  BIGSERIAL    PRIMARY KEY,
    device_id          INT          NOT NULL REFERENCES devices(device_id) ON DELETE CASCADE,
    is_on              BOOLEAN      NOT NULL,
    reason             VARCHAR(30)  NOT NULL
                       CHECK (reason IN ('auto_heating', 'boost', 'alarm', 'bed_exit', 'light_warning', 'manual')),
    changed_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
    acknowledged_at    TIMESTAMPTZ  -- set when the Pi confirms it actually switched
);
CREATE INDEX ix_actuator_events_device_time ON actuator_events (device_id, changed_at DESC);

-- ---------------------------------------------------------------------
-- alerts: things a person must look at, with an audit trail
-- ---------------------------------------------------------------------
CREATE TABLE alerts (
    alert_id         BIGSERIAL     PRIMARY KEY,
    bed_id           INT           NOT NULL REFERENCES beds(bed_id) ON DELETE CASCADE,
    bed_exit_id      BIGINT        REFERENCES bed_exits(bed_exit_id) ON DELETE SET NULL,
    alert_type       VARCHAR(30)   NOT NULL
                     CHECK (alert_type IN ('bed_exit_no_return', 'long_stay_in_bed', 'temperature_low',
                                           'temperature_high', 'humidity_high', 'light', 'sensor_offline')),
    severity         VARCHAR(10)   NOT NULL DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'critical')),
    message          TEXT          NOT NULL,
    created_at       TIMESTAMPTZ   NOT NULL DEFAULT now(),
    acknowledged_at  TIMESTAMPTZ,
    acknowledged_by  INT           REFERENCES users(user_id) ON DELETE SET NULL,
    resolved_at      TIMESTAMPTZ,
    resolved_by      INT           REFERENCES users(user_id) ON DELETE SET NULL,
    resolution_note  TEXT,
    CHECK (resolved_at IS NULL OR resolved_at >= created_at)
);
CREATE INDEX ix_alerts_open ON alerts (bed_id, created_at DESC) WHERE resolved_at IS NULL;

-- ---------------------------------------------------------------------
-- bed_latest_snapshot: one row per bed with the newest value of each
-- measurement, so the dashboard does not have to pivot readings itself
-- ---------------------------------------------------------------------
CREATE VIEW bed_latest_snapshot AS
SELECT b.bed_id,
       max(r.recorded_at)                                                     AS last_reading_at,
       bool_or(mt.name = 'pressure' AND r.value >= d.occupancy_threshold)     AS occupied,
       max(r.value) FILTER (WHERE mt.name = 'pressure')                        AS pressure_raw,
       max(r.value) FILTER (WHERE mt.name = 'temperature')                     AS temperature_c,
       max(r.value) FILTER (WHERE mt.name = 'humidity')                        AS humidity_percent,
       max(r.value) FILTER (WHERE mt.name = 'light')                           AS light_raw
FROM beds b
JOIN devices d ON d.bed_id = b.bed_id AND d.is_active
JOIN LATERAL (
    SELECT DISTINCT ON (measurement_type_id) measurement_type_id, value, recorded_at
    FROM readings
    WHERE device_id = d.device_id
    ORDER BY measurement_type_id, recorded_at DESC
) r ON TRUE
JOIN measurement_types mt ON mt.measurement_type_id = r.measurement_type_id
GROUP BY b.bed_id;

-- =====================================================================
-- Measurement types for the pitch-deck hardware
-- =====================================================================
INSERT INTO measurement_types (name, unit, value_kind) VALUES
    ('pressure',    'adc', 'raw_adc'),  -- FSR402 via MCP3008, 0-1023; occupancy = raw >= device threshold
    ('temperature', '°C',  'number'),   -- DHT22
    ('humidity',    '%',   'number'),   -- DHT22
    ('light',       'adc', 'raw_adc');  -- LDR via MCP3008, 0-1023 (relative, not lux)

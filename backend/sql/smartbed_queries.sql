-- SmartBed database queries 
-- Based on the existing Flask-SQLAlchemy models in backend/smartbed/__init__.py.
-- CURRENT TABLES (Flask creates): reading, preference, alarm (singular).
-- PLANNED TABLES (not yet in Flask): sleep_session, alert.
-- PostgreSQL will require adapting AUTOINCREMENT, datetime handling and types.
-- IMPORTANT: Section A creates only the TWO planned tables. It does not add API routes.
-- Execute against a backup/development DB, not production.

-- ================================================================
-- A. PLANNED SCHEMA EXTENSIONS
-- ================================================================
CREATE TABLE IF NOT EXISTS sleep_session (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    started_at DATETIME NOT NULL,
    ended_at DATETIME,
    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'completed')),
    CHECK (ended_at IS NULL OR ended_at >= started_at),
    CHECK ((status = 'active' AND ended_at IS NULL)
        OR (status = 'completed' AND ended_at IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS alert (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reading_id INTEGER,
    alert_type TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resolved_at DATETIME,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
    CHECK ((status = 'open' AND resolved_at IS NULL)
        OR (status = 'resolved' AND resolved_at IS NOT NULL)),
    FOREIGN KEY (reading_id) REFERENCES reading(id)
);
CREATE INDEX IF NOT EXISTS ix_sleep_session_started_at ON sleep_session(started_at);
CREATE INDEX IF NOT EXISTS ix_alert_status ON alert(status);

-- ================================================================
-- B. READINGS — existing 'reading' table, API: /api/readings
-- ================================================================
-- Latest reading:
SELECT id, recorded_at, occupied, temperature_c, humidity_percent,
       light_level, heating_led_on, light_warning
FROM reading ORDER BY id DESC LIMIT 1;

-- Latest 50 readings (history):
SELECT id, recorded_at, occupied, temperature_c, humidity_percent,
       light_level, heating_led_on, light_warning
FROM reading ORDER BY id DESC LIMIT 50;

-- Latest 24h summary; timestamps stored in UTC (ISO string format):
SELECT COUNT(*) AS reading_count,
       ROUND(AVG(temperature_c), 2) AS avg_temperature_c,
       ROUND(AVG(humidity_percent), 2) AS avg_humidity_percent,
       SUM(CASE WHEN occupied = 1 THEN 1 ELSE 0 END) AS occupied_samples
FROM reading WHERE recorded_at >= datetime('now', '-1 day');

-- Example INSERT for local SQL-only testing; actual API calculates the two flags.
-- INSERT INTO reading (recorded_at, occupied, temperature_c, humidity_percent,
--                      light_level, heating_led_on, light_warning)
-- VALUES (CURRENT_TIMESTAMP, 1, 19.5, 55.0, 420, 1, 0);

-- ================================================================
-- C. SLEEP SESSIONS — planned feature; NO API endpoint yet
-- ================================================================
-- Start a sleep session (typically when occupancy changes from 0 to 1):
-- INSERT INTO sleep_session (started_at, status)
-- VALUES (CURRENT_TIMESTAMP, 'active');

-- Close a specific session (use parameter binding from Python):
-- UPDATE sleep_session SET ended_at = CURRENT_TIMESTAMP, status = 'completed'
-- WHERE id = :session_id AND status = 'active';

-- Recent sessions:
SELECT id, started_at, ended_at, status,
       CASE WHEN ended_at IS NOT NULL
            THEN ROUND((julianday(ended_at) - julianday(started_at)) * 24 * 60, 1)
       END AS duration_minutes
FROM sleep_session ORDER BY started_at DESC LIMIT 20;

-- ================================================================
-- D. ALERTS — planned feature; separate from scheduled 'alarm' table
-- ================================================================
-- Create an alert for a light warning or another monitored condition:
-- INSERT INTO alert (reading_id, alert_type, message)
-- VALUES (:reading_id, 'light', 'Ambient light exceeds configured threshold');

-- Open alerts, newest first:
SELECT id, reading_id, alert_type, message, created_at, status
FROM alert WHERE status = 'open' ORDER BY created_at DESC, id DESC;

-- Resolve exactly one open alert (use parameter binding):
-- UPDATE alert SET status = 'resolved', resolved_at = CURRENT_TIMESTAMP
-- WHERE id = :alert_id AND status = 'open';

-- ================================================================
-- E. SETTINGS — existing 'preference' table; singleton row id = 1
-- ================================================================
SELECT id, target_temperature_c, light_warning_threshold, heating_enabled
FROM preference WHERE id = 1;

-- Update settings through the authenticated PATCH /api/preferences API normally.
-- Direct SQL equivalent (bind values; run in an explicit transaction):
-- UPDATE preference SET target_temperature_c = :target_temperature_c,
--     light_warning_threshold = :light_warning_threshold,
--     heating_enabled = :heating_enabled WHERE id = 1;

-- ================================================================
-- F. NON-DESTRUCTIVE SQL SMOKE TESTS (run in a DEVELOPMENT DB)
-- All changes inside this savepoint are rolled back at the end.
-- Expected final output: reading_test=1, session_test=1,
-- alert_test=1, settings_test=1.
-- ================================================================
SAVEPOINT smartbed_smoke_test;

INSERT INTO reading (recorded_at, occupied, temperature_c, humidity_percent,
                     light_level, heating_led_on, light_warning)
VALUES ('2099-01-01 08:00:00', 1, 19.5, 55.0, 420, 1, 0);

INSERT INTO sleep_session (started_at, status)
VALUES ('2099-01-01 08:00:00', 'active');
UPDATE sleep_session SET ended_at = '2099-01-01 15:30:00', status = 'completed'
WHERE id = last_insert_rowid();

INSERT INTO alert (reading_id, alert_type, message, created_at)
VALUES ((SELECT id FROM reading WHERE recorded_at = '2099-01-01 08:00:00' ORDER BY id DESC LIMIT 1),
        'light', 'SQL test alert', '2099-01-01 08:01:00');
UPDATE alert SET status = 'resolved', resolved_at = '2099-01-01 08:02:00'
WHERE id = last_insert_rowid();

UPDATE preference SET target_temperature_c = 22.0 WHERE id = 1;

SELECT
  (SELECT COUNT(*) FROM reading WHERE recorded_at = '2099-01-01 08:00:00' AND occupied = 1 AND temperature_c = 19.5) >= 1 AS reading_test,
  (SELECT COUNT(*) FROM sleep_session WHERE started_at = '2099-01-01 08:00:00' AND status = 'completed' AND ended_at = '2099-01-01 15:30:00') >= 1 AS session_test,
  (SELECT COUNT(*) FROM alert WHERE message = 'SQL test alert' AND status = 'resolved' AND resolved_at IS NOT NULL) >= 1 AS alert_test,
  (SELECT COUNT(*) FROM preference WHERE id = 1 AND target_temperature_c = 22.0) = 1 AS settings_test;

ROLLBACK TO SAVEPOINT smartbed_smoke_test;
RELEASE SAVEPOINT smartbed_smoke_test;

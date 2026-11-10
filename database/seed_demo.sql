<<<<<<< HEAD
-- Demo data for database/schema.sql: one family user, one care-home user,
-- one resident (Maureen) and her bed with the full sensor kit.
-- Password hashes are placeholders; real ones come from the backend.

=======
>>>>>>> 62ba779d97e8db9fee3900b13740929ffaf8da1e
INSERT INTO users (email, password_hash, display_name) VALUES
    ('claire@example.com', 'placeholder-not-a-real-hash', 'Claire K.'),
    ('staff@oakwood.example', 'placeholder-not-a-real-hash', 'Oakwood night staff');

INSERT INTO residents (display_name, room, support_tier, tier_score, alert_style)
VALUES ('Maureen K.', 'Room 4', 3, 7, 'visual_audible');

INSERT INTO beds (resident_id, name) VALUES (1, 'Maureen''s bed');

INSERT INTO bed_access (user_id, bed_id, role) VALUES (1, 1, 'family'), (2, 1, 'care_staff');

INSERT INTO contacts (resident_id, name, relationship, phone, consent_confirmed_at)
VALUES (1, 'Claire K.', 'daughter', '+353 00 000 0000', now());

INSERT INTO devices (bed_id, hardware_uid, model, kind, label, adc_channel, gpio_pin, occupancy_threshold) VALUES
    (1, 'pi-demo:fsr0',   'FSR402',     'sensor',   'Pressure pad',       0,    NULL, 300),
    (1, 'pi-demo:dht22',  'DHT22',      'sensor',   'Room climate',       NULL, 4,    NULL),
    (1, 'pi-demo:ldr0',   'LDR',        'sensor',   'Room light',         1,    NULL, NULL),
    (1, 'pi-demo:buzzer', 'buzzer',     'actuator', 'Bedside buzzer',     NULL, 18,   NULL),
    (1, 'pi-demo:heat',   'heater_led', 'actuator', 'Heating (LED sim.)', NULL, 23,   NULL);

INSERT INTO bed_settings (bed_id) VALUES (1);

INSERT INTO alarms (bed_id, alarm_time, label) VALUES (1, '07:30', 'Morning');

<<<<<<< HEAD
-- One reading every 5 minutes for the last 8 hours
=======
>>>>>>> 62ba779d97e8db9fee3900b13740929ffaf8da1e
INSERT INTO readings (device_id, measurement_type_id, value, recorded_at)
SELECT d.device_id, mt.measurement_type_id,
       CASE mt.name
           WHEN 'pressure'    THEN CASE WHEN t > now() - interval '25 minutes' THEN 40 ELSE 620 END
           WHEN 'temperature' THEN round((19.5 + sin(extract(epoch FROM t) / 3600.0))::numeric, 1)
           WHEN 'humidity'    THEN 55 + (extract(minute FROM t)::int % 6)
           WHEN 'light'       THEN 60
       END,
       t
FROM generate_series(now() - interval '8 hours', now(), interval '5 minutes') AS t
CROSS JOIN devices d
JOIN measurement_types mt
  ON (d.model = 'FSR402' AND mt.name = 'pressure')
  OR (d.model = 'DHT22'  AND mt.name IN ('temperature', 'humidity'))
  OR (d.model = 'LDR'    AND mt.name = 'light');

INSERT INTO sleep_sessions (bed_id, started_at, bed_exit_count, avg_temperature_c)
VALUES (1, now() - interval '8 hours', 1, 19.5);

INSERT INTO bed_exits (bed_id, sleep_session_id, left_at) VALUES (1, 1, now() - interval '22 minutes');

INSERT INTO alerts (bed_id, bed_exit_id, alert_type, severity, message)
VALUES (1, 1, 'bed_exit_no_return', 'critical',
        'Maureen K. left the bed and has not returned within her 20-minute grace period.');

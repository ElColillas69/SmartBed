"""SmartBed backend application factory."""
import os
import hmac
import math
from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo
from functools import wraps

from flask import Flask, request, jsonify, current_app
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import desc


db = SQLAlchemy()


def utc(value):
    """SQLite drops timezone info; stored values are always UTC."""
    if value is not None and value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


class Reading(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    recorded_at = db.Column(db.DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    occupied = db.Column(db.Boolean, nullable=False)
    temperature_c = db.Column(db.Float, nullable=False)
    humidity_percent = db.Column(db.Float, nullable=False)
    light_level = db.Column(db.Integer, nullable=False)  # MCP3008 raw 0..1023
    heating_led_on = db.Column(db.Boolean, nullable=False)
    light_warning = db.Column(db.Boolean, nullable=False)

    def as_dict(self):
        return {"id": self.id, "recorded_at": utc(self.recorded_at).isoformat(),
                "occupied": self.occupied, "temperature_c": self.temperature_c,
                "humidity_percent": self.humidity_percent, "light_level": self.light_level,
                "heating_led_on": self.heating_led_on, "light_warning": self.light_warning}


class Preference(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    target_temperature_c = db.Column(db.Float, nullable=False, default=21.0)
    light_warning_threshold = db.Column(db.Integer, nullable=False, default=800)
    heating_enabled = db.Column(db.Boolean, nullable=False, default=True)

    def as_dict(self):
        return {"target_temperature_c": self.target_temperature_c,
                "light_warning_threshold": self.light_warning_threshold,
                "heating_enabled": self.heating_enabled}


class Alarm(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    time = db.Column(db.String(5), nullable=False)  # Local HH:MM
    label = db.Column(db.String(80), nullable=False, default="Wake up")
    enabled = db.Column(db.Boolean, nullable=False, default=True)
    snooze_minutes = db.Column(db.Integer, nullable=False, default=5)
    last_triggered_date = db.Column(db.String(10), nullable=True)
    snoozed_until = db.Column(db.DateTime(timezone=True), nullable=True)

    def as_dict(self):
        return {"id": self.id, "time": self.time, "label": self.label,
                "enabled": self.enabled, "snooze_minutes": self.snooze_minutes,
                "snoozed_until": utc(self.snoozed_until).isoformat() if self.snoozed_until else None}


def key_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        expected = current_app.config["API_KEY"]
        provided = request.headers.get("X-API-Key", "")
        if not expected or not hmac.compare_digest(provided, expected):
            return jsonify(error="Valid X-API-Key required"), 401
        return fn(*args, **kwargs)
    return wrapper


def json_object():
    value = request.get_json(silent=True)
    if not isinstance(value, dict):
        raise ValueError("Request body must be a JSON object")
    return value


def number(value, name, low, high):
    if isinstance(value, bool) or not isinstance(value, (float, int)) or not low <= value <= high:
        raise ValueError(f"{name} must be a number between {low} and {high}")
    return float(value)


def boolean(value, name):
    if not isinstance(value, bool):
        raise ValueError(f"{name} must be true or false")
    return value


def time_string(value):
    if not isinstance(value, str):
        raise ValueError("time must be HH:MM")
    try:
        parsed = datetime.strptime(value, "%H:%M")
        if parsed.strftime("%H:%M") != value:
            raise ValueError()
    except ValueError:
        raise ValueError("time must be HH:MM (24-hour format)")
    return value


def newest_first(query):
    # Order by time, not id: seed_demo.py inserts backdated rows after live ones.
    return query.order_by(desc(Reading.recorded_at), desc(Reading.id))


def create_app(config=None):
    from dotenv import load_dotenv
    load_dotenv()
    app = Flask(__name__)
    app.config.update(
        SQLALCHEMY_DATABASE_URI=os.getenv("DATABASE_URL", "sqlite:///smartbed.db"),
        SQLALCHEMY_TRACK_MODIFICATIONS=False,
        API_KEY=os.getenv("API_KEY", ""),
        BED_TIMEZONE=os.getenv("BED_TIMEZONE", "Europe/Dublin"),
    )
    if config:
        app.config.update(config)
    CORS(app, resources={r"/api/*": {"origins": os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")}},
         allow_headers=["Content-Type", "X-API-Key"])
    db.init_app(app)
    with app.app_context():
        db.create_all()  # Development starter only; use migrations for production.
        if not db.session.get(Preference, 1):
            db.session.add(Preference(id=1))
            db.session.commit()

    @app.errorhandler(ValueError)
    def bad_data(err):
        return jsonify(error=str(err)), 400

    @app.get("/api/health")
    def health():
        return jsonify(status="ok", service="smartbed-api")

    @app.get("/api/readings/latest")
    @key_required
    def latest():
        reading = newest_first(db.session.query(Reading)).first()
        return jsonify(reading.as_dict() if reading else None)

    @app.get("/api/readings")
    @key_required
    def readings():
        try:
            limit = int(request.args.get("limit", 50))
        except ValueError:
            raise ValueError("limit must be an integer")
        if not 1 <= limit <= 500:
            raise ValueError("limit must be between 1 and 500")
        query = newest_first(db.session.query(Reading))
        if "minutes" not in request.args:
            return jsonify([r.as_dict() for r in query.limit(limit).all()])
        # A time window, thinned evenly to at most `limit` rows. The newest
        # reading is always first, even if older than the window, so the
        # current bed state stays exact and a silent Pi still shows as stale.
        try:
            minutes = int(request.args["minutes"])
        except ValueError:
            raise ValueError("minutes must be an integer")
        if not 1 <= minutes <= 1440:
            raise ValueError("minutes must be between 1 and 1440")
        since = datetime.now(timezone.utc) - timedelta(minutes=minutes)
        rows = query.filter(Reading.recorded_at >= since).all()
        step = max(1, math.ceil(len(rows) / limit))
        rows = rows[::step] or query.limit(1).all()
        return jsonify([r.as_dict() for r in rows])

    @app.post("/api/readings")
    @key_required
    def ingest():
        data = json_object()
        # In hardware, the Pi maps FSR readings to a boolean occupied value.
        occupied = boolean(data.get("occupied"), "occupied")
        temperature = number(data.get("temperature_c"), "temperature_c", -20, 60)
        humidity = number(data.get("humidity_percent"), "humidity_percent", 0, 100)
        raw_light = data.get("light_level")
        if isinstance(raw_light, bool) or not isinstance(raw_light, int) or not 0 <= raw_light <= 1023:
            raise ValueError("light_level must be an integer between 0 and 1023")
        heating, light_warning = decide(db.session.get(Preference, 1), occupied, temperature, raw_light)
        reading = Reading(occupied=occupied, temperature_c=temperature,
                          humidity_percent=humidity, light_level=raw_light,
                          heating_led_on=heating, light_warning=light_warning)
        db.session.add(reading)
        db.session.commit()
        # Raspberry Pi should poll or consume this decision and set LED accordingly.
        return jsonify(reading.as_dict()), 201

    @app.get("/api/sleep/nights")
    @key_required
    def sleep_nights():
        """Summarise each night (noon to noon, local time) from occupancy readings."""
        try:
            days = int(request.args.get("days", 7))
        except ValueError:
            raise ValueError("days must be an integer")
        if not 1 <= days <= 31:
            raise ValueError("days must be between 1 and 31")
        tz = ZoneInfo(app.config["BED_TIMEZONE"])
        since = datetime.now(timezone.utc) - timedelta(days=days + 1)
        rows = (db.session.query(Reading).filter(Reading.recorded_at >= since)
                .order_by(Reading.recorded_at).all())
        return jsonify(summarise_nights(rows, tz)[:days])

    @app.get("/api/preferences")
    @key_required
    def get_preferences():
        return jsonify(db.session.get(Preference, 1).as_dict())

    @app.patch("/api/preferences")
    @key_required
    def update_preferences():
        data = json_object()
        pref = db.session.get(Preference, 1)
        allowed = {"target_temperature_c", "light_warning_threshold", "heating_enabled"}
        if set(data) - allowed:
            raise ValueError("Unknown preference field")
        if "target_temperature_c" in data:
            pref.target_temperature_c = number(data["target_temperature_c"], "target_temperature_c", 15, 30)
        if "light_warning_threshold" in data:
            val = data["light_warning_threshold"]
            if isinstance(val, bool) or not isinstance(val, int) or not 0 <= val <= 1023:
                raise ValueError("light_warning_threshold must be an integer between 0 and 1023")
            pref.light_warning_threshold = val
        if "heating_enabled" in data:
            pref.heating_enabled = boolean(data["heating_enabled"], "heating_enabled")
        db.session.commit()
        return jsonify(pref.as_dict())

    def mark_handled(alarm):
        """Treat the alarm's most recent time as already rung, so creating,
        moving or re-enabling an alarm doesn't set it off for a time just passed."""
        local_now = datetime.now(ZoneInfo(app.config["BED_TIMEZONE"]))
        alarm.last_triggered_date = latest_occurrence(alarm.time, local_now).date().isoformat()

    @app.get("/api/alarms")
    @key_required
    def alarms():
        return jsonify([alarm.as_dict() for alarm in db.session.query(Alarm).order_by(Alarm.time).all()])

    @app.post("/api/alarms")
    @key_required
    def create_alarm():
        data = json_object()
        alarm = Alarm(time=time_string(data.get("time")), label=alarm_label(data.get("label", "Wake up")),
                      enabled=boolean(data.get("enabled", True), "enabled"),
                      snooze_minutes=snooze_duration(data.get("snooze_minutes", 5)))
        mark_handled(alarm)
        db.session.add(alarm)
        db.session.commit()
        return jsonify(alarm.as_dict()), 201

    @app.patch("/api/alarms/<int:alarm_id>")
    @key_required
    def update_alarm(alarm_id):
        alarm = db.get_or_404(Alarm, alarm_id)
        data = json_object()
        if set(data) - {"time", "label", "enabled", "snooze_minutes"}:
            raise ValueError("Unknown alarm field")
        if "time" in data:
            alarm.time = time_string(data["time"])
            mark_handled(alarm)
        if "label" in data:
            alarm.label = alarm_label(data["label"])
        if "enabled" in data:
            enabled = boolean(data["enabled"], "enabled")
            if enabled and not alarm.enabled:
                mark_handled(alarm)
            alarm.enabled = enabled
        if "snooze_minutes" in data:
            alarm.snooze_minutes = snooze_duration(data["snooze_minutes"])
        db.session.commit()
        return jsonify(alarm.as_dict())

    @app.delete("/api/alarms/<int:alarm_id>")
    @key_required
    def delete_alarm(alarm_id):
        alarm = db.get_or_404(Alarm, alarm_id)
        db.session.delete(alarm)
        db.session.commit()
        return "", 204

    @app.post("/api/alarms/<int:alarm_id>/snooze")
    @key_required
    def snooze_alarm(alarm_id):
        alarm = db.get_or_404(Alarm, alarm_id)
        alarm.snoozed_until = datetime.now(timezone.utc) + timedelta(minutes=alarm.snooze_minutes)
        db.session.commit()
        return jsonify(alarm.as_dict())

    @app.post("/api/alarms/<int:alarm_id>/dismiss")
    @key_required
    def dismiss_alarm(alarm_id):
        alarm = db.get_or_404(Alarm, alarm_id)
        mark_handled(alarm)
        alarm.snoozed_until = None
        db.session.commit()
        return jsonify(alarm.as_dict())

    @app.get("/api/device/commands")
    @key_required
    def commands():
        """Pi polls this endpoint to actuate its LED and buzzer locally.

        Starter does not independently run a background scheduler. The Pi must poll.
        """
        now = datetime.now(timezone.utc)
        local_now = now.astimezone(ZoneInfo(app.config["BED_TIMEZONE"]))
        due = [alarm.id for alarm in db.session.query(Alarm).filter_by(enabled=True).all()
               if alarm_ringing(alarm, local_now)]
        last = newest_first(db.session.query(Reading)).first()
        # Re-evaluate against current preferences so a settings change takes
        # effect immediately, not only when the next reading arrives.
        heating, light_warning = (decide(db.session.get(Preference, 1), last.occupied,
                                         last.temperature_c, last.light_level) if last else (False, False))
        return jsonify(heating_led_on=heating, light_warning=light_warning,
                       buzzer_on=bool(due), due_alarm_ids=due)

    return app


def decide(pref, occupied, temperature, light_level):
    """Heating LED and light warning for one set of sensor values."""
    heating = pref.heating_enabled and occupied and temperature < pref.target_temperature_c
    return heating, light_level > pref.light_warning_threshold


RING_LIMIT = timedelta(minutes=30)  # an alarm nobody answers goes quiet after this


def latest_occurrence(hhmm, local_now):
    """The most recent local datetime at which a daily HH:MM alarm went off."""
    hour, minute = map(int, hhmm.split(":"))
    at = local_now.replace(hour=hour, minute=minute, second=0, microsecond=0)
    return at if at <= local_now else at - timedelta(days=1)


def alarm_ringing(alarm, local_now):
    """Rings from its time (or the end of a snooze) until dismissed, snoozed or RING_LIMIT passes.

    Using a window instead of an exact-minute match means a Pi that polls less
    than once a minute still hears the alarm.
    """
    snoozed = utc(alarm.snoozed_until)
    if snoozed and local_now < snoozed:
        return False
    if snoozed and local_now < snoozed + RING_LIMIT:
        return True
    at = latest_occurrence(alarm.time, local_now)
    return alarm.last_triggered_date != at.date().isoformat() and local_now < at + RING_LIMIT


MAX_SAMPLE_GAP = timedelta(minutes=10)  # longer gaps are treated as missing data


def summarise_nights(rows, tz):
    nights = {}
    for row in rows:
        local = utc(row.recorded_at).astimezone(tz)
        nights.setdefault((local - timedelta(hours=12)).date(), []).append(row)
    latest = max(nights, default=None)
    fresh = bool(rows) and datetime.now(timezone.utc) - utc(rows[-1].recorded_at) < 3 * MAX_SAMPLE_GAP
    result = []
    for night, samples in sorted(nights.items(), reverse=True):
        occupied = [r for r in samples if r.occupied]
        if not occupied:
            continue
        asleep = timedelta()
        exits = 0
        for prev, cur in zip(samples, samples[1:]):
            gap = utc(cur.recorded_at) - utc(prev.recorded_at)
            if prev.occupied:
                asleep += min(gap, MAX_SAMPLE_GAP)
                if not cur.occupied and cur.recorded_at < occupied[-1].recorded_at:
                    exits += 1
        result.append({
            "night": night.isoformat(),
            "bedtime": utc(occupied[0].recorded_at).isoformat(),
            "wake": utc(occupied[-1].recorded_at).isoformat(),
            "in_bed_minutes": round(asleep.total_seconds() / 60),
            "bed_exits": exits,
            "avg_temperature_c": round(sum(r.temperature_c for r in occupied) / len(occupied), 1),
            "in_progress": night == latest and samples[-1].occupied and fresh,
        })
    return result


def snooze_duration(val):
    if isinstance(val, bool) or not isinstance(val, int) or not 1 <= val <= 30:
        raise ValueError("snooze_minutes must be an integer from 1 to 30")
    return val


def alarm_label(val):
    if not isinstance(val, str) or not 1 <= len(val.strip()) <= 80:
        raise ValueError("label must be 1–80 characters")
    return val.strip()

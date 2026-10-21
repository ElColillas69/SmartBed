"""SmartBed backend application factory."""
import os
from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo
from functools import wraps

from flask import Flask, request, jsonify, current_app
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import desc


db = SQLAlchemy()


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
        return {"id": self.id, "recorded_at": self.recorded_at.isoformat(),
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
                "snoozed_until": self.snoozed_until.isoformat() if self.snoozed_until else None}


def key_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        expected = current_app.config["API_KEY"]
        import hmac
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
        reading = db.session.query(Reading).order_by(desc(Reading.id)).first()
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
        result = db.session.query(Reading).order_by(desc(Reading.id)).limit(limit).all()
        return jsonify([r.as_dict() for r in result])

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
        pref = db.session.get(Preference, 1)
        heating = pref.heating_enabled and occupied and temperature < pref.target_temperature_c
        light_warning = raw_light > pref.light_warning_threshold
        reading = Reading(occupied=occupied, temperature_c=temperature,
                          humidity_percent=humidity, light_level=raw_light,
                          heating_led_on=heating, light_warning=light_warning)
        db.session.add(reading)
        db.session.commit()
        # Raspberry Pi should poll or consume this decision and set LED accordingly.
        return jsonify(reading.as_dict()), 201

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
            alarm.last_triggered_date = None
        if "label" in data:
            alarm.label = alarm_label(data["label"])
        if "enabled" in data:
            alarm.enabled = boolean(data["enabled"], "enabled")
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
        local_now = datetime.now(ZoneInfo(app.config["BED_TIMEZONE"]))
        alarm.last_triggered_date = local_now.date().isoformat()
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
        date = local_now.date().isoformat()
        minute = local_now.strftime("%H:%M")
        due = []
        for alarm in db.session.query(Alarm).filter_by(enabled=True).all():
            snoozed = alarm.snoozed_until
            if snoozed and snoozed.tzinfo is None:
                snoozed = snoozed.replace(tzinfo=timezone.utc)
            if snoozed and now >= snoozed:
                due.append(alarm.id)
            elif not snoozed and alarm.time == minute and alarm.last_triggered_date != date:
                due.append(alarm.id)
        last = db.session.query(Reading).order_by(desc(Reading.id)).first()
        return jsonify(heating_led_on=last.heating_led_on if last else False,
                       light_warning=last.light_warning if last else False,
                       buzzer_on=bool(due), due_alarm_ids=due)

    return app


def snooze_duration(val):
    if isinstance(val, bool) or not isinstance(val, int) or not 1 <= val <= 30:
        raise ValueError("snooze_minutes must be an integer from 1 to 30")
    return val


def alarm_label(val):
    if not isinstance(val, str) or not 1 <= len(val.strip()) <= 80:
        raise ValueError("label must be 1–80 characters")
    return val.strip()

# Generated with Claude (Anthropic, 2026).
import os
import tempfile

# Must happen before `app` is imported: a throwaway database and a fixed secret.
_db = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
os.environ["DATABASE_URL"] = f"sqlite:///{_db.name}"
os.environ["JWT_SECRET"] = "test-secret-that-is-at-least-32-bytes-long"
os.environ["MQTT_HOST"] = ""            # no broker in tests

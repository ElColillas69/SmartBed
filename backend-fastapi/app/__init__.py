from dotenv import load_dotenv, dotenv_values
from pathlib import Path

env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(env_path, override=True, encoding="utf-8-sig") # before any other app module so os.getenv sees .env

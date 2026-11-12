# Generated with Claude (Anthropic, 2026).
# The FastAPI server as a container image.
# Docs: https://fastapi.tiangolo.com/deployment/docker/
FROM python:3.12-slim
WORKDIR /code
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app ./app
COPY seed.py simulate.py ./
# One worker on purpose: each worker would open its own MQTT subscription and
# save every reading twice.
CMD ["fastapi", "run", "app/main.py", "--port", "8000", "--workers", "1"]

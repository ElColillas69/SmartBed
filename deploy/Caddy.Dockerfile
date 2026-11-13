# Generated with Claude (Anthropic, 2026).
# Stage 1 builds the React app; stage 2 is Caddy serving it, so the VM only needs Docker.
# Docs: https://docs.docker.com/build/building/multi-stage/
FROM node:22-alpine AS build
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM caddy:2
COPY deploy/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /srv

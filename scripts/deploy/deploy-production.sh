#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/swe40006-project}"
COMPOSE_FILE="$APP_DIR/infra/compose/compose.production.yml"

export APP_NAME="${APP_NAME:-Balance}"
export PRODUCT_NAME="${PRODUCT_NAME:-Balance}"
export PROJECT_SLUG="${PROJECT_SLUG:-balance}"
export DEPLOYMENT_NAMESPACE="${DEPLOYMENT_NAMESPACE:-swe40006-project}"
export APP_ENV=production
export NODE_ENV=production
export APP_VERSION="${APP_VERSION:-0.1.0}"
export GIT_COMMIT="${GIT_COMMIT:-production}"
export BUILD_ID="${BUILD_ID:-production-build}"
export WEB_PORT="${WEB_PORT:-3000}"
export API_PORT="${API_PORT:-3001}"
export PUBLIC_HTTP_PORT="${PUBLIC_HTTP_PORT:-80}"
export API_BASE_URL="${API_BASE_URL:-http://api:3001}"
export API_PROXY_TARGET="${API_PROXY_TARGET:-http://api:3001}"
export API_BASE_PATH="${API_BASE_PATH:-/api}"
export API_HEALTH_PATH="${API_HEALTH_PATH:-/api/health}"
export API_VERSION_PATH="${API_VERSION_PATH:-/api/version}"
export NEXT_PUBLIC_API_BASE_PATH="${NEXT_PUBLIC_API_BASE_PATH:-$API_BASE_PATH}"
export NEXT_PUBLIC_API_HEALTH_PATH="${NEXT_PUBLIC_API_HEALTH_PATH:-$API_HEALTH_PATH}"
export NEXT_PUBLIC_API_VERSION_PATH="${NEXT_PUBLIC_API_VERSION_PATH:-$API_VERSION_PATH}"

cd "$APP_DIR"

docker compose -f "$COMPOSE_FILE" down --remove-orphans
docker compose -f "$COMPOSE_FILE" up -d --build --remove-orphans
docker compose -f "$COMPOSE_FILE" ps

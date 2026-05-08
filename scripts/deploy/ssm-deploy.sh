#!/usr/bin/env bash
set -euo pipefail

require_var() {
  local name="$1"
  if [ -z "${!name:-}" ]; then
    printf '%s is required\n' "$name" >&2
    exit 1
  fi
}

APP_DIR="${APP_DIR:-/opt/swe40006-project}"
COMPOSE_FILE="${COMPOSE_FILE:-}"
APP_ENV="${APP_ENV:-}"
GIT_COMMIT="${GIT_COMMIT:-}"
BUILD_ID="${BUILD_ID:-}"

require_var APP_DIR
require_var COMPOSE_FILE
require_var APP_ENV
require_var GIT_COMMIT
require_var BUILD_ID

current_user="$(id -un)"

if [ "$current_user" = 'ubuntu' ] && [ "${HOME:-}" != '/home/ubuntu' ]; then
  export HOME='/home/ubuntu'
elif [ -z "${HOME:-}" ] && [ -d '/home/ubuntu' ]; then
  export HOME='/home/ubuntu'
fi

if ! [ -d "$APP_DIR" ]; then
  printf 'APP_DIR does not exist: %s\n' "$APP_DIR" >&2
  exit 1
fi

if ! [ -w "$APP_DIR" ]; then
  printf 'APP_DIR is not writable by %s\n' "$current_user" >&2
  exit 1
fi

cd "$APP_DIR"

if [ ! -d .git ]; then
  printf 'Git repository is missing in %s\n' "$APP_DIR" >&2
  exit 1
fi

if [ ! -f "$COMPOSE_FILE" ]; then
  printf 'COMPOSE_FILE does not exist: %s\n' "$COMPOSE_FILE" >&2
  exit 1
fi

short_commit="$(printf '%s' "$GIT_COMMIT" | cut -c1-12)"
current_head_full="$(git rev-parse HEAD)"
current_head="$(printf '%s' "$current_head_full" | cut -c1-12)"

if [ "$current_head_full" != "$GIT_COMMIT" ]; then
  printf 'Repository HEAD %s does not match GIT_COMMIT %s\n' "$current_head_full" "$GIT_COMMIT" >&2
  exit 1
fi

printf 'whoami=%s\n' "$(whoami)"
id
pwd
printf 'HOME=%s\n' "${HOME:-}"
git --version
docker --version
docker compose version
printf 'APP_DIR=%s\n' "$APP_DIR"
printf 'COMPOSE_FILE=%s\n' "$COMPOSE_FILE"
printf 'APP_ENV=%s\n' "$APP_ENV"
printf 'GIT_COMMIT=%s\n' "$short_commit"
printf 'CURRENT_HEAD=%s\n' "$current_head"
printf 'BUILD_ID=%s\n' "$BUILD_ID"

export APP_NAME="${APP_NAME:-Balance}"
export PRODUCT_NAME="${PRODUCT_NAME:-Balance}"
export PROJECT_SLUG="${PROJECT_SLUG:-balance}"
export DEPLOYMENT_NAMESPACE="${DEPLOYMENT_NAMESPACE:-swe40006-project}"
export APP_ENV
export NODE_ENV="${NODE_ENV:-production}"
export APP_VERSION="${APP_VERSION:-0.1.0}"
export GIT_COMMIT
export BUILD_ID
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

docker compose -f "$COMPOSE_FILE" down --remove-orphans
docker compose -f "$COMPOSE_FILE" up -d --build --remove-orphans
docker compose -f "$COMPOSE_FILE" ps

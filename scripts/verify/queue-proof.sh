#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE_FILE="${COMPOSE_FILE:-infra/compose/compose.local.yml}"
COMPOSE_PROJECT_NAME="${QUEUE_PROOF_COMPOSE_PROJECT:-balance-queue-proof}"

cd "$ROOT_DIR"

export APP_ENV="${APP_ENV:-local}"
export DATABASE_URL="${QUEUE_PROOF_DATABASE_URL:-postgresql://balance:balance@postgres:5432/balance?schema=public}"
export REDIS_URL="${QUEUE_PROOF_REDIS_URL:-redis://redis:6379}"
export QUEUE_PROOF_NAME="${QUEUE_PROOF_NAME:-queue_proof}"
export EXTRACTION_QUEUE_NAME="${EXTRACTION_QUEUE_NAME:-document_extract}"
export JWT_SECRET="${JWT_SECRET:-replace-this-local-only}"
export PASSWORD_PEPPER="${PASSWORD_PEPPER:-replace-this-local-only}"
export STORAGE_DRIVER="${STORAGE_DRIVER:-filesystem}"
export STORAGE_FILESYSTEM_ROOT="${STORAGE_FILESYSTEM_ROOT:-/data/balance-storage}"
export OCR_PROVIDER="${OCR_PROVIDER:-tesseract}"
export TESSERACT_LANG="${TESSERACT_LANG:-eng}"

compose() {
  docker compose -p "$COMPOSE_PROJECT_NAME" -f "$COMPOSE_FILE" "$@"
}

cleanup() {
  if [ "${QUEUE_PROOF_KEEP_STACK:-0}" != "1" ]; then
    compose down --remove-orphans -v >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

compose up -d --build postgres redis
compose run --rm --build api pnpm prisma:deploy
compose run --rm api pnpm prisma:seed
compose up -d --build api worker

for attempt in $(seq 1 30); do
  if compose exec -T worker curl -fsS http://localhost:8000/health >/dev/null; then
    break
  fi
  if [ "$attempt" -eq 30 ]; then
    printf 'worker health did not become ready\n' >&2
    exit 1
  fi
  sleep 2
done

for attempt in $(seq 1 30); do
  if compose exec -T worker curl -fsS http://localhost:8000/ready >/dev/null; then
    break
  fi
  if [ "$attempt" -eq 30 ]; then
    printf 'worker dependency readiness did not become ready\n' >&2
    exit 1
  fi
  sleep 2
done

compose exec -T api node apps/api/dist/queue-proof/produce-proof-job.js

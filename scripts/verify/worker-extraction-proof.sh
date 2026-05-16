#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE_FILE="${COMPOSE_FILE:-infra/compose/compose.local.yml}"
COMPOSE_PROJECT_NAME="${WORKER_EXTRACTION_PROOF_COMPOSE_PROJECT:-balance-worker-extraction-proof}"

cd "$ROOT_DIR"

export APP_ENV="${APP_ENV:-local}"
export DATABASE_URL="${WORKER_EXTRACTION_PROOF_DATABASE_URL:-postgresql://balance:balance@postgres:5432/balance?schema=public}"
export REDIS_URL="${WORKER_EXTRACTION_PROOF_REDIS_URL:-redis://redis:6379}"
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
  if [ "${WORKER_EXTRACTION_PROOF_KEEP_STACK:-0}" != "1" ]; then
    compose down --remove-orphans -v >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

if [ "${WORKER_EXTRACTION_PROOF_KEEP_STACK:-0}" != "1" ]; then
  compose down --remove-orphans -v >/dev/null 2>&1 || true
fi

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

for attempt in $(seq 1 30); do
  if compose exec -T worker curl -fsS http://api:3001/ready >/dev/null; then
    break
  fi
  if [ "$attempt" -eq 30 ]; then
    printf 'api readiness did not become ready\n' >&2
    exit 1
  fi
  sleep 2
done

compose exec -T api node - <<'NODE'
const apiBase = 'http://localhost:3001';
const requiredAuditActions = [
  'document.uploaded',
  'extraction.queued',
  'extraction.started',
  'extraction.completed'
];

function escapePdfText(value) {
  return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function makeProofPdf() {
  const lines = ['BALANCE MART', '2026-05-16', '12.34'];
  const text = [
    'BT',
    '/F1 42 Tf',
    '72 690 Td',
    `(${escapePdfText(lines[0])}) Tj`,
    '0 -64 Td',
    `(${escapePdfText(lines[1])}) Tj`,
    '0 -64 Td',
    `(${escapePdfText(lines[2])}) Tj`,
    'ET'
  ].join('\n');

  const stream = `${text}\n`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(stream, 'ascii')} >>\nstream\n${stream}endstream`
  ];

  let pdf = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf, 'binary'));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(pdf, 'binary');
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (const offset of offsets.slice(1)) {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  pdf += `startxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdf, 'binary');
}

async function fetchJson(path, options = {}) {
  const response = await fetch(`${apiBase}${path}`, options);
  const bodyText = await response.text();
  let body = null;
  if (bodyText) {
    try {
      body = JSON.parse(bodyText);
    } catch {
      throw new Error(`${path} returned non-JSON response: ${bodyText.slice(0, 300)}`);
    }
  }
  if (!response.ok) {
    throw new Error(`${path} returned ${response.status}: ${bodyText.slice(0, 300)}`);
  }
  return body;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const login = await fetchJson('/auth/login', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    email: 'consumer@balance.local',
    password: 'replace-this-local-only'
  })
});

const token = login.accessToken;
assert(token, 'login did not return an access token');

const form = new FormData();
form.set('label', 'Worker extraction proof');
form.set('notes', 'Deterministic OCR proof fixture');
form.set('file', new Blob([makeProofPdf()], { type: 'application/pdf' }), 'worker-extraction-proof.pdf');

const upload = await fetchJson('/documents', {
  method: 'POST',
  headers: { authorization: `Bearer ${token}` },
  body: form
});

const documentId = upload?.document?.id;
assert(documentId, 'upload did not return a document id');
assert(upload?.extractionJob?.status === 'queued', 'upload did not create a queued extraction job');

let detail = null;
for (let attempt = 1; attempt <= 45; attempt += 1) {
  detail = await fetchJson(`/documents/${documentId}`, {
    headers: { authorization: `Bearer ${token}` }
  });
  const status = detail?.document?.status;
  if (['extracted', 'correction_required', 'failed'].includes(status)) break;
  await new Promise((resolve) => setTimeout(resolve, 2000));
}

const document = detail?.document;
assert(document, 'document detail was not returned');
assert(document.status === 'extracted', `expected extracted document status, got ${document.status}`);
assert(document.extractionJob?.status === 'completed', `expected completed extraction job, got ${document.extractionJob?.status}`);
assert(Array.isArray(document.fields) && document.fields.length > 0, 'expected at least one persisted document field');

const fieldNames = new Set(document.fields.map((field) => field.name));
assert(fieldNames.has('merchantName') || fieldNames.has('amountMinor'), 'expected merchantName or amountMinor OCR field');

const audit = await fetchJson(`/audit?documentId=${documentId}`, {
  headers: { authorization: `Bearer ${token}` }
});
const actions = new Set((audit?.auditEvents ?? []).map((event) => event.action));
for (const action of requiredAuditActions) {
  assert(actions.has(action), `missing audit action ${action}`);
}

console.log(
  JSON.stringify({
    ok: true,
    documentId,
    documentStatus: document.status,
    extractionJobStatus: document.extractionJob.status,
    fields: document.fields.map((field) => field.name),
    auditActions: requiredAuditActions
  })
);
NODE

from __future__ import annotations

import datetime
import os
import tempfile
import uuid
from pathlib import Path

import boto3

from . import db, ocr, settings


def _filesystem_path(root_dir: str, storage_key: str) -> str:
    normalized_key = storage_key.lstrip("/")
    root = Path(root_dir).resolve()
    target = (root / normalized_key).resolve()
    if root != target and root not in target.parents:
        raise RuntimeError("invalid storage key")
    return str(target)


def _now() -> datetime.datetime:
    return datetime.datetime.now(datetime.timezone.utc)

def _uuid() -> str:
    return str(uuid.uuid4())

def _s3_key(storage_key: str) -> str:
    return (storage_key or "").lstrip("/")

def _file_suffix(content_type: str) -> str:
    normalized = (content_type or "").lower().strip()
    if normalized == "application/pdf":
        return ".pdf"
    if normalized == "image/png":
        return ".png"
    if normalized == "image/jpeg":
        return ".jpg"
    return ".bin"

def _download_s3_to_tempfile(bucket: str, key: str, region: str | None, content_type: str) -> str:
    if not bucket or not bucket.strip():
        raise RuntimeError("S3_BUCKET is required for s3 storage")

    suffix = _file_suffix(content_type)
    # Keep the file on disk until we're done OCR-ing; we delete it explicitly.
    tmp = tempfile.NamedTemporaryFile(prefix="balance-s3-", suffix=suffix, delete=False)
    try:
        client_kwargs: dict[str, object] = {}
        if region and region.strip():
            client_kwargs["region_name"] = region.strip()

        s3 = boto3.client("s3", **client_kwargs)
        s3.download_fileobj(bucket, key, tmp)
        tmp.flush()
        return tmp.name
    finally:
        tmp.close()


async def process_extraction(job, _job_token):
    data = job.data or {}

    extraction_job_id = data.get("extractionJobId")
    document_id = data.get("documentId")
    storage_key = data.get("storageKey")
    content_type = data.get("contentType")

    if not extraction_job_id or not document_id or not storage_key or not content_type:
        raise RuntimeError("missing job payload fields")

    conn = db.connect(settings.DATABASE_URL)
    temp_download_path: str | None = None
    try:
        with conn.cursor() as cur:
            cur.execute(
                'UPDATE "ExtractionJob" SET status=%s, "startedAt"=%s WHERE id=%s',
                ("processing", _now(), extraction_job_id),
            )
            cur.execute(
                'UPDATE "Document" SET status=%s, "updatedAt"=%s WHERE id=%s',
                ("processing", _now(), document_id),
            )
            cur.execute(
                'INSERT INTO "AuditEvent" (id, action, "entityType", "entityId", "actorId", "actorRole", message, metadata, "createdAt", "documentId", "extractionJobId") '
                "VALUES (%s::uuid, %s, %s, %s, %s, %s, %s, %s::jsonb, %s, %s, %s)",
                (
                    _uuid(),
                    "document.processing_started",
                    "document",
                    document_id,
                    None,
                    "system",
                    "Extraction started",
                    "{}",
                    _now(),
                    document_id,
                    extraction_job_id,
                ),
            )

        file_path = None
        if settings.STORAGE_DRIVER == "filesystem":
            file_path = _filesystem_path(settings.STORAGE_FILESYSTEM_ROOT, storage_key)
        else:
            temp_download_path = _download_s3_to_tempfile(
                settings.S3_BUCKET,
                _s3_key(storage_key),
                settings.S3_REGION or None,
                content_type,
            )
            file_path = temp_download_path

        text = ocr.extract_text(content_type, file_path, settings.TESSERACT_LANG)
        fields = ocr.parse_fields(text)

        # Determine whether we extracted enough to call it `extracted` vs requiring correction.
        status = "extracted" if fields.get("merchantName") or fields.get("amountMinor") else "correction_required"

        with conn.cursor() as cur:
            # Upsert extracted fields.
            for name in ("merchantName", "documentDate", "amountMinor", "currency"):
                value = fields.get(name)
                if value is None:
                    continue
                cur.execute(
                    'INSERT INTO "DocumentField" (id, "documentId", name, value, "correctedValue", confidence, source, "createdAt", "updatedAt") '
                    "VALUES (%s::uuid, %s, %s::\"FieldName\", %s, NULL, NULL, %s::\"FieldSource\", %s, %s) "
                    'ON CONFLICT ("documentId", name) DO UPDATE SET value=EXCLUDED.value, "updatedAt"=EXCLUDED."updatedAt"',
                    (_uuid(), document_id, name, str(value), "ocr", _now(), _now()),
                )

            cur.execute(
                'UPDATE "Document" SET status=%s, "merchantName"=%s, "documentDate"=%s, "amountMinor"=%s, currency=%s, "updatedAt"=%s WHERE id=%s',
                (
                    status,
                    fields.get("merchantName"),
                    fields.get("documentDate"),
                    fields.get("amountMinor"),
                    fields.get("currency"),
                    _now(),
                    document_id,
                ),
            )

            cur.execute(
                'UPDATE "ExtractionJob" SET status=%s, "completedAt"=%s, "errorMessage"=NULL WHERE id=%s',
                ("completed", _now(), extraction_job_id),
            )

            cur.execute(
                'INSERT INTO "AuditEvent" (id, action, "entityType", "entityId", "actorId", "actorRole", message, metadata, "createdAt", "documentId", "extractionJobId") '
                "VALUES (%s::uuid, %s, %s, %s, %s, %s, %s, %s::jsonb, %s, %s, %s)",
                (
                    _uuid(),
                    "extraction.completed",
                    "extraction_job",
                    extraction_job_id,
                    None,
                    "system",
                    "Extraction completed",
                    "{}",
                    _now(),
                    document_id,
                    extraction_job_id,
                ),
            )

        return {"status": status, "fields": {k: fields.get(k) for k in ("merchantName", "documentDate", "amountMinor", "currency")}}
    except Exception as e:
        # Best-effort failure persistence.
        try:
            with conn.cursor() as cur:
                cur.execute(
                    'UPDATE "ExtractionJob" SET status=%s, "completedAt"=%s, "errorMessage"=%s WHERE id=%s',
                    ("failed", _now(), str(e)[:500], extraction_job_id),
                )
                cur.execute(
                    'UPDATE "Document" SET status=%s, "updatedAt"=%s WHERE id=%s',
                    ("failed", _now(), document_id),
                )
                cur.execute(
                    'INSERT INTO "AuditEvent" (id, action, "entityType", "entityId", "actorId", "actorRole", message, metadata, "createdAt", "documentId", "extractionJobId") '
                    "VALUES (%s::uuid, %s, %s, %s, %s, %s, %s, %s::jsonb, %s, %s, %s)",
                    (
                        _uuid(),
                        "document.extraction_failed",
                        "document",
                        document_id,
                        None,
                        "system",
                        "Extraction failed",
                        "{}",
                        _now(),
                        document_id,
                        extraction_job_id,
                    ),
                )
        except Exception:
            pass
        raise
    finally:
        conn.close()
        if temp_download_path:
            try:
                os.remove(temp_download_path)
            except Exception:
                pass

import os


def env(name: str, fallback: str | None = None) -> str:
    value = os.getenv(name)
    if value is not None and value.strip() != "":
        return value.strip()
    if fallback is not None:
        return fallback
    raise RuntimeError(f"{name} is required")


REDIS_URL = env("REDIS_URL", "redis://redis:6379")
QUEUE_PROOF_NAME = env("QUEUE_PROOF_NAME", "queue_proof")
EXTRACTION_QUEUE_NAME = env("EXTRACTION_QUEUE_NAME", "document_extract")

DATABASE_URL = env("DATABASE_URL", "postgresql://balance:balance@postgres:5432/balance?schema=public")

STORAGE_DRIVER = env("STORAGE_DRIVER", "filesystem").lower()
STORAGE_FILESYSTEM_ROOT = env("STORAGE_FILESYSTEM_ROOT", "/data/balance-storage")
S3_BUCKET = env("S3_BUCKET", "")
S3_REGION = env("S3_REGION", os.getenv("AWS_REGION") or "")

OCR_PROVIDER = env("OCR_PROVIDER", "tesseract").lower()
TESSERACT_LANG = env("TESSERACT_LANG", "eng")

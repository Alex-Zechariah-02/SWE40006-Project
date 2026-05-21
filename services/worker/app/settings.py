import os


def _runtime_env() -> str:
    return (os.getenv("APP_ENV") or os.getenv("NODE_ENV") or "local").strip().lower()


def _env_int(name: str, fallback: int) -> int:
    raw = (os.getenv(name) or "").strip()
    if not raw:
        return fallback
    try:
        return int(raw)
    except ValueError:
        return fallback


APP_ENV = _runtime_env()
AWS_DEPLOYMENT_ENVS = {"staging", "production"}


def env(name: str, fallback: str | None = None) -> str:
    value = os.getenv(name)
    if value is not None and value.strip() != "":
        return value.strip()
    if APP_ENV in {"staging", "production"} and name in {"DATABASE_URL"}:
        raise RuntimeError(f"{name} is required in {APP_ENV}")
    if fallback is not None:
        return fallback
    raise RuntimeError(f"{name} is required")


REDIS_URL = env("REDIS_URL", "redis://redis:6379")
QUEUE_PROOF_NAME = env("QUEUE_PROOF_NAME", "queue_proof")
EXTRACTION_QUEUE_NAME = env("EXTRACTION_QUEUE_NAME", "document_extract")

DATABASE_URL = env("DATABASE_URL", "postgresql://balance:balance@postgres:5432/balance?schema=public")

AWS_REGION = env("AWS_REGION", "")
STORAGE_DRIVER = env("STORAGE_DRIVER", "filesystem").lower()
if APP_ENV in AWS_DEPLOYMENT_ENVS and STORAGE_DRIVER != "s3":
    raise RuntimeError(f"STORAGE_DRIVER must be s3 in {APP_ENV}")
STORAGE_FILESYSTEM_ROOT = env("STORAGE_FILESYSTEM_ROOT", "/data/balance-storage")
S3_BUCKET = env("S3_BUCKET", "")
S3_REGION = env("S3_REGION", AWS_REGION)
if APP_ENV in AWS_DEPLOYMENT_ENVS:
    if not AWS_REGION:
        raise RuntimeError(f"AWS_REGION is required in {APP_ENV}")
    if not S3_BUCKET:
        raise RuntimeError(f"S3_BUCKET is required in {APP_ENV}")
    if not S3_REGION:
        raise RuntimeError(f"S3_REGION is required in {APP_ENV}")
    if S3_REGION != AWS_REGION:
        raise RuntimeError(f"S3_REGION must match AWS_REGION in {APP_ENV}")

OCR_PROVIDER = env("OCR_PROVIDER", "textract").lower()
if APP_ENV in AWS_DEPLOYMENT_ENVS and OCR_PROVIDER != "textract":
    raise RuntimeError(f"OCR_PROVIDER must be textract in {APP_ENV}")
TESSERACT_LANG = env("TESSERACT_LANG", "eng")

TEXTRACT_PREPROCESS = env("TEXTRACT_PREPROCESS", "false").lower() == "true"
TEXTRACT_SCRATCH_PREFIX = env("TEXTRACT_SCRATCH_PREFIX", "textract-scratch")
TEXTRACT_CONFIDENCE_AUTO = _env_int("TEXTRACT_CONFIDENCE_AUTO", 90)
TEXTRACT_CONFIDENCE_FLAG = _env_int("TEXTRACT_CONFIDENCE_FLAG", 50)

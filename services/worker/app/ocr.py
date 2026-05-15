from __future__ import annotations

import os
import re
import subprocess
import tempfile
from pathlib import Path


def run_tesseract(image_path: str, lang: str) -> str:
    # Use tesseract CLI directly; it is available inside the worker image.
    result = subprocess.run(
        ["tesseract", image_path, "stdout", "-l", lang],
        check=False,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or "tesseract failed")
    return result.stdout


def extract_text(content_type: str, file_path: str, lang: str) -> str:
    normalized = (content_type or "").lower().strip()

    if normalized in ("image/jpeg", "image/png"):
        return run_tesseract(file_path, lang)

    if normalized == "application/pdf":
        # Convert PDF pages to PNGs then OCR each page.
        with tempfile.TemporaryDirectory(prefix="balance-pdf-") as tmpdir:
            out_prefix = str(Path(tmpdir) / "page")
            convert = subprocess.run(
                ["pdftoppm", "-png", file_path, out_prefix],
                check=False,
                capture_output=True,
                text=True,
            )
            if convert.returncode != 0:
                raise RuntimeError(convert.stderr.strip() or "pdftoppm failed")

            pages = sorted(Path(tmpdir).glob("page-*.png"))
            if not pages:
                raise RuntimeError("No pages extracted from PDF")

            texts: list[str] = []
            for p in pages:
                texts.append(run_tesseract(str(p), lang))
            return "\n".join(texts)

    raise RuntimeError("unsupported content type")


def parse_fields(text: str) -> dict[str, object]:
    # Minimal deterministic parsing:
    # - merchantName: first non-empty line
    # - documentDate: YYYY-MM-DD if present, else DD/MM/YYYY
    # - amountMinor: first amount-like token, converted to minor units (2 dp)
    # - currency: MYR by default if amount found
    lines = [ln.strip() for ln in (text or "").splitlines() if ln.strip()]
    merchant = lines[0][:200] if lines else None

    iso_date = re.search(r"\b(20\d{2}-\d{2}-\d{2})\b", text)
    if iso_date:
        document_date = iso_date.group(1)
    else:
        dmy = re.search(r"\b(\d{2})/(\d{2})/(20\d{2})\b", text)
        document_date = f"{dmy.group(3)}-{dmy.group(2)}-{dmy.group(1)}" if dmy else None

    amount_match = re.search(r"\b(\d{1,3}(?:,\d{3})*(?:\.\d{2})|\d+\.\d{2})\b", text)
    amount_minor = None
    currency = None
    if amount_match:
        raw = amount_match.group(1).replace(",", "")
        try:
            # minor units (2dp)
            amount_minor = int(round(float(raw) * 100))
            currency = "MYR"
        except ValueError:
            amount_minor = None

    return {
        "merchantName": merchant,
        "documentDate": document_date,
        "amountMinor": amount_minor,
        "currency": currency,
        "rawTextLength": len(text or ""),
    }


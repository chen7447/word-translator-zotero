"""Shared helpers for API protocol probes.

This module intentionally does not import or modify the Zotero plugin.
"""
from __future__ import annotations

import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

LAB_ROOT = Path(__file__).resolve().parents[1]
RESULTS_DIR = LAB_ROOT / "results"


def baidu_sign(app_id: str, query: str, salt: str, secret_key: str) -> str:
    """Return Baidu ordinary-translation MD5 signature."""
    raw = f"{app_id}{query}{salt}{secret_key}".encode("utf-8")
    return hashlib.md5(raw).hexdigest()


def baidu_field_sign(app_id: str, query: str, salt: str, domain: str, secret_key: str) -> str:
    """Return Baidu vertical-domain MD5 signature."""
    raw = f"{app_id}{query}{salt}{domain}{secret_key}".encode("utf-8")
    return hashlib.md5(raw).hexdigest()


def redact(value: Any) -> Any:
    """Recursively redact likely credentials from a response/request structure."""
    secret_keys = re.compile(r"(api[_-]?key|secret|token|authorization|cookie|sign)", re.I)
    if isinstance(value, dict):
        return {k: ("<REDACTED>" if secret_keys.search(str(k)) else redact(v)) for k, v in value.items()}
    if isinstance(value, list):
        return [redact(item) for item in value]
    return value


def classify_http(status: int | None, payload: Any = None) -> tuple[str, str]:
    """Conservative status classification; caller should preserve evidence."""
    if status is None:
        return "network_failed", "low"
    if status == 401:
        return "authentication_failed", "high"
    if status == 403:
        return "permission_denied", "high"
    if status == 404:
        return "endpoint_not_found", "high"
    if status == 405:
        return "method_not_allowed", "high"
    if status == 415:
        return "content_type_rejected", "high"
    if status == 422:
        return "request_shape_rejected", "medium"
    if status == 429:
        return "rate_limited", "high"
    if status == 400:
        return "request_shape_rejected", "medium"
    if isinstance(payload, dict):
        text = json.dumps(payload, ensure_ascii=False).lower()
        if "unknown error code" in text or "not found" in text:
            return "endpoint_or_request_shape_rejected", "medium"
        if "error_code" in text:
            return "provider_error_code_received", "medium"
        if "api key not valid" in text or "api_key_invalid" in text:
            return "authentication_failed", "high"
        if any(word in text for word in ("quota", "insufficient balance", "余额", "配额")):
            return "quota_exceeded", "medium"
    if 200 <= status < 300:
        return "valid_translation_response", "medium"
    return "unknown_error", "low"


def write_result(provider: str, result: dict) -> Path:
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    result = {
        "provider": provider,
        "recorded_at": datetime.now(timezone.utc).isoformat(),
        **redact(result),
    }
    path = RESULTS_DIR / f"{provider}.json"
    path.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return path

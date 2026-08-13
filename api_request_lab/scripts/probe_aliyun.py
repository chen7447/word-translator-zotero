"""Aliyun Machine Translation RPC protocol probe.

Dry-run is default. --send uses placeholder credentials and records a redacted
response. This script does not import or modify the Zotero plugin.
"""

from __future__ import annotations

import argparse
import hashlib
import hmac
import json
import subprocess
import time
import urllib.parse
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
from probe_common import classify_http, write_result  # noqa: E402

ENDPOINT = "https://mt.cn-hangzhou.aliyuncs.com/"


def percent(value: str) -> str:
    return urllib.parse.quote(str(value), safe="-_.~")


def build_request(bad_path=False, missing_text=False, bad_action=False):
    params = {
        "AccessKeyId": "TEST_ACCESS_KEY_ID",
        "Action": "TranslateGeneral",
        "Format": "JSON",
        "FormatType": "text",
        "Scene": "general",
        "SignatureMethod": "HMAC-SHA1",
        "SignatureNonce": "TEST_NONCE",
        "SignatureVersion": "1.0",
        "SourceLanguage": "en",
        "SourceText": "environment",
        "TargetLanguage": "zh",
        "Timestamp": "2026-01-01T00:00:00Z",
        "Version": "2018-10-12",
    }
    if missing_text:
        params.pop("SourceText")
    if bad_action:
        params["Action"] = "BadAction"
    # RPC signing is intentionally generated with a placeholder secret.
    canonical = "&".join(f"{percent(k)}={percent(params[k])}" for k in sorted(params))
    string_to_sign = "POST&%2F&" + percent(canonical)
    digest = hmac.new(b"TEST_ACCESS_KEY_SECRET&", string_to_sign.encode(), hashlib.sha1).digest()
    params["Signature"] = __import__("base64").b64encode(digest).decode()
    endpoint = ENDPOINT + ("wrong" if bad_path else "")
    return endpoint, params


def send(endpoint: str, params: dict) -> dict:
    body = urllib.parse.urlencode(params)
    command = ["curl.exe", "-k", "-sS", "-X", "POST", endpoint, "-H", "Content-Type: application/x-www-form-urlencoded", "--data", body, "-w", "\n__HTTP_STATUS__:%{http_code}", "--max-time", "30"]
    try:
        completed = subprocess.run(command, capture_output=True, text=True, timeout=40)
        output = completed.stdout
        marker = "\n__HTTP_STATUS__:"
        if marker in output:
            raw, status_text = output.rsplit(marker, 1)
            status = int(status_text.strip())
        else:
            raw, status = output, None
        if completed.returncode != 0 and (status is None or status == 0):
            return {"status": None, "error": completed.stderr.strip() or output.strip()}
    except Exception as exc:
        return {"status": None, "error": type(exc).__name__ + ": " + str(exc)}
    try:
        payload = json.loads(raw)
    except Exception:
        payload = {"raw": raw[:1000]}
    classification, confidence = classify_http(status, payload)
    return {"status": status, "request": {"method": "POST", "endpoint": endpoint, "content_type": "application/x-www-form-urlencoded", "body_keys": sorted(params)}, "response": payload, "classification": classification, "confidence": confidence}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--send", action="store_true")
    parser.add_argument("--bad-path", action="store_true")
    parser.add_argument("--missing-text", action="store_true")
    parser.add_argument("--bad-action", action="store_true")
    args = parser.parse_args()
    endpoint, params = build_request(args.bad_path, args.missing_text, args.bad_action)
    print(json.dumps({"dry_run": not args.send, "endpoint": endpoint, "body_keys": sorted(params)}, indent=2))
    if not args.send:
        return
    result = send(endpoint, params)
    path = write_result("aliyun", {"probe": vars(args), **result})
    print(json.dumps(result, ensure_ascii=False, indent=2))
    print(f"recorded: {path}")


if __name__ == "__main__":
    main()

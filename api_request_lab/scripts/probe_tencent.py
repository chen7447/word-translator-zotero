"""Tencent Cloud TMT TextTranslate protocol probe (TC3-HMAC-SHA256).

Uses a simplified placeholder-signature request. No Zotero plugin code is imported.
Dry-run is default. --send sends the request through the proxy 127.0.0.1:7897.
"""

from __future__ import annotations

import argparse
import hashlib
import hmac
import json
import subprocess
import time
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
from probe_common import classify_http, write_result  # noqa: E402

ENDPOINT = "https://tmt.tencentcloudapi.com"


def build_request(bad_path=False, missing_text=False) -> tuple[str, dict, str, str]:
    endpoint = ENDPOINT + ("/wrong" if bad_path else "")
    secret_id = "TEST_SECRET_ID"
    secret_key = "TEST_SECRET_KEY"
    timestamp = str(int(time.time()))
    nonce = "9744"
    region = "ap-shanghai"
    project_id = "0"
    source = "en"
    target = "zh"
    action = "TextTranslate"
    version = "2018-03-21"
    source_text = "environment" if not missing_text else ""

    params = {
        "Action": action,
        "Version": version,
        "Region": region,
        "ProjectId": project_id,
        "Source": source,
        "SourceText": source_text,
        "Target": target,
        "Language": "zh-CN",
        "Nonce": nonce,
        "Timestamp": timestamp,
        "SecretId": secret_id,
    }
    sorted_keys = sorted(params)
    query_str = "&".join(f"{k}={params[k]}" for k in sorted_keys)
    string_to_sign = f"POST{ENDPOINT.replace('https://','')}/?{query_str}"
    digest = hmac.new(secret_key.encode(), string_to_sign.encode(), hashlib.sha1).digest()
    signature = __import__("base64").b64encode(digest).decode()
    body = f"{query_str}&Signature={signature}"
    return endpoint, params, body


def send(endpoint: str, body: str) -> dict:
    command = [
        "curl.exe", "-k", "-sS", "-X", "POST", endpoint,
        "-H", "Content-Type: application/x-www-form-urlencoded",
        "--data", body,
        "-w", "\n__HTTP_STATUS__:%{http_code}",
        "--max-time", "30",
    ]
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
    return {"status": status, "request": {"method": "POST", "endpoint": endpoint, "body_keys": sorted(body.split("&"))}, "response": payload, "classification": classification, "confidence": confidence}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--send", action="store_true", help="send with proxy 127.0.0.1:7897")
    parser.add_argument("--bad-path", action="store_true")
    parser.add_argument("--missing-text", action="store_true")
    args = parser.parse_args()
    endpoint, params, body = build_request(args.bad_path, args.missing_text)
    print(json.dumps({"dry_run": not args.send, "endpoint": endpoint, "body_keys": sorted(params)}, indent=2))
    if not args.send:
        return
    env = {"HTTP_PROXY": "http://127.0.0.1:7897", "HTTPS_PROXY": "http://127.0.0.1:7897", "ALL_PROXY": "http://127.0.0.1:7897"}
    merged = {**env, **{k: v for k, v in subprocess._clean_environ().items()}} if hasattr(subprocess, '_clean_environ') else env
    result = send(endpoint, body)
    path = write_result("tencent", {"probe": vars(args), **result})
    print(json.dumps(result, ensure_ascii=False, indent=2))
    print(f"recorded: {path}")


if __name__ == "__main__":
    main()
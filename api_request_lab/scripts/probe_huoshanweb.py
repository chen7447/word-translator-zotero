"""Huoshan Web (火山网页翻译) protocol probe. Free, no auth. Uses proxy 127.0.0.1:7897.
"""

from __future__ import annotations

import argparse
import json
import subprocess
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
from probe_common import classify_http, write_result

ENDPOINT = "https://translate.volcengine.com/crx/translate/v1"


def build_request(bad_path=False, missing_text=False):
    endpoint = ENDPOINT + ("-wrong" if bad_path else "")
    body = {"source_language": "en", "target_language": "zh", "text": "" if missing_text else "environment"}
    return endpoint, body


def send(endpoint, body):
    command = ["curl.exe", "-k", "-sS", "-X", "POST", endpoint, "-H", "Content-Type: application/json", "--data", json.dumps(body), "-w", "\n__HTTP_STATUS__:%{http_code}", "--max-time", "30"]
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
    return {"status": status, "request": {"method": "POST", "endpoint": endpoint, "body_keys": sorted(body)}, "response": payload, "classification": classification, "confidence": confidence}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--send", action="store_true")
    parser.add_argument("--bad-path", action="store_true")
    parser.add_argument("--missing-text", action="store_true")
    args = parser.parse_args()
    endpoint, body = build_request(args.bad_path, args.missing_text)
    print(json.dumps({"dry_run": not args.send, "endpoint": endpoint, "body_keys": sorted(body)}, indent=2))
    if not args.send:
        return
    result = send(endpoint, body)
    path = write_result("huoshanweb", {"probe": vars(args), **result})
    print(json.dumps(result, ensure_ascii=False, indent=2))
    print(f"recorded: {path}")


if __name__ == "__main__":
    main()
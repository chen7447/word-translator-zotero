"""Gemini generateContent protocol probe.

Dry-run is default. --send uses TEST_GEMINI_KEY in the query string and records
redacted responses. No Zotero plugin code is imported.
"""

from __future__ import annotations

import argparse
import json
import subprocess
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
from probe_common import classify_http, write_result  # noqa: E402

MODEL = "gemini-2.0-flash"
BASE = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent"


def build_request(bad_path=False, missing_parts=False, bad_content_type=False):
    endpoint = BASE + "-wrong" if bad_path else BASE
    body = {"contents": [{"parts": [{"text": "Translate environment into Chinese."}]}]}
    if missing_parts:
        body = {"contents": [{}]}
    return endpoint, body, bad_content_type


def send(endpoint: str, body: dict, bad_content_type: bool) -> dict:
    url = endpoint + "?key=TEST_GEMINI_KEY"
    content_type = "text/plain" if bad_content_type else "application/json"
    command = ["curl.exe", "-k", "-sS", "-X", "POST", url, "-H", f"Content-Type: {content_type}", "--data", json.dumps(body), "-w", "\n__HTTP_STATUS__:%{http_code}", "--max-time", "30"]
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
    return {"status": status, "request": {"method": "POST", "endpoint": endpoint, "content_type": content_type, "body_keys": sorted(body), "nested_shape": "contents[].parts[].text" if "parts" in str(body) else "contents[]"}, "response": payload, "classification": classification, "confidence": confidence}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--send", action="store_true")
    parser.add_argument("--bad-path", action="store_true")
    parser.add_argument("--missing-parts", action="store_true")
    parser.add_argument("--bad-content-type", action="store_true")
    args = parser.parse_args()
    endpoint, body, bad_content_type = build_request(args.bad_path, args.missing_parts, args.bad_content_type)
    print(json.dumps({"dry_run": not args.send, "endpoint": endpoint, "body_keys": sorted(body), "content_type": "text/plain" if bad_content_type else "application/json"}, indent=2))
    if not args.send:
        return
    result = send(endpoint, body, bad_content_type)
    path = write_result("gemini", {"probe": vars(args), **result})
    print(json.dumps(result, ensure_ascii=False, indent=2))
    print(f"recorded: {path}")


if __name__ == "__main__":
    main()

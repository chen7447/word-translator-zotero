"""DeepL official API protocol probe.

Dry-run is the default. --send uses a placeholder DeepL key and records only
redacted response data. No Zotero plugin code is imported.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import urllib.parse
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
from probe_common import classify_http, write_result  # noqa: E402

BASE = "https://api-free.deepl.com/v2/translate"


def build_request(bad_path: bool = False, missing_text: bool = False, bad_content_type: bool = False):
    endpoint = BASE + ("-wrong" if bad_path else "")
    body = {"text": ["environment"], "source_lang": "EN", "target_lang": "ZH"}
    if missing_text:
        body.pop("text")
    return endpoint, body, bad_content_type


def send(endpoint: str, body: dict, bad_content_type: bool) -> dict:
    encoded = json.dumps(body, ensure_ascii=False)
    content_type = "text/plain" if bad_content_type else "application/json"
    command = [
        "curl.exe", "-k", "-sS", "-X", "POST", endpoint,
        "-H", "Authorization: DeepL-Auth-Key TEST_DEEPL_KEY",
        "-H", f"Content-Type: {content_type}",
        "--data", encoded,
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
        if completed.returncode != 0 and status is None:
            return {"status": None, "error": completed.stderr.strip() or output.strip()}
    except Exception as exc:
        return {"status": None, "error": type(exc).__name__ + ": " + str(exc)}
    try:
        payload = json.loads(raw)
    except Exception:
        payload = {"raw": raw[:1000]}
    classification, confidence = classify_http(status, payload)
    return {
        "status": status,
        "request": {"method": "POST", "endpoint": endpoint, "content_type": content_type, "body_keys": sorted(body)},
        "response": payload,
        "classification": classification,
        "confidence": confidence,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--send", action="store_true")
    parser.add_argument("--bad-path", action="store_true")
    parser.add_argument("--missing-text", action="store_true")
    parser.add_argument("--bad-content-type", action="store_true")
    args = parser.parse_args()
    endpoint, body, bad_content_type = build_request(args.bad_path, args.missing_text, args.bad_content_type)
    print(json.dumps({"dry_run": not args.send, "endpoint": endpoint, "body_keys": sorted(body), "content_type": "text/plain" if bad_content_type else "application/json"}, indent=2))
    if not args.send:
        return
    result = send(endpoint, body, bad_content_type)
    path = write_result("deepl", {"probe": vars(args), **result})
    print(json.dumps(result, ensure_ascii=False, indent=2))
    print(f"recorded: {path}")


if __name__ == "__main__":
    main()

"""Baidu Translation protocol probe.

Default mode is dry-run: it prints the request shape without network access.
Use --send only after reviewing the generated URL. Placeholder credentials are
used by default, and all response data is written through redaction.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import time
import urllib.parse
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
from probe_common import baidu_field_sign, baidu_sign, classify_http, write_result  # noqa: E402

BASE = "https://api.fanyi.baidu.com/api/trans/vip/translate"
FIELD = "https://api.fanyi.baidu.com/api/trans/vip/fieldtranslate"


def build_query(field: bool = False, bad_path: bool = False, missing_field: bool = False) -> tuple[str, dict]:
    app_id = "TEST_APP_ID"
    secret = "TEST_SECRET_KEY"
    query = "environment"
    salt = str(int(time.time() * 1000))
    domain = "medicine"
    params = {
        "q": query,
        "from": "en",
        "to": "zh",
        "appid": app_id,
        "salt": salt,
    }
    if field:
        params["domain"] = domain
        params["sign"] = baidu_field_sign(app_id, query, salt, domain, secret)
        endpoint = FIELD
    else:
        params["sign"] = baidu_sign(app_id, query, salt, secret)
        params["action"] = "0"
        params["needIntervene"] = "1"
        endpoint = BASE
    if missing_field:
        params.pop("q", None)
    if bad_path:
        endpoint += "-wrong"
    return endpoint, params


def send(endpoint: str, params: dict) -> dict:
    url = endpoint + "?" + urllib.parse.urlencode(params)
    try:
        completed = subprocess.run(
            ["curl.exe", "-k", "-sS", "-w", "\\n__HTTP_STATUS__:%{http_code}", "--max-time", "30", url],
            capture_output=True,
            text=True,
            timeout=40,
        )
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
        "request": {"method": "GET", "endpoint": endpoint, "query_keys": sorted(params)},
        "response": payload,
        "classification": classification,
        "confidence": confidence,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--send", action="store_true", help="send the placeholder-credential request")
    parser.add_argument("--field", action="store_true", help="probe Baidu vertical-domain endpoint")
    parser.add_argument("--bad-path", action="store_true")
    parser.add_argument("--missing-field", action="store_true")
    args = parser.parse_args()
    endpoint, params = build_query(args.field, args.bad_path, args.missing_field)
    print(json.dumps({"dry_run": not args.send, "endpoint": endpoint, "query_keys": sorted(params)}, ensure_ascii=False, indent=2))
    if not args.send:
        return
    provider = "baidu-field" if args.field else "baidu"
    result = send(endpoint, params)
    path = write_result(provider, {"probe": vars(args), **result})
    print(json.dumps(result, ensure_ascii=False, indent=2))
    print(f"recorded: {path}")


if __name__ == "__main__":
    main()

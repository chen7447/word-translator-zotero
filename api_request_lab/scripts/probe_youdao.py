"""Youdao (有道网页翻译) protocol probe. Free, no auth. Proxy: 127.0.0.1:7897.
"""

from __future__ import annotations
import argparse, json, subprocess, urllib.parse
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent))
from probe_common import classify_http, write_result

BASE = "http://fanyi.youdao.com/translate"

def build_request(bad_path=False, missing_i=False):
    params = {"doctype": "json", "type": "EN2ZH_CN", "i": "" if missing_i else "environment"}
    endpoint = BASE + ("-wrong" if bad_path else "")
    return endpoint, params

def send(endpoint, params):
    url = endpoint + "?" + urllib.parse.urlencode(params)
    cmd = ["curl.exe", "-k", "-sS", "-G", url, "-w", "\n__HTTP_STATUS__:%{http_code}", "--max-time", "30"]
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=40); out = r.stdout; m = "\n__HTTP_STATUS__:"
        if m in out: raw, s = out.rsplit(m, 1); status = int(s.strip())
        else: raw, status = out, None
        if r.returncode != 0 and (status is None or status == 0): return {"status": None, "error": r.stderr.strip() or out.strip()}
    except Exception as e: return {"status": None, "error": type(e).__name__ + ": " + str(e)}
    try: payload = json.loads(raw)
    except: payload = {"raw": raw[:1000]}
    c, cf = classify_http(status, payload)
    return {"status": status, "request": {"method": "GET", "endpoint": endpoint, "query_keys": sorted(params)}, "response": payload, "classification": c, "confidence": cf}

def main():
    p = argparse.ArgumentParser(); p.add_argument("--send", action="store_true"); p.add_argument("--bad-path", action="store_true"); p.add_argument("--missing-i", action="store_true")
    a = p.parse_args(); endpoint, params = build_request(a.bad_path, a.missing_i)
    print(json.dumps({"dry_run": not a.send, "endpoint": endpoint, "query_keys": sorted(params)}, indent=2))
    if not a.send: return
    result = send(endpoint, params); path = write_result("youdao", {"probe": vars(a), **result})
    print(json.dumps(result, ensure_ascii=False, indent=2)); print(f"recorded: {path}")

if __name__ == "__main__": main()
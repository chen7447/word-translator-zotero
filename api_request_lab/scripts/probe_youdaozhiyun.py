"""YoudaoZhiyun (有道智云) translation probe. HMAC-SHA256 sign. Proxy: 127.0.0.1:7897.
"""

from __future__ import annotations
import argparse, hashlib, json, subprocess, time, urllib.parse
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent))
from probe_common import classify_http, write_result

ENDPOINT = "https://openapi.youdao.com/api"

def truncate(q):
    return q if len(q) <= 20 else q[:10] + str(len(q)) + q[-10:]

def sign_sha256(appid, query, salt, curtime, key):
    raw = f"{appid}{truncate(query)}{salt}{curtime}{key}"
    return hashlib.sha256(raw.encode()).hexdigest()

def build_request(bad_path=False, missing_q=False):
    appid, key = "TEST_APP_ID", "TEST_KEY"
    q = "" if missing_q else "environment"
    salt = str(int(time.time() * 1000))
    curtime = str(int(time.time()))
    sign = sign_sha256(appid, q, salt, curtime, key)
    params = {"q": q, "from": "en", "to": "zh", "appKey": appid, "salt": salt, "sign": sign, "signType": "v3", "curtime": curtime, "vocabId": "", "domain": "general"}
    endpoint = ENDPOINT + ("-wrong" if bad_path else "")
    return endpoint, params

def send(endpoint, params):
    url = endpoint + "?" + urllib.parse.urlencode(params)
    cmd = ["curl.exe", "-k", "-sS", "-G", url, "-H", "Content-Type: application/x-www-form-urlencoded", "-w", "\n__HTTP_STATUS__:%{http_code}", "--max-time", "30"]
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=40)
        out = r.stdout; m = "\n__HTTP_STATUS__:"
        if m in out: raw, s = out.rsplit(m, 1); status = int(s.strip())
        else: raw, status = out, None
        if r.returncode != 0 and (status is None or status == 0): return {"status": None, "error": r.stderr.strip() or out.strip()}
    except Exception as e: return {"status": None, "error": type(e).__name__ + ": " + str(e)}
    try: payload = json.loads(raw)
    except: payload = {"raw": raw[:1000]}
    c, cf = classify_http(status, payload)
    return {"status": status, "request": {"method": "GET", "endpoint": endpoint, "query_keys": sorted(params)}, "response": payload, "classification": c, "confidence": cf}

def main():
    p = argparse.ArgumentParser(); p.add_argument("--send", action="store_true"); p.add_argument("--bad-path", action="store_true"); p.add_argument("--missing-q", action="store_true")
    a = p.parse_args(); endpoint, params = build_request(a.bad_path, a.missing_q)
    print(json.dumps({"dry_run": not a.send, "endpoint": endpoint, "query_keys": sorted(params)}, indent=2))
    if not a.send: return
    result = send(endpoint, params); path = write_result("youdaozhiyun", {"probe": vars(a), **result})
    print(json.dumps(result, ensure_ascii=False, indent=2)); print(f"recorded: {path}")

if __name__ == "__main__": main()
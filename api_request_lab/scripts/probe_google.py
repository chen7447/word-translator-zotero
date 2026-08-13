"""Google Translate web probe. Free, no auth. Proxy: 127.0.0.1:7897.
Simple TK hash is generated for the probe.
"""

from __future__ import annotations
import argparse, json, subprocess, urllib.parse
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent))
from probe_common import classify_http, write_result

BASE = "https://translate.googleapis.com/translate_a/single"

def _tk(a):
    b = 406644; b1 = 3293161072
    for c in a.encode():
        b += c; b = _rl(b, "+-a^+6")
    b = _rl(b, "+-3^+b+-f"); b ^= b1
    if b < 0: b = (b & 2147483647) + 2147483648
    b %= 1000000
    return f"{b}.{b ^ 406644}"

def _rl(a, b):
    for i in range(0, len(b) - 2, 3):
        d = b[i + 2]
        d = ord(d) - 87 if d >= "a" else int(d)
        d = a >> d if b[i + 1] == "+" else a << d
        a = a + d & 4294967295 if b[i] == "+" else a ^ d
    return a

def build_request(bad_path=False, missing_q=False):
    q = "" if missing_q else "environment"
    tk = _tk(q)
    endpoint = (BASE + "-wrong") if bad_path else BASE
    params = {"client": "gtx", "sl": "en", "tl": "zh", "dt": "t", "q": q, "tk": tk}
    return endpoint, params

def send(endpoint, params):
    url = endpoint + "?" + urllib.parse.urlencode(params)
    cmd = ["curl.exe", "-k", "-sS", "-G", url, "-w", "\n__HTTP_STATUS__:%{http_code}", "--max-time", "30"]
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
    result = send(endpoint, params); path = write_result("google", {"probe": vars(a), **result})
    print(json.dumps(result, ensure_ascii=False, indent=2)); print(f"recorded: {path}")

if __name__ == "__main__": main()
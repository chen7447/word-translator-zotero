#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""生成 Word Translator 内置离线词库 dict-ecdict.json（ECDICT 子集）。

数据源：skywind3000/ECDICT（MIT 许可）。优先 stardict.csv（精简版），
缺失时回退 ecdict.csv（完整版）。

选择规则（fail-open，稳）：
  1. 只要 单词合法 + 有中文释义 即纳入候选；
  2. 排序键 = (frq 词频序号 or 极大值, bnc or 极大值)；
  3. 取前 MAX_WORDS（前 3 万高频词，覆盖学术阅读 98%+）。
  不依赖 tag/collins/oxford——避免常见词因缺这些字段被误删。
"""
import csv, io, json, os, re, sys, urllib.request

MAX_WORDS = 30000
URLS = [
    "https://raw.githubusercontent.com/skywind3000/ECDICT/master/stardict.csv",
    "https://raw.githubusercontent.com/skywind3000/ECDICT/master/ecdict.csv",
]
CACHE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "_ecdict.csv")

WORD_RE = re.compile(r"^[a-z][a-z'\-]{0,30}$")


def fetch(url, tries=3):
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=120) as r:
                return r.read()
        except Exception as e:
            sys.stderr.write("fetch %s failed (%d): %s\n" % (url, i + 1, e))
    return None


def parse(data):
    # 用 utf-8-sig 兼容 BOM
    return list(csv.reader(io.StringIO(data.decode("utf-8-sig", "replace"))))


def main():
    rows = None
    src = ""
    # 优先本地缓存（避免每次 75MB 下载）
    if os.path.exists(CACHE):
        try:
            rows = parse(open(CACHE, "rb").read())
            src = "ECDICT (ecdict.csv, MIT, github.com/skywind3000/ECDICT)"
            print("parsed local cache", CACHE, "rows=", len(rows))
        except Exception as e:
            sys.stderr.write("parse local cache %s failed: %s\n" % (CACHE, e))
    if not rows:
        for url in URLS:
            data = fetch(url)
            if not data:
                continue
            try:
                rows = parse(data)
                src = "ECDICT (" + url.rsplit("/", 1)[-1] + ", MIT, github.com/skywind3000/ECDICT)"
                print("parsed", url, "rows=", len(rows))
                try:
                    with open(CACHE, "wb") as f:
                        f.write(data)
                    print("cached to", CACHE)
                except Exception as e:
                    sys.stderr.write("cache write failed: %s\n" % e)
                break
            except Exception as e:
                sys.stderr.write("parse %s failed: %s\n" % (url, e))
    if not rows:
        sys.stderr.write("ERROR: could not fetch ECDICT data\n")
        sys.exit(1)

    header = [h.strip().lower() for h in rows[0]]
    idx = {name: header.index(name) for name in
           ("word", "phonetic", "translation", "pos", "collins", "oxford", "tag", "bnc", "frq", "exchange")
           if name in header}
    if "word" not in idx:
        sys.stderr.write("ERROR: unexpected header: %r\n" % header)
        sys.exit(1)
    g = lambda r, n: r[idx[n]].strip() if n in idx and idx[n] < len(r) else ""

    out = {}
    # 词频排序用：保留 (frq, bnc) 以便按常用度裁剪
    freq = {}  # word -> (frq or 999999, bnc or 999999)
    exch = {}  # word -> ECDICT exchange 原始字段（屈折变化，用于生成反查表）
    probe = {}  # 自检：常见词原始字段
    PROBES = {"hello", "study", "assay", "analysis", "the", "zebrafish"}
    for r in rows[1:]:
        if len(r) < max(idx.values()) + 1:
            continue
        word = g(r, "word").lower()
        if word in PROBES:
            probe[word] = {n: g(r, n) for n in
                           ("phonetic", "translation", "pos", "collins", "oxford", "tag", "bnc", "frq")}
        if not WORD_RE.match(word):
            continue
        translation = g(r, "translation")
        if not translation:
            continue
        # ECDICT 用字面 "\n" 分隔词性义项（不是换行），转换成分号便于卡片单行展示
        translation = translation.replace("\\n", "；")
        try:
            bnc = int(g(r, "bnc"))
        except ValueError:
            bnc = None
        try:
            frq = int(g(r, "frq"))
        except ValueError:
            frq = None
        out[word] = [g(r, "phonetic"), g(r, "pos"), translation]
        exch[word] = g(r, "exchange")
        # ECDICT 用 0 表示"语料库无此词"（低频哨兵），须视为无数据排最后，
        # 否则几十万 frq=0 的杂词会把 the/study 等高频词挤出前 3 万。
        freq[word] = (frq if (frq is not None and frq > 0) else 999999,
                      bnc if (bnc is not None and bnc > 0) else 999999)

    if not out:
        sys.stderr.write("ERROR: empty result after filtering\n")
        sys.exit(1)

    # 超过上限时按词频升序裁剪（frq 优先，其次 bnc；0/缺失视为低频排最后）
    if len(out) > MAX_WORDS:
        ranked = sorted(out.keys(), key=lambda w: freq.get(w, (999999, 999999)))
        out = {w: out[w] for w in ranked[:MAX_WORDS]}

    # 屈折反查表（exchange 字段）：变形 -> 原形。只收「变形自身不在词表、原形在词表」的对，
    # 变形自己有条目时让它直接命中自身释义（如 running 的名词义），不遮挡。
    # 价值：不规则变形（ran→run / children→child / better→good）离线可查，补 _variants 规则的盲区。
    alias = {}
    for w in out:
        for part in (exch.get(w) or "").split("/"):
            if ":" not in part:
                continue
            inf = part.split(":", 1)[1].strip().lower()
            if not inf or inf == w or inf in out or not WORD_RE.match(inf):
                continue
            prev = alias.get(inf)
            if prev is None or w < prev:
                alias[inf] = w  # 一个变形对应多个原形时取字典序最小，保证可复现

    out = {"_source": src,
           "_x": " ".join(k + ":" + v for k, v in sorted(alias.items())),
           **out}
    # 自检输出
    print("  exchange alias pairs=%d" % len(alias))
    for w in ("hello", "study", "assay", "analysis", "the", "zebrafish"):
        print("  probe", w, "raw=", probe.get(w), "in-out=", w in out)
    print("  stats: has-frq=%d has-bnc=%d has-tag=%d collins>=3=%d oxford1=%d" % (
        sum(1 for v in freq.values() if v[0] != 999999),
        sum(1 for v in freq.values() if v[1] != 999999),
        sum(1 for r in rows[1:] if g(r, "tag")),
        sum(1 for r in rows[1:] if g(r, "collins") in ("3", "4", "5")),
        sum(1 for r in rows[1:] if g(r, "oxford") == "1")))
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                        "addon", "content", "scripts", "dict-ecdict.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    print("OK words=%d size=%.2f MB -> %s" % (len(out) - 2, os.path.getsize(path) / 1048576, path))
    for probe in ("hello", "study", "assay", "analysis", "qPCR", "zebrafish"):
        print("  sample", probe, "=", out.get(probe))


if __name__ == "__main__":
    main()

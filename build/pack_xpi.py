#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Word Translator for Zotero - XPI packer (entries without ./ prefix)

排除规则：发布包不应包含临时验证脚本、备份文件、构建脚本、版本控制目录。
  - _chk*.js / _verify.js : 打包前的临时校验脚本
  - *.bak*                : 手动备份（如 addon.js.bak-*）
  - *.py                  : 构建脚本本身；bridge.ps1 需要随插件打包
  - .git / __pycache__    : 版本控制与 Python 缓存
"""
import zipfile, os, sys

SKIP_PREFIXES = (".git", "__pycache__")
SKIP_NAMES = {"_chk1.js", "_chk2.js", "_chk3.js", "_verify.js"}
SKIP_EXTS = (".py",)  # 排除构建脚本；bridge.ps1 需要打包进 XPI

def is_skipped(name):
    if name in SKIP_NAMES:
        return True
    if name.startswith(SKIP_PREFIXES):
        return True
    low = name.lower()
    if low.endswith(SKIP_EXTS) or ".bak" in low:
        return True
    return False

def add_all(zf, root, prefix=""):
    for name in sorted(os.listdir(root)):
        full = os.path.join(root, name)
        arc = name if not prefix else prefix + "/" + name
        if is_skipped(name):
            continue
        if os.path.isdir(full):
            add_all(zf, full, arc)
        else:
            zf.write(full, arc)

def main():
    addon = sys.argv[1]
    out = sys.argv[2]
    if os.path.exists(out):
        os.remove(out)
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as zf:
        add_all(zf, addon)
    print("OK", os.path.getsize(out))

if __name__ == "__main__":
    main()
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Word Translator for Zotero - XPI packer (entries without ./ prefix)"""
import zipfile, os, sys

def add_all(zf, root, prefix=""):
    for name in sorted(os.listdir(root)):
        full = os.path.join(root, name)
        arc = name if not prefix else prefix + "/" + name
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

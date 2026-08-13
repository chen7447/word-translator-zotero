# -*- coding: utf-8 -*-
from PIL import Image
from collections import Counter
import colorsys

path = r"F:\zotero插件\单词翻译\icon1.3.png"
img = Image.open(path).convert("RGB")
w, h = img.size
px = img.load()
print("size", w, h)

counter = Counter()
for y in range(0, h, 4):
    for x in range(0, w, 4):
        r, g, b = px[x, y]
        counter[(r, g, b)] += 1

print("top colors (sampled):")
for color, count in counter.most_common(15):
    print(f"  {color}  count={count}")

buckets = Counter()
for y in range(0, h, 4):
    for x in range(0, w, 4):
        r, g, b = px[x, y]
        hsv = colorsys.rgb_to_hsv(r/255, g/255, b/255)
        bucket = "dark" if hsv[2] < 0.35 else ("mid" if hsv[2] < 0.7 else "bright")
        sat = "sat" if hsv[1] > 0.3 else "gray"
        buckets[(bucket, sat)] += 1

print("bucket distribution:")
for k, v in buckets.most_common():
    print(f"  {k}: {v}")

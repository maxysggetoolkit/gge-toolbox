#!/usr/bin/env python3
"""Attach Goodgame CDN image URLs to decorations.json using the game DLL asset map.
Usage: add_images.py <dll.js> <decorations.json>"""
import re, json, sys

ASSET_ROOT = "https://empire-html5.goodgamestudios.com/default/assets/"
dll_path, data_path = sys.argv[1], sys.argv[2]
dll = open(dll_path, encoding="utf-8", errors="ignore").read()

# Index every building render path by the asset token after "Deco_Building_".
# Keyed broadly so recoloured/variant decos (ExaltedGreen…, …WithEffect) resolve.
loose = {}
for p in re.findall(r"itemassets/Building/[A-Za-z0-9_/]+--\d+", dll):
    base = re.sub(r"--\d+$", "", p.split("/")[-1])          # Deco_Building_<token>
    m = re.match(r"Deco_Building_(.+)", base)
    if m:
        loose.setdefault(m.group(1).lower(), p)


def resolve(t):
    if not t:
        return None
    tl = t.lower()
    if tl in loose:                          # exact
        return loose[tl]
    for k, v in loose.items():               # deco token fully inside an asset token
        if len(tl) >= 5 and tl in k:
            return v
    for k, v in loose.items():               # asset token inside deco token
        if len(k) >= 5 and k in tl:
            return v
    return None


data = json.load(open(data_path))
hit = 0
for it in data["items"]:
    path = resolve(it.get("type"))
    if path:
        it["img"] = ASSET_ROOT + path + ".webp"
        hit += 1
    it.pop("type", None)
json.dump(data, open(data_path, "w"), separators=(",", ":"))
print(f"  images: {hit}/{len(data['items'])} decorations")

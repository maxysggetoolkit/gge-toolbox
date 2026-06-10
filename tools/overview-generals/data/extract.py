#!/usr/bin/env python3
"""
Generals extractor — Maxy's Empire Toolkit.
All player-obtainable generals with rarity, level caps and their attack/defence
abilities (names + value-free short descriptions from lang, so the text stays
accurate at every ability level). Portraits + ability icons from the DLL map.
Run: python3 extract.py [ggs.dll.js path]
"""
import json, sys, os, re, urllib.request

ITEMS_URL = "https://raw.githubusercontent.com/GeneralsCamp/ggempire-data-cache/main/public/data/empire/items_latest.json"
LANG_URL  = "https://raw.githubusercontent.com/GeneralsCamp/ggempire-data-cache/main/public/data/lang/en.json"
DLL_URL   = "https://raw.githubusercontent.com/GeneralsCamp/ggempire-data-cache/main/public/data/empire/dll/ggs.dll.latest.js"
CDN       = "https://empire-html5.goodgamestudios.com/default/assets/"
OUT       = os.path.join(os.path.dirname(__file__), "generals.json")


def fetch(url, label):
    print(f"  Downloading {label}…", file=sys.stderr)
    with urllib.request.urlopen(url) as r:
        return r.read().decode("utf-8")


def main():
    d    = json.loads(fetch(ITEMS_URL, "items_latest.json"))
    lang = {k.lower(): v for k, v in json.loads(fetch(LANG_URL, "lang/en.json")).items()
            if isinstance(v, str)}

    dll_path = sys.argv[1] if len(sys.argv) > 1 else None
    if dll_path and os.path.exists(dll_path):
        dll = open(dll_path, encoding="utf-8", errors="ignore").read()
    else:
        dll = fetch(DLL_URL, "ggs.dll.latest.js")

    portraits = {}
    for m in re.finditer(r"itemassets/General/Portrait/GeneralPortrait_(\d+)/[A-Za-z0-9_]+--\d+", dll):
        portraits.setdefault(m.group(1), m.group(0))
    ability_icons = {}
    for m in re.finditer(r"itemassets/General/Abilities/GeneralsAbilityGroup_(\d+)/[A-Za-z0-9_]+--\d+", dll):
        ability_icons.setdefault(m.group(1), m.group(0))

    # slotID -> [abilityGroupID, ...]
    slot_groups = {}
    for s in d.get("generalSlots", []):
        gids = [g.strip() for g in str(s.get("abilityGroupIDs", "")).split(",") if g.strip()]
        slot_groups[str(s.get("slotID", ""))] = gids

    def ability(gid, side):
        name = lang.get(f"generals_abilities_name_{gid}", "")
        desc = lang.get(f"generals_abilities_desc_short_{side}_{gid}", "")
        if not name:
            return None
        icon = ability_icons.get(gid)
        return {
            "name": name,
            "desc": desc,
            "icon": CDN + icon + ".webp" if icon else "",
        }

    def abilities_for(slots_csv, side):
        out, seen = [], set()
        for slot in [s.strip() for s in str(slots_csv or "").split(",") if s.strip()]:
            for gid in slot_groups.get(slot, []):
                if gid in seen:
                    continue
                seen.add(gid)
                a = ability(gid, side)
                if a:
                    out.append(a)
        return out

    gens_out = []
    for g in d.get("generals", []):
        if str(g.get("isNPCGeneral", "")) == "1" or str(g.get("isPreview", "")) == "1":
            continue
        gid    = str(g.get("generalID", ""))
        rid    = str(g.get("generalRarityID", ""))
        rarity = lang.get(f"generals_rarity_{rid}", "")
        port   = portraits.get(gid)
        gens_out.append({
            "id":       gid,
            "name":     g.get("generalName", f"General {gid}"),
            "rarity":   rarity,
            "rarityID": int(rid or 0),
            "maxLevel": int(g.get("maxLevel", 0) or 0),
            "maxStars": int(g.get("maxStarLevel", 0) or 0),
            "attack":   abilities_for(g.get("attackSlots"), "attack"),
            "defense":  abilities_for(g.get("defenseSlots"), "defense"),
            "img":      CDN + port + ".webp" if port else "",
        })

    gens_out.sort(key=lambda x: (-x["rarityID"], x["name"]))
    out = {"generated": __import__("datetime").date.today().isoformat(), "generals": gens_out}
    with open(OUT, "w") as f:
        json.dump(out, f, separators=(",", ":"))
    imgs = sum(1 for x in gens_out if x["img"])
    ab   = sum(len(x["attack"]) + len(x["defense"]) for x in gens_out)
    print(f"Wrote generals.json — {len(gens_out)} generals, {imgs} portraits, {ab} ability entries.",
          file=sys.stderr)


if __name__ == "__main__":
    main()

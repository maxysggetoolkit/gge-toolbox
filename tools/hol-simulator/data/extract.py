#!/usr/bin/env python3
"""
Hall of Legends skill extractor — Maxy's Empire Toolkit.
Two skill trees (Offense / Defense), each a set of skill groups with levels;
every HoL level grants one skill point. Outputs hol.json.
Run: python3 extract.py
"""
import json, sys, os, re, urllib.request
from collections import defaultdict

ITEMS_URL = "https://raw.githubusercontent.com/GeneralsCamp/ggempire-data-cache/main/public/data/empire/items_latest.json"
OUT = os.path.join(os.path.dirname(__file__), "hol.json")

# Tree 0 is the offensive tree, tree 1 the defensive one (confirmed by effect mix).
TREE_NAMES = {"0": "Offense", "1": "Defense"}

# Friendly labels + whether the value is a percent or a flat count.
EFFECTS = {
    "attackMeleeBonus":        ("Melee attack", "%"),
    "attackRangeBonus":        ("Ranged attack", "%"),
    "attackYardBonus":         ("Courtyard attack", "%"),
    "attackBonus":             ("Attack strength", "%"),
    "defenseMeleeBonus":       ("Melee defence", "%"),
    "defenseRangeBonus":       ("Ranged defence", "%"),
    "defenseYardBonus":        ("Courtyard defence", "%"),
    "defenseBonus":            ("Defence strength", "%"),
    "gateReduction":           ("Enemy gate protection", "-%"),
    "wallReduction":           ("Enemy wall protection", "-%"),
    "moatReduction":           ("Enemy moat protection", "-%"),
    "gateBonus":               ("Gate protection", "%"),
    "wallBonus":               ("Wall protection", "%"),
    "moatBonus":               ("Moat protection", "%"),
    "additionalUnitAmountOnWall":  ("Extra unit limit on walls", "%"),
    "additionalUnitAmountOnFlank": ("Extra unit limit on flanks", "%"),
    "additionalUnitAmountOnFront": ("Extra unit limit on front", "%"),
    "additionalAttackToolAmountFlank": ("Extra attack tools on flanks", "%"),
    "additionalDefenseToolSlotFlank":  ("Extra defence tool slot (flank)", ""),
    "additionalWave":          ("Extra attack wave", ""),
    "guardAmountBonus":        ("Guards", "%"),
    "additionalPeasantsAmount":("Extra peasants", "%"),
    "lootBonus":               ("Loot", "%"),
    "lootReduction":           ("Loot protection", "%"),
    "lootCapacityBonus":       ("Loot capacity", "%"),
    "honorBonus":              ("Honour", "%"),
    "cooldownReduction":       ("Cooldown reduction", "%"),
    "travelReturnPvPBoost":    ("Return speed (PvP)", "%"),
    "travelReturnPvEBoost":    ("Return speed (PvE)", "%"),
    "travelAttackBoost":       ("Attack travel speed", "%"),
    "travelConquerBoost":      ("Conquer travel speed", "%"),
    "travelCostReduction":     ("Travel cost reduction", "%"),
    "smashChanceBonus":        ("Smash chance", "%"),
    "fireBonus":               ("Fire defence", "%"),
    "fireBrigadeBonus":        ("Fire brigade", "%"),
    "magicFindBonus":          ("Magic find", "%"),
    "XPConstructionBonus":     ("Construction XP", "%"),
    "XPDefenseBonus":          ("Defence XP", "%"),
    "XPAttackPvPBonus":        ("Attack XP (PvP)", "%"),
    "XPAttackPvEBonus":        ("Attack XP (PvE)", "%"),
    "fameAttackBonus":         ("Glory on attack", "%"),
    "fameDefenseBonus":        ("Glory on defence", "%"),
    "spyAmountBonus":          ("Spies", "%"),
    "hideoutCapacityBonus":    ("Hideout capacity", "%"),
}


def prettify(et):
    if et in EFFECTS:
        return EFFECTS[et]
    label = re.sub(r"(?<!^)(?=[A-Z])", " ", et).replace("_", " ")
    label = label[0].upper() + label[1:]
    return (label, "%")


def num(v):
    try:
        f = float(v)
        return int(f) if f == int(f) else f
    except (TypeError, ValueError):
        return 0


def main():
    print("  Downloading items_latest.json…", file=sys.stderr)
    with urllib.request.urlopen(ITEMS_URL) as r:
        d = json.loads(r.read().decode("utf-8"))

    skills = d.get("legendskills", [])
    groups = defaultdict(list)
    for s in skills:
        groups[s["skillGroupID"]].append(s)

    trees = {"0": [], "1": []}
    for gid, rows in groups.items():
        rows.sort(key=lambda x: int(x["level"]))
        tree = str(rows[0]["skillTreeID"])
        et = rows[0]["effectType"]
        label, unit = prettify(et)
        levels = [{
            "level":      int(r.get("level", 0)),
            "value":      num(r.get("effectValue")),
            "cost":       num(r.get("costSkillPoints")),
            "totalValue": num(r.get("totalEffectValue")),
            "totalCost":  num(r.get("totalCostSkillPoints")),
        } for r in rows]
        trees.setdefault(tree, []).append({
            "group":      int(gid),
            "tier":       int(rows[0]["tier"]),
            "effectType": et,
            "label":      label,
            "unit":       unit,
            "maxLevel":   levels[-1]["level"],
            "maxValue":   levels[-1]["totalValue"],
            "maxCost":    levels[-1]["totalCost"],
            "levels":     levels,
        })

    for t in trees:
        trees[t].sort(key=lambda x: (x["tier"], x["group"]))

    out = {
        "generated": __import__("datetime").date.today().isoformat(),
        "trees": [
            {"id": tid, "name": TREE_NAMES.get(tid, "Tree " + tid), "skills": trees[tid]}
            for tid in sorted(trees, key=int)
        ],
    }
    with open(OUT, "w") as f:
        json.dump(out, f, separators=(",", ":"))
    tot = sum(len(t["skills"]) for t in out["trees"])
    print(f"Wrote hol.json — {len(out['trees'])} trees, {tot} skill groups.", file=sys.stderr)


if __name__ == "__main__":
    main()

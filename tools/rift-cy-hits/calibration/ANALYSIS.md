# Rift CY calculator — calibration pass 1 (6 reports, Fungal L12)

## Model (mirrors wall-break sim structure)
- Attacker CY strength = N × u × M + GiantSlayer
  - M = 1 + equipCY% + flameThrower% + warwagon5% + **0.60 fixed** (the "+60%" shown
    at the Courtyard step in every report — empirically constant)
  - GiantSlayer = 9% × defender total CY strength (per tooltip), cap 3× attacker
    strength (uncapped in all 6 reports — values ~25M regardless of army size)
- Defender CY strength = 280M  (derived: GS 25.2M ÷ 9%; = 1M units @ +400% → base ~56/unit)
- Winner's losses = N × (weaker/stronger)^1.5 ; loser loses 100% (classic GGE curve)

## Fit (pass 1)
- Single effective unit attack u = **2410** → rms error **16.7%** on losses
  (r2 +1%, r5 +7%, r6 −9%, r4 +18%, r3 −31%)
- r1 (Gzer, 100% wipe despite killing all 1M) is consistent ONLY with a ranged
  attack malus (×0.4) — i.e. fungal L12 nerfs ranged like necromancer does.
  Full-melee his hit models as a win; ranged-malused it models as the defeat it was.
- Residual spread is almost certainly REAL UNIT DIFFERENCES (players sent
  different L10 rift units; one fitted u can't capture that). v2: resolve unit
  stacks to real attack stats from troops-tools.json and refit a single global
  scale (like wall-break's ALPHA).

## What the remaining ~40 reports should ideally add
1. **Partial clears** — all 6 killed the full 1M, so the KILL curve (hits-to-clear
   for weaker hits) only has a lower bound. Reports where the CY was NOT fully
   cleared pin it directly. Even 3-4 of these are gold.
2. **Unit-stack screenshots** (or tell us which units the (10)-badge stacks are).
3. Points scored per hit if visible.
4. Any different boss level — even one L11/L13 report validates level scaling.

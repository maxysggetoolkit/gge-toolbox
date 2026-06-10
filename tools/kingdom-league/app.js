/* Kingdom League Calculator — reimplemented from the GeneralsCamp community tool.
   7 medals → points → rank (21 titles, +2000 pts/rank) + cheapest medal advice. */
(function () {
  "use strict";

  const TITLES = [
    "Brawler", "Wild brawler", "Adept brawler", "Skilled brawler",
    "Hunter", "Bounty hunter", "Expert hunter", "Master hunter",
    "Guard", "Castle guardian", "Noble guardian", "Throne guardian",
    "Warrior", "Gallant warrior", "Veteran warrior", "Heroic warrior",
    "Warlord", "Great warlord", "Supreme warlord", "Ultimate warlord",
    "Annihilator",
  ];
  const RANK_STEP = 2000;
  const STORE = "kingdom_league_v1";
  const MEDALS = [
    { key: "gold",   name: "Gold",   emoji: "🥇", points: 1000 },
    { key: "silver", name: "Silver", emoji: "🥈", points: 950 },
    { key: "bronze", name: "Bronze", emoji: "🥉", points: 850 },
    { key: "glass",  name: "Glass",  emoji: "🔷", points: 700 },
    { key: "copper", name: "Copper", emoji: "🟤", points: 500 },
    { key: "stone",  name: "Stone",  emoji: "🪨", points: 300 },
    { key: "wood",   name: "Wood",   emoji: "🪵", points: 100 },
  ];

  const fmt = (n) => (Number(n) || 0).toLocaleString("en-US");
  const $ = (id) => document.getElementById(id);

  // ---- Build inputs --------------------------------------------------------
  const grid = $("medal-grid");
  grid.innerHTML = MEDALS.map((m) =>
    `<div class="field kl-medal">
       <label for="m-${m.key}">${m.emoji} ${m.name} <span class="pts">${fmt(m.points)} pts</span></label>
       <input type="number" id="m-${m.key}" min="0" step="1" value="0" />
     </div>`).join("");
  $("medal-legend").textContent = MEDALS.map((m) => `${m.name} ${fmt(m.points)}`).join(" · ");

  const inputs = MEDALS.map((m) => ({ ...m, el: $("m-" + m.key) }));

  // ---- Persistence ---------------------------------------------------------
  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE) || "{}");
      inputs.forEach((m) => { if (saved[m.key] != null) m.el.value = saved[m.key]; });
    } catch (e) {}
  }
  function save() {
    const o = {};
    inputs.forEach((m) => { o[m.key] = m.el.value; });
    localStorage.setItem(STORE, JSON.stringify(o));
  }

  // ---- Maths ---------------------------------------------------------------
  const clean = (v) => { const n = parseInt(v, 10); return Number.isFinite(n) && n > 0 ? n : 0; };

  function totalPoints() {
    return inputs.reduce((sum, m) => {
      const c = clean(m.el.value); m.el.value = String(c);
      return sum + c * m.points;
    }, 0);
  }

  function rankFor(points) {
    return Math.min(TITLES.length, Math.floor(points / RANK_STEP) + 1);
  }

  /* Cheapest medal combination (fewest medals) reaching `need` points — the same
     bounded coin-change the source tool uses, picking the lowest overshoot. */
  function cheapestMedals(need) {
    if (need <= 0) return "No additional medals needed.";
    const cap = need + MEDALS[0].points;          // allow a little overshoot
    const best = Array(cap + 1).fill(Infinity);
    const prev = Array(cap + 1).fill(-1);
    best[0] = 0;
    for (let s = 1; s <= cap; s++) {
      for (let i = 0; i < MEDALS.length; i++) {
        const p = MEDALS[i].points;
        if (s >= p && best[s - p] + 1 < best[s]) { best[s] = best[s - p] + 1; prev[s] = i; }
      }
    }
    let target = -1, fewest = Infinity;
    for (let s = need; s <= cap; s++) {
      if (best[s] < fewest) { fewest = best[s]; target = s; }
    }
    if (target < 0) return "No medal combination found.";
    const counts = Array(MEDALS.length).fill(0);
    for (let c = target; c > 0;) { const i = prev[c]; if (i < 0) break; counts[i]++; c -= MEDALS[i].points; }
    const parts = counts
      .map((c, i) => ({ c, name: MEDALS[i].name }))
      .filter((x) => x.c > 0)
      .map((x) => `${x.c}× ${x.name}`);
    const over = target - need;
    return `${parts.join(" + ")} <span class="dim">(${fmt(target)} pts${over > 0 ? `, +${fmt(over)} over` : " exact"})</span>`;
  }

  // ---- Render --------------------------------------------------------------
  function render() {
    const total = totalPoints();
    const rank = rankFor(total);
    $("total-points").textContent = fmt(total);
    $("current-title").textContent = `${TITLES[rank - 1]} (Rank ${rank})`;

    if (rank >= TITLES.length) {
      $("next-title").textContent = "Max rank";
      $("advice").textContent = "Already at the top title — Annihilator.";
      $("progress-label").textContent = "Maximum rank reached";
      $("progress-fill").style.width = "100%";
      save();
      return;
    }

    const nextRank = rank + 1;
    const floorPts = (rank - 1) * RANK_STEP;       // points at start of current rank
    const nextPts = (nextRank - 1) * RANK_STEP;    // threshold for next rank
    const need = Math.max(0, nextPts - total);
    const pct = Math.max(0, Math.min(100, Math.round(((total - floorPts) / RANK_STEP) * 100)));

    $("next-title").textContent = `${TITLES[nextRank - 1]} (Rank ${nextRank})`;
    $("progress-label").textContent = `${fmt(total - floorPts)} / ${fmt(RANK_STEP)} into rank ${rank} — ${fmt(need)} pts to ${TITLES[nextRank - 1]}`;
    $("progress-fill").style.width = pct + "%";
    $("advice").innerHTML = cheapestMedals(need);
    save();
  }

  inputs.forEach((m) => { m.el.addEventListener("input", render); });
  load();
  render();
})();

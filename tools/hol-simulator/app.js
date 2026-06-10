/* Hall of Legends planner */
(function () {
  "use strict";

  const STORE = "hol_build_v1";
  let TREES = [];
  let build = {};        // group -> selected level
  let budget = 100;

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  }
  function fmtVal(v, unit) {
    if (unit === "-%") return "−" + v + "%";
    if (unit === "%") return "+" + v + "%";
    return "+" + v;
  }

  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(STORE) || "{}");
      build = s.build || {};
      budget = s.budget != null ? s.budget : 100;
    } catch (e) { build = {}; }
  }
  function save() {
    localStorage.setItem(STORE, JSON.stringify({ build, budget }));
  }

  function skillByGroup(g) {
    for (const t of TREES) {
      const s = t.skills.find((x) => x.group === g);
      if (s) return s;
    }
    return null;
  }

  function levelInfo(skill, lvl) {
    if (lvl <= 0) return { value: 0, cost: 0 };
    const row = skill.levels[Math.min(lvl, skill.levels.length) - 1];
    return { value: row.totalValue, cost: row.totalCost };
  }

  function spentPoints() {
    let total = 0;
    for (const [g, lvl] of Object.entries(build)) {
      const sk = skillByGroup(+g);
      if (sk && lvl > 0) total += levelInfo(sk, lvl).cost;
    }
    return total;
  }

  function recompute() {
    // Totals by effect label
    const totals = {};
    for (const [g, lvl] of Object.entries(build)) {
      const sk = skillByGroup(+g);
      if (!sk || lvl <= 0) continue;
      const v = levelInfo(sk, lvl).value;
      const key = sk.label + "|" + sk.unit;
      totals[key] = (totals[key] || 0) + v;
    }

    const totalsEl = document.getElementById("totals");
    const keys = Object.keys(totals);
    if (!keys.length) {
      totalsEl.innerHTML = '<p class="muted">Add some skills below to see totals.</p>';
    } else {
      keys.sort((a, b) => totals[b] - totals[a]);
      totalsEl.innerHTML = keys.map((k) => {
        const [label, unit] = k.split("|");
        return '<div class="hol-tot"><div class="v">' + fmtVal(totals[k], unit) +
          '</div><div class="k">' + esc(label) + "</div></div>";
      }).join("");
    }

    const spent = spentPoints();
    const spentEl = document.getElementById("spent");
    const over = spent > budget;
    spentEl.className = "hol-spent" + (over ? " over" : "");
    spentEl.innerHTML = "Spent <b>" + spent.toLocaleString() + "</b> / " +
      budget.toLocaleString() + " pts" +
      (over ? " — <b>over budget</b>" : " · <b>" + (budget - spent).toLocaleString() + "</b> left");
  }

  function setLevel(group, lvl) {
    const sk = skillByGroup(group);
    if (!sk) return;
    lvl = Math.max(0, Math.min(lvl, sk.maxLevel));
    if (lvl === 0) delete build[group]; else build[group] = lvl;
    save();
    updateSkillRow(group);
    recompute();
  }

  function updateSkillRow(group) {
    const row = document.querySelector('.hol-skill[data-g="' + group + '"]');
    if (!row) return;
    const sk = skillByGroup(group);
    const lvl = build[group] || 0;
    const info = levelInfo(sk, lvl);
    row.classList.toggle("active", lvl > 0);
    row.querySelector(".hol-lvl").textContent = lvl + " / " + sk.maxLevel;
    row.querySelector(".hol-skill-val").innerHTML =
      "<b>" + fmtVal(info.value, sk.unit) + "</b> · " + info.cost + " pts";
    row.querySelector(".step-dec").disabled = lvl <= 0;
    row.querySelector(".step-inc").disabled = lvl >= sk.maxLevel;
  }

  function renderTrees() {
    const host = document.getElementById("trees");
    host.innerHTML = "";
    TREES.forEach((tree) => {
      const col = document.createElement("div");
      col.className = "hol-tree";
      const cls = tree.name.toLowerCase().startsWith("off") ? "off" : "def";
      const maxCost = tree.skills.reduce((a, s) => a + s.maxCost, 0);
      col.innerHTML = '<div class="hol-tree-head ' + cls + '">' +
        (cls === "off" ? "⚔️ " : "🛡️ ") + esc(tree.name) + "</div>" +
        '<div class="hol-tree-sub">' + tree.skills.length + " skills · " + maxCost + " pts to max</div>";

      const tiers = [...new Set(tree.skills.map((s) => s.tier))].sort((a, b) => a - b);
      tiers.forEach((tier) => {
        const wrap = document.createElement("div");
        wrap.className = "hol-tier";
        wrap.innerHTML = '<div class="hol-tier-label">Tier ' + tier + "</div>";
        tree.skills.filter((s) => s.tier === tier).forEach((sk) => {
          const lvl = build[sk.group] || 0;
          const info = levelInfo(sk, lvl);
          const row = document.createElement("div");
          row.className = "hol-skill" + (lvl > 0 ? " active" : "");
          row.dataset.g = sk.group;
          row.innerHTML =
            '<div class="hol-skill-info">' +
              '<div class="hol-skill-name">' + esc(sk.label) + "</div>" +
              '<div class="hol-skill-val"><b>' + fmtVal(info.value, sk.unit) + "</b> · " + info.cost + " pts</div>" +
            "</div>" +
            '<div class="hol-stepper">' +
              '<button class="hol-step-btn step-dec"' + (lvl <= 0 ? " disabled" : "") + ">−</button>" +
              '<span class="hol-lvl">' + lvl + " / " + sk.maxLevel + "</span>" +
              '<button class="hol-step-btn step-inc"' + (lvl >= sk.maxLevel ? " disabled" : "") + ">+</button>" +
            "</div>";
          row.querySelector(".step-dec").addEventListener("click", () => setLevel(sk.group, (build[sk.group] || 0) - 1));
          row.querySelector(".step-inc").addEventListener("click", () => setLevel(sk.group, (build[sk.group] || 0) + 1));
          wrap.appendChild(row);
        });
        col.appendChild(wrap);
      });
      host.appendChild(col);
    });
  }

  fetch("./data/hol.json")
    .then((r) => r.json())
    .then((d) => {
      TREES = d.trees;
      load();
      const bi = document.getElementById("budget");
      bi.value = budget;
      bi.addEventListener("input", () => { budget = +bi.value || 0; save(); recompute(); });
      document.getElementById("reset").addEventListener("click", () => {
        if (!confirm("Clear your whole HoL build?")) return;
        build = {}; save(); renderTrees(); recompute();
      });
      renderTrees();
      recompute();
    })
    .catch((e) => {
      document.getElementById("trees").innerHTML = '<p class="muted">Could not load HoL data.</p>';
      console.error(e);
    });
})();

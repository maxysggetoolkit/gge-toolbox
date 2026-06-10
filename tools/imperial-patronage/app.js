/* Imperial Patronage Simulator — reimplemented from the GeneralsCamp tool.
   Each currency donates points = floor(amount / ratio), capped per option at
   maxPoints. Sum points → reward tier. Data pre-resolved in data/patronage.json. */
(function () {
  "use strict";

  const STORE = "imperial_patronage_v1";
  const FALLBACK = "../../assets/img/tool-art/lootbox.webp";
  const $ = (id) => document.getElementById(id);
  const fmt = (n) => (Number(n) || 0).toLocaleString("en-US");

  let DATA = null;
  const state = { setId: "", typeId: "", points: {} }; // points: { "setId|typeId|optIdx": points }

  function save() { localStorage.setItem(STORE, JSON.stringify(state)); }
  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(STORE) || "{}");
      state.setId = s.setId || ""; state.typeId = s.typeId || ""; state.points = s.points || {};
    } catch (e) {}
  }

  const curSet = () => DATA.sets.find((s) => s.id === state.setId) || DATA.sets[DATA.sets.length - 1];
  const curType = () => { const s = curSet(); return s.types[state.typeId] || s.types[DATA.typeOrder.find((t) => s.types[t])]; };
  const pkey = (i) => `${curSet().id}|${state.typeId}|${i}`;
  const getPts = (i) => Number(state.points[pkey(i)]) || 0;
  function setPts(i, v, opt) {
    const max = opt.maxPoints == null ? Infinity : opt.maxPoints;
    state.points[pkey(i)] = Math.max(0, Math.min(max, Math.floor(Number(v) || 0)));
    save();
  }

  function totalPoints() {
    const t = curType();
    return t.options.reduce((sum, _, i) => sum + getPts(i), 0);
  }
  function currentTier(total) {
    let cur = null;
    curType().tiers.forEach((tr) => { if (tr.minPoints <= total) cur = tr; });
    return cur;
  }
  function nextTier(total) {
    return curType().tiers.find((tr) => tr.minPoints > total) || null;
  }

  // ---- render ----
  function renderSelectors() {
    $("setSelect").innerHTML = DATA.sets.slice().reverse().map((s) =>
      `<option value="${s.id}" ${s.id === curSet().id ? "selected" : ""}>${s.latest ? "Latest — " : ""}${s.label}</option>`).join("");
    const s = curSet();
    $("typeSelect").innerHTML = DATA.typeOrder.filter((t) => s.types[t]).map((t) =>
      `<option value="${t}" ${t === state.typeId ? "selected" : ""}>${s.types[t].label}</option>`).join("");
  }

  function renderRows() {
    const t = curType();
    $("rows").innerHTML = t.options.map((o, i) => {
      const pts = getPts(i);
      const cost = pts * o.ratio;
      const max = o.maxPoints == null ? Math.max(1000, pts) : o.maxPoints;
      return `<div class="ip-row" data-i="${i}">
        <img class="ip-cur" src="${o.img || FALLBACK}" alt="" onerror="this.src='${FALLBACK}'">
        <div>
          <div class="top"><span class="nm">${o.label}</span><span class="pts" data-pts>+${fmt(pts)} pts</span></div>
          <div class="ctrls">
            <input type="range" min="0" max="${max}" step="1" value="${pts}" data-range>
            <input type="number" min="0" max="${o.maxPoints ?? ""}" value="${pts}" data-num>
            <button class="ip-maxbtn" data-max>Max</button>
          </div>
          <div class="foot">1 pt = ${fmt(o.ratio)} ${o.label}${o.maxPoints != null ? ` · cap ${fmt(o.maxPoints)} pts` : ""} · costs ${fmt(cost)} <span data-cost></span></div>
        </div>
      </div>`;
    }).join("");
  }

  function renderResult() {
    const t = curType();
    const total = totalPoints();
    const cur = currentTier(total);
    const nxt = nextTier(total);
    $("totalPts").textContent = fmt(total);

    const base = cur ? cur.minPoints : 0;
    const span = nxt ? Math.max(1, nxt.minPoints - base) : 1;
    const pct = nxt ? Math.min(100, Math.round(((total - base) / span) * 100)) : 100;
    $("meterFill").style.width = pct + "%";
    $("toNext").textContent = nxt ? fmt(nxt.minPoints - total) : "Maxed";
    $("toNextLabel").textContent = nxt ? `Points to level ${nxt.level}` : "All levels reached";

    $("curLvl").textContent = cur ? `Level ${cur.level} · ${fmt(cur.minPoints)} pts` : "No level yet";
    $("curImg").src = cur && cur.img ? cur.img : FALLBACK;
    $("curName").textContent = cur ? cur.name : "—";
    $("nextLvl").textContent = nxt ? `Level ${nxt.level} · ${fmt(nxt.minPoints)} pts` : "—";
    $("nextImg").src = nxt && nxt.img ? nxt.img : FALLBACK;
    $("nextName").textContent = nxt ? nxt.name : "Top level reached";

    $("tierList").innerHTML = t.tiers.map((tr) =>
      `<tr class="${tr.minPoints <= total ? "reached" : ""}">
        <td class="num">${tr.level}</td>
        <td class="num">${fmt(tr.minPoints)}</td>
        <td><div class="ri"><img src="${tr.img || FALLBACK}" alt="" onerror="this.src='${FALLBACK}'"><span>${tr.name}</span></div></td>
        <td class="tick">${tr.minPoints <= total ? "✓" : ""}</td>
      </tr>`).join("");
  }

  function renderRowValue(i) {
    const row = $("rows").querySelector(`[data-i="${i}"]`);
    if (!row) return;
    const o = curType().options[i];
    const pts = getPts(i);
    row.querySelector("[data-pts]").textContent = `+${fmt(pts)} pts`;
    const range = row.querySelector("[data-range]");
    const num = row.querySelector("[data-num]");
    if (document.activeElement !== range) range.value = pts;
    if (document.activeElement !== num) num.value = pts;
    row.querySelector(".foot").innerHTML =
      `1 pt = ${fmt(o.ratio)} ${o.label}${o.maxPoints != null ? ` · cap ${fmt(o.maxPoints)} pts` : ""} · costs ${fmt(pts * o.ratio)}`;
  }

  function renderAll() { renderSelectors(); renderRows(); renderResult(); }

  function bind() {
    $("setSelect").addEventListener("change", (e) => {
      state.setId = e.target.value;
      const s = curSet();
      if (!s.types[state.typeId]) state.typeId = DATA.typeOrder.find((t) => s.types[t]);
      save(); renderAll();
    });
    $("typeSelect").addEventListener("change", (e) => { state.typeId = e.target.value; save(); renderAll(); });
    $("resetBtn").addEventListener("click", () => {
      curType().options.forEach((_, i) => { delete state.points[pkey(i)]; });
      save(); renderRows(); renderResult();
    });

    $("rows").addEventListener("input", (e) => {
      const row = e.target.closest("[data-i]"); if (!row) return;
      const i = +row.dataset.i; const o = curType().options[i];
      if (e.target.matches("[data-range]") || e.target.matches("[data-num]")) {
        setPts(i, e.target.value, o); renderRowValue(i); renderResult();
      }
    });
    $("rows").addEventListener("click", (e) => {
      if (!e.target.matches("[data-max]")) return;
      const row = e.target.closest("[data-i]"); const i = +row.dataset.i; const o = curType().options[i];
      setPts(i, o.maxPoints == null ? getPts(i) + 1000 : o.maxPoints, o);
      renderRowValue(i); renderResult();
    });
  }

  fetch("data/patronage.json").then((r) => r.json()).then((d) => {
    DATA = d;
    load();
    if (!DATA.sets.find((s) => s.id === state.setId)) state.setId = DATA.sets[DATA.sets.length - 1].id;
    const s = curSet();
    if (!s.types[state.typeId]) state.typeId = DATA.typeOrder.find((t) => s.types[t]);
    bind(); renderAll();
  }).catch((e) => {
    $("rows").innerHTML = "<p class='muted'>Could not load patronage data: " + e.message + "</p>";
  });
})();

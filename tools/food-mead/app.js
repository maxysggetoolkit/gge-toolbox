/* Food & Mead Production calculator.
   Structure output (farms, cattle farm, relic brewery) comes from the game data
   cache and is scaled by research + cast %. Build items and decorations add flat
   hourly bonuses. The brewery's food/honey draw is derived from its per-level
   food/honey ratios. Data: ./data/production.json (game data cache). */
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const num = (v) => Math.round(Number(v || 0)).toLocaleString();
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;" }[c]));

  let DATA = null;
  const FOOD_KEYS = ["farm", "relicFarm", "relicFarmGreen", "cattleFarm"];

  // ---- state ----
  const st = {
    count: {}, level: {},                 // structure key -> count / level
    brewLevel: 0, brewSlider: 100,
    foodResearch: 40, foodCast: 0, meadResearch: 40, meadCast: 0,
    item: {}, deco: {},                   // global index -> qty
  };

  function loadState() {
    try { const s = JSON.parse(localStorage.getItem("fm2_state") || "null"); if (s) Object.assign(st, s); } catch (e) {}
  }
  function save() { try { localStorage.setItem("fm2_state", JSON.stringify(st)); } catch (e) {} }

  // ---- food structures ----
  function renderStructs() {
    $("food-structs").innerHTML = FOOD_KEYS.map((k) => {
      const b = DATA.buildings[k];
      const maxL = b.perLevel.length;
      const lvl = st.level[k] || maxL;
      const opts = Array.from({ length: maxL }, (_, i) =>
        '<option value="' + (i + 1) + '"' + ((i + 1) === lvl ? " selected" : "") + ">L" + (i + 1) + "</option>").join("");
      return '<div class="fm-srow"><span class="nm">' + esc(b.label) + " <span style='color:var(--text-faint);font-size:.74rem'>(" + num(b.perLevel[lvl - 1]) + "/ea)</span></span>" +
        '<input type="number" min="0" data-c="' + k + '" value="' + (st.count[k] || 0) + '" title="how many" />' +
        '<select data-l="' + k + '">' + opts + "</select></div>";
    }).join("");
    $("food-structs").querySelectorAll("input[data-c]").forEach((inp) =>
      inp.addEventListener("input", () => { st.count[inp.dataset.c] = Math.max(0, Math.floor(+inp.value || 0)); save(); recalc(); }));
    $("food-structs").querySelectorAll("select[data-l]").forEach((sel) =>
      sel.addEventListener("change", () => { st.level[sel.dataset.l] = +sel.value; save(); renderStructs(); recalc(); }));
  }

  // ---- brewery ----
  function renderBrewery() {
    const sel = $("brew-level");
    sel.innerHTML = DATA.brewery.map((b, i) =>
      '<option value="' + i + '"' + (i === st.brewLevel ? " selected" : "") + ">L" + (i + 1) + "</option>").join("");
    $("brew-slider").value = st.brewSlider;
    $("brew-pct").textContent = st.brewSlider + "%";
    sel.onchange = () => { st.brewLevel = +sel.value; save(); recalc(); };
    $("brew-slider").oninput = () => { st.brewSlider = +$("brew-slider").value; $("brew-pct").textContent = st.brewSlider + "%"; save(); recalc(); };
  }

  // ---- item / deco tables ----
  function itemTable(tblId, searchId, pool, kind, resFilter) {
    const q = ($(searchId).value || "").toLowerCase();
    const store = kind === "deco" ? st.deco : st.item;
    const rows = pool.map((it) => ({ it, gi: it._gi }))
      .filter(({ it }) => resFilter.some((r) => it[r]) && (!q || it.name.toLowerCase().includes(q)));
    const cols = resFilter;
    const head = '<thead><tr><th class="l">Item</th>' + (kind === "item" ? '<th class="l">Slot</th>' : '<th class="l">Type</th>') +
      cols.map((c) => "<th>" + ({ food: "Food", beef: "Beef", honey: "Honey", mead: "Mead" }[c]) + "</th>").join("") + "<th>Count</th></tr></thead>";
    $(tblId).innerHTML = head + "<tbody>" + rows.map(({ it, gi }) => {
      const n = store[gi] || 0;
      const meta = kind === "item" ? (it.kind || "") + (it.kind === "Primary" ? " ★" : "") : (it.kind || "Decoration") + (it.kingdom ? " · " + it.kingdom : "");
      return '<tr class="' + (n ? "on" : "") + '"><td class="nm">' + esc(it.name) + '</td><td class="k">' + esc(meta) + "</td>" +
        cols.map((c) => "<td>" + (it[c] ? "+" + num(it[c]) : "—") + "</td>").join("") +
        '<td><span class="fm-qty"><button data-k="' + kind + '" data-i="' + gi + '" data-s="-1">−</button>' +
        '<input data-k="' + kind + '" data-i="' + gi + '" type="number" min="0" value="' + n + '">' +
        '<button data-k="' + kind + '" data-i="' + gi + '" data-s="1">+</button></span></td></tr>';
    }).join("") + "</tbody>";
    $(tblId).querySelectorAll("button[data-i]").forEach((b) =>
      b.addEventListener("click", () => { const s = b.dataset.k === "deco" ? st.deco : st.item; const i = b.dataset.i; s[i] = Math.max(0, (s[i] || 0) + (+b.dataset.s)); save(); renderItems(); recalc(); }));
    $(tblId).querySelectorAll("input[data-i]").forEach((inp) =>
      inp.addEventListener("input", () => { const s = inp.dataset.k === "deco" ? st.deco : st.item; s[inp.dataset.i] = Math.max(0, Math.floor(+inp.value || 0)); save(); recalc(); inp.closest("tr").classList.toggle("on", s[inp.dataset.i] > 0); }));
  }

  function renderItems() {
    itemTable("food-bi", "food-bi-search", DATA.buildItems, "item", ["food", "beef"]);
    itemTable("food-deco", "food-deco-search", DATA.decos, "deco", ["food", "beef"]);
    itemTable("mead-bi", "mead-bi-search", DATA.buildItems, "item", ["mead", "honey"]);
    itemTable("mead-deco", "mead-deco-search", DATA.decos, "deco", ["mead", "honey"]);
  }

  // ---- totals ----
  function sumFlat(store, pool, key) {
    let t = 0; pool.forEach((it) => { const n = store[it._gi] || 0; if (n) t += (it[key] || 0) * n; }); return t;
  }

  function recalc() {
    // structures
    let baseFood = 0, baseBeef = 0;
    FOOD_KEYS.forEach((k) => {
      const b = DATA.buildings[k]; const per = b.perLevel[(st.level[k] || b.perLevel.length) - 1] || 0;
      const out = per * (st.count[k] || 0);
      if (b.res === "beef") baseBeef += out; else baseFood += out;
    });
    const foodMult = 1 + (Number(st.foodResearch || 0) + Number(st.foodCast || 0)) / 100;
    const flatFood = sumFlat(st.item, DATA.buildItems, "food") + sumFlat(st.deco, DATA.decos, "food");
    const flatBeef = sumFlat(st.item, DATA.buildItems, "beef") + sumFlat(st.deco, DATA.decos, "beef");
    const totalFood = baseFood * foodMult + flatFood;
    const totalBeef = baseBeef * foodMult + flatBeef;

    // mead
    const brew = DATA.brewery[st.brewLevel] || { mead: 0, foodRatio: 0, honeyRatio: 0 };
    const breweryMead = brew.mead * (st.brewSlider / 100);
    const meadMult = 1 + (Number(st.meadResearch || 0) + Number(st.meadCast || 0)) / 100;
    const flatMead = sumFlat(st.item, DATA.buildItems, "mead") + sumFlat(st.deco, DATA.decos, "mead");
    const flatHoney = sumFlat(st.item, DATA.buildItems, "honey") + sumFlat(st.deco, DATA.decos, "honey");
    const totalMead = breweryMead * meadMult + flatMead;
    const foodDraw = breweryMead * brew.foodRatio;
    const honeyDraw = breweryMead * brew.honeyRatio;

    $("out-food").innerHTML = "<h3>🍖 Food output</h3>" +
      row("Food / h", num(totalFood)) + row("Beef / h", num(totalBeef), totalBeef ? "" : "sm") +
      '<div class="fm-draw">Structures ×' + foodMult.toFixed(2) + " + " + num(flatFood) + " flat food.</div>";

    $("out-mead").innerHTML = "<h3>🍺 Mead output</h3>" +
      row("Mead", num(totalMead)) + row("Honey / h", num(flatHoney), flatHoney ? "" : "sm") +
      '<div class="fm-draw">Brewery draws <b>' + num(foodDraw) + "</b> food + <b>" + num(honeyDraw) + "</b> honey / h to run.</div>";

    $("brew-info").innerHTML = brew.mead
      ? "L" + (st.brewLevel + 1) + " brewery: " + num(brew.mead) + " mead at full · ratios " + brew.foodRatio + " food / " + brew.honeyRatio + " honey per mead."
      : "";
  }
  function row(k, v, cls) { return '<div class="fm-outrow"><span class="k">' + k + '</span><span class="v ' + (cls || "") + '">' + v + "</span></div>"; }

  // ---- wiring ----
  ["food-research", "food-cast", "mead-research", "mead-cast"].forEach((id) => {
    $(id).addEventListener("input", () => { st[id.replace(/-(\w)/g, (_, c) => c.toUpperCase())] = +$(id).value || 0; save(); recalc(); });
  });
  [["food-bi-search", renderItems], ["food-deco-search", renderItems], ["mead-bi-search", renderItems], ["mead-deco-search", renderItems]]
    .forEach(([id, fn]) => $(id).addEventListener("input", fn));
  $("reset").addEventListener("click", () => {
    localStorage.removeItem("fm2_state");
    st.count = {}; st.level = {}; st.item = {}; st.deco = {};
    st.brewLevel = DATA.brewery.length - 1; st.brewSlider = 100;
    st.foodResearch = DATA.research.foodPct; st.foodCast = 0; st.meadResearch = DATA.research.meadPct; st.meadCast = 0;
    syncInputs(); renderStructs(); renderBrewery(); renderItems(); recalc();
  });
  function syncInputs() {
    $("food-research").value = st.foodResearch; $("food-cast").value = st.foodCast;
    $("mead-research").value = st.meadResearch; $("mead-cast").value = st.meadCast;
  }

  fetch("./data/production.json")
    .then((r) => r.json())
    .then((d) => {
      DATA = d;
      d.buildItems.forEach((it, i) => it._gi = "i" + i);
      d.decos.forEach((it, i) => it._gi = "d" + i);
      // defaults (overridden by any saved state below)
      st.brewLevel = d.brewery.length - 1;
      st.foodResearch = d.research.foodPct;
      st.meadResearch = d.research.meadPct;
      loadState();
      syncInputs(); renderStructs(); renderBrewery(); renderItems(); recalc();
    })
    .catch((e) => { $("out-food").innerHTML = '<p class="muted">Could not load production data.</p>'; console.error(e); });
})();

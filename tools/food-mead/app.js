/* Food & Mead Production stacker. Sums the flat hourly production bonuses from
   the decorations + build items in ./data/production.json. No caps — production
   is gated by consumption, not a decoration cap. Data: game data cache. */
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const num = (v) => Number(v || 0).toLocaleString();
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;" }[c]));

  const RES = [
    { k: "food", label: "Food / h", icon: "🍖" },
    { k: "beef", label: "Beef / h", icon: "🥩" },
    { k: "honey", label: "Honey / h", icon: "🍯" },
    { k: "mead", label: "Mead", icon: "🍺" },
  ];

  let ITEMS = [];
  const qty = {};   // index -> count

  function totals() {
    const t = { food: 0, beef: 0, honey: 0, mead: 0 };
    ITEMS.forEach((it, i) => { const n = qty[i] || 0; if (!n) return; RES.forEach((r) => t[r.k] += (it[r.k] || 0) * n); });
    return t;
  }

  function renderSummary() {
    const t = totals();
    $("summary").innerHTML = RES.map((r) =>
      '<div class="fm-stat' + (t[r.k] ? " on" : "") + '"><div class="l">' + r.icon + " " + r.label + '</div>' +
      '<div class="v">' + (t[r.k] ? "+" + num(t[r.k]) : "—") + "</div>" +
      '<div class="sub">' + (r.k === "mead" ? "production bonus" : "per hour") + "</div></div>").join("");
  }

  function rowMatch(it, q, kind, res, onlySel, i) {
    if (q && !it.name.toLowerCase().includes(q)) return false;
    if (kind && it.kind !== kind) return false;
    if (res && !it[res]) return false;
    if (onlySel && !(qty[i] || 0)) return false;
    return true;
  }

  function renderTable() {
    const q = ($("search").value || "").toLowerCase(), kind = $("kind").value, res = $("res").value, onlySel = $("onlysel").checked;
    const rows = ITEMS.map((it, i) => ({ it, i })).filter(({ it, i }) => rowMatch(it, q, kind, res, onlySel, i));
    $("tbl").innerHTML =
      '<thead><tr><th class="l">Item</th><th class="l">Source</th><th>Food</th><th>Beef</th><th>Honey</th><th>Mead</th><th>Count</th></tr></thead><tbody>' +
      rows.map(({ it, i }) => {
        const n = qty[i] || 0;
        const cell = (v) => v ? "+" + num(v) : "—";
        const kindLabel = it.kind + (it.kingdom ? " · " + it.kingdom : "");
        return '<tr class="' + (n ? "on" : "") + '"><td class="nm">' + esc(it.name) + "</td>" +
          '<td class="k">' + esc(kindLabel) + "</td>" +
          "<td>" + cell(it.food) + "</td><td>" + cell(it.beef) + "</td><td>" + cell(it.honey) + "</td><td>" + cell(it.mead) + "</td>" +
          '<td><span class="fm-qty"><button data-i="' + i + '" data-s="-1">−</button>' +
          '<input data-i="' + i + '" type="number" min="0" value="' + n + '">' +
          '<button data-i="' + i + '" data-s="1">+</button></span></td></tr>';
      }).join("") + "</tbody>";
    if (!rows.length) $("tbl").innerHTML += '<tbody><tr><td class="k" colspan="7">No matching items.</td></tr></tbody>';
    $("tbl").querySelectorAll("button[data-i]").forEach((b) =>
      b.addEventListener("click", () => { const i = +b.dataset.i; qty[i] = Math.max(0, (qty[i] || 0) + (+b.dataset.s)); save(); renderTable(); renderSummary(); }));
    $("tbl").querySelectorAll("input[data-i]").forEach((inp) =>
      inp.addEventListener("input", () => { const i = +inp.dataset.i; qty[i] = Math.max(0, Math.floor(+inp.value || 0)); save(); renderSummary(); inp.closest("tr").classList.toggle("on", qty[i] > 0); }));
  }

  function save() { try { localStorage.setItem("fm_qty", JSON.stringify(qty)); } catch (e) {} }
  function load() { try { Object.assign(qty, JSON.parse(localStorage.getItem("fm_qty") || "{}")); } catch (e) {} }

  ["search", "kind", "res"].forEach((id) => $(id).addEventListener("input", renderTable));
  $("onlysel").addEventListener("change", renderTable);
  $("reset").addEventListener("click", () => { Object.keys(qty).forEach((k) => delete qty[k]); save(); renderTable(); renderSummary(); });

  fetch("./data/production.json")
    .then((r) => r.json())
    .then((d) => { ITEMS = d.items || []; load(); renderSummary(); renderTable(); })
    .catch((e) => { $("summary").innerHTML = '<p class="muted">Could not load production data.</p>'; console.error(e); });
})();

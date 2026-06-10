/* Maxy's Empire Toolkit — hub renderer. Builds the searchable, filterable tool grid
   from window.TOOLS. No dependencies, no build step. */
(function () {
  const CATS = [
    { id: "all", label: "All" },
    { id: "guides", label: "Guides" },
    { id: "calculators", label: "Calculators" },
    { id: "simulators", label: "Simulators" },
    { id: "rankings", label: "Rankings" },
    { id: "overviews", label: "Overviews" },
    { id: "vip", label: "VIP 🔒" },
  ];
  const CAT_LABEL = {
    guides: "Guides",
    calculators: "Calculators",
    simulators: "Simulators",
    rankings: "Rankings & Stats",
    overviews: "Overviews",
    vip: "Chemie's VIP Corner 🔒",
  };

  let activeCat = "all";
  let query = "";

  const chipsEl = document.getElementById("chips");
  const gridHost = document.getElementById("grid-host");
  const searchEl = document.getElementById("search");

  // Build filter chips
  CATS.forEach((c) => {
    const el = document.createElement("div");
    el.className = "chip" + (c.id === "all" ? " active" : "");
    el.textContent = c.label;
    el.dataset.cat = c.id;
    el.onclick = () => {
      activeCat = c.id;
      [...chipsEl.children].forEach((x) => x.classList.toggle("active", x.dataset.cat === c.id));
      render();
    };
    chipsEl.appendChild(el);
  });

  searchEl.addEventListener("input", () => {
    query = searchEl.value.trim().toLowerCase();
    render();
  });

  function matches(t) {
    if (activeCat !== "all" && t.cat !== activeCat) return false;
    if (!query) return true;
    const hay = (t.name + " " + t.desc + " " + (t.tags || []).join(" ")).toLowerCase();
    return hay.includes(query);
  }

  function cardFor(t) {
    const live = t.status === "live";
    const el = document.createElement(live ? "a" : "div");
    el.className = "card" + (live ? "" : " disabled");
    // Guides (and any entry with an explicit url) link straight to a page;
    // everything else follows the folder-per-tool convention.
    if (live) el.href = t.url || "tools/" + t.slug + "/";
    el.innerHTML =
      '<div class="ico">' + t.icon + "</div>" +
      "<h3>" + t.name + "</h3>" +
      "<p>" + t.desc + "</p>" +
      '<span class="badge ' + (live ? "new" : "soon") + '">' + (live ? "Ready" : "Soon") + "</span>";
    return el;
  }

  function render() {
    gridHost.innerHTML = "";
    const visible = window.TOOLS.filter(matches);
    if (!visible.length) {
      gridHost.innerHTML = '<div class="empty">No tools match “' + query + "”.</div>";
      return;
    }
    // Group by category, preserving registry order
    const order = ["guides", "calculators", "simulators", "rankings", "overviews", "vip"];
    order.forEach((cat) => {
      const items = visible.filter((t) => t.cat === cat);
      if (!items.length) return;
      const label = document.createElement("div");
      label.className = "section-label";
      label.textContent = CAT_LABEL[cat] || cat;
      const grid = document.createElement("div");
      grid.className = "grid";
      items.forEach((t) => grid.appendChild(cardFor(t)));
      gridHost.appendChild(label);
      gridHost.appendChild(grid);
    });
  }

  render();
})();

(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const root = document.documentElement;

  $("#theme").onclick = () => {
    root.dataset.theme = root.dataset.theme === "dark" ? "light" : "dark";
    try { localStorage.theme = root.dataset.theme; } catch {}
  };

  // Rank-by tabs + sortable headers
  const money = (v) => {
    const a = Math.abs(v), s = v < 0 ? "-" : "";
    return a >= 1e12 ? `${s}$${(a / 1e12).toFixed(3)} T` : a >= 1e9 ? `${s}$${(a / 1e9).toFixed(2)} B` : `${s}$${(a / 1e6).toFixed(1)} M`;
  };
  const show = {
    mcap: (d) => money(+d.mcap), rev: (d) => money(d.rev * 1e9), earn: (d) => money(d.earn * 1e9),
    emp: (d) => Math.round(d.emp * 1000).toLocaleString("en-US"), pe: (d) => (d.pe ? (+d.pe).toFixed(1) : "—"),
    change: (d) => money(+d.mcap),
  };
  const head = { mcap: "Market Cap", rev: "Revenue", earn: "Earnings", emp: "Employees", pe: "P/E ratio", change: "Market Cap" };
  let dir = -1, key = "mcap";
  function sort(k, toggle) {
    dir = toggle && k === key ? -dir : k === "name" || k === "country" || k === "rank" || k === "pe" ? 1 : -1;
    key = k;
    document.querySelectorAll("table.rank").forEach((t) => {
      const body = t.tBodies[0];
      const rows = [...body.rows];
      rows.sort((a, b) => {
        let x = a.dataset[k], y = b.dataset[k];
        if (k === "pe") { x = x || 1e9; y = y || 1e9; }
        return (isNaN(x) || x === "" ? x.localeCompare(y) : x - y) * dir;
      });
      rows.forEach((r, i) => { r.querySelector(".rk").textContent = i + 1; if (show[k]) r.querySelector(".val").textContent = show[k](r.dataset); body.appendChild(r); });
      if (head[k]) t.tHead.rows[0].cells[2].textContent = head[k];
    });
  }
  document.querySelectorAll(".tabs button").forEach((b) => b.onclick = () => {
    document.querySelectorAll(".tabs button").forEach((x) => x.classList.toggle("on", x === b));
    sort(b.dataset.sort);
  });
  document.querySelectorAll("th[data-k]").forEach((th) => th.onclick = () => sort(th.dataset.k, true));

  // Search
  const q = $("#q"), out = $("#results");
  let index;
  q.addEventListener("input", async () => {
    index ??= await fetch(window.SITE_ROOT + "search.json").then((r) => r.json());
    const v = q.value.trim().toLowerCase();
    const hits = v ? index.filter(([n, t]) => n.toLowerCase().includes(v) || t.toLowerCase().startsWith(v)).slice(0, 8) : [];
    out.innerHTML = hits.map(([n, t, s, d]) => `<a href="${window.SITE_ROOT}company/${s}/"><img src="https://www.google.com/s2/favicons?domain=${d}&sz=32" width="16" height="16" alt=""> ${n} <small>${t}</small></a>`).join("");
    out.hidden = !hits.length;
  });
  q.addEventListener("keydown", (e) => { if (e.key === "Enter") out.querySelector("a")?.click(); });
  document.addEventListener("click", (e) => { if (!e.target.closest(".nav")) out.hidden = true; });
})();

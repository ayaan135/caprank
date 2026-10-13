(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const R = window.ROOT, P = window.PAGE || {};
  const store = { get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} } };
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  // ---------- currency ----------
  const SYM = { USD: "$", EUR: "€", GBP: "£", INR: "₹", JPY: "¥", CNY: "¥", CAD: "C$", AUD: "A$", CHF: "CHF " };
  let cur = store.get("cur", "USD");
  const rate = () => (cur === "USD" ? 1 : 1 / (window.FX[cur] || 1));
  const money = (v) => {
    if (v == null || v === "") return "—";
    v *= rate();
    const a = Math.abs(v), s = v < 0 ? "-" : "", y = SYM[cur];
    return a >= 1e12 ? `${s}${y}${(a / 1e12).toFixed(2)}T` : a >= 1e9 ? `${s}${y}${(a / 1e9).toFixed(1)}B` : a >= 1e6 ? `${s}${y}${(a / 1e6).toFixed(0)}M` : `${s}${y}${a >= 1000 ? a.toLocaleString("en-US", { maximumFractionDigits: 0 }) : a.toFixed(2)}`;
  };
  const pct = (v) => (v == null ? `<span class="mut">—</span>` : `<span class="${v >= 0 ? "up" : "dn"}">${v >= 0 ? "+" : ""}${(+v).toFixed(2)}%</span>`);
  const applyCur = () => $$("[data-usd]").forEach((el) => { if (el.dataset.usd !== "") el.textContent = money(+el.dataset.usd); });
  const curSel = $("#cur");
  curSel.value = cur;
  curSel.onchange = () => { cur = curSel.value; store.set("cur", cur); applyCur(); boards.forEach((b) => b.render()); };
  if (cur !== "USD") applyCur();

  // ---------- chrome ----------
  $("#theme").onclick = () => { const t = document.documentElement.dataset.theme === "dark" ? "light" : "dark"; document.documentElement.dataset.theme = t; store.set("theme", t); try { localStorage.setItem("theme", t); } catch {} };
  $("#burger").onclick = () => document.body.classList.toggle("nav-open");
  const here = location.pathname.replace(/index\.html$/, "");
  $$(".side nav a").forEach((a) => { const p = new URL(a.href).pathname; if (p === here || (p.length > R.length + 1 && here.startsWith(p) && !p.endsWith("/caprank/"))) a.classList.add("on"); });

  // ---------- data ----------
  const cache = {};
  const load = (name) => (cache[name] ??= fetch(`${R}data/${name}.json`).then((r) => r.json()).then((d) => {
    if (!d.keys) return d;
    return d.rows.map((row) => Object.fromEntries(d.keys.map((k, i) => [k, k === "cats" ? row[i].map((j) => d.cats[j]) : row[i]])));
  }));
  const sparks = () => load("sparks");
  const logo = (c, size = 32) => c.w ? `<img class="logo" src="https://www.google.com/s2/favicons?domain=${c.w}&sz=64" width="${size}" height="${size}" alt="" loading="lazy">` : `<span class="logo mono" style="width:${size}px;height:${size}px">${esc(short(c.n)[0])}</span>`;
  const short = (n) => n.replace(/,? (Inc\.?|Incorporated|Corporation|Corp\.?|Co\., Ltd\.|Company Limited|Limited|Ltd\.?|plc|PLC|S\.A\.|N\.V\.|AG|SE|Holdings? (Inc|Ltd|Limited)\.?)$/i, "").replace(/^The /, "");
  const FLAG = { "United States": "us", Canada: "ca", Mexico: "mx", Brazil: "br", Chile: "cl", Argentina: "ar", Colombia: "co", Peru: "pe", Bermuda: "bm", "Cayman Islands": "ky", Germany: "de", "United Kingdom": "gb", France: "fr", Switzerland: "ch", Netherlands: "nl", Spain: "es", Italy: "it", Sweden: "se", Denmark: "dk", Finland: "fi", Norway: "no", Belgium: "be", Austria: "at", Ireland: "ie", Portugal: "pt", Poland: "pl", Greece: "gr", Luxembourg: "lu", China: "cn", Japan: "jp", India: "in", "South Korea": "kr", "Hong Kong": "hk", Taiwan: "tw", Singapore: "sg", Indonesia: "id", Malaysia: "my", Thailand: "th", Vietnam: "vn", Philippines: "ph", "Saudi Arabia": "sa", "United Arab Emirates": "ae", Israel: "il", Qatar: "qa", Kuwait: "kw", Turkey: "tr", "South Africa": "za", Egypt: "eg", Australia: "au", "New Zealand": "nz", Russia: "ru", Uruguay: "uy", Jersey: "je", Guernsey: "gg", Monaco: "mc", Macau: "mo", Cyprus: "cy", Malta: "mt", Hungary: "hu", "Czech Republic": "cz", Iceland: "is", Romania: "ro", Panama: "pa", "Puerto Rico": "pr", Bahamas: "bs", Kazakhstan: "kz" };
  const flag = (c) => `<img class="flag" src="https://flagcdn.com/w20/${FLAG[c] || "un"}.png" width="20" height="15" alt="" loading="lazy">`;
  const spark = (pts, w = 110, h = 32) => {
    if (!pts || pts.length < 2) return "";
    const min = Math.min(...pts), max = Math.max(...pts), span = max - min || 1;
    const d = pts.map((p, i) => `${((i / (pts.length - 1)) * w).toFixed(1)},${(h - 3 - ((p - min) / span) * (h - 6)).toFixed(1)}`).join(" ");
    return `<svg class="spark ${pts.at(-1) >= pts[0] ? "up" : "dn"}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><polyline points="${d}"/></svg>`;
  };

  // ---------- watchlist ----------
  let watch = new Set(store.get("watch", []));
  const saveWatch = () => store.set("watch", [...watch]);
  const starBtn = (s) => `<button class="star ${watch.has(s) ? "on" : ""}" data-star="${esc(s)}" aria-label="Watch">${watch.has(s) ? "★" : "☆"}</button>`;
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-star]");
    if (!b) return;
    e.preventDefault();
    const s = b.dataset.star;
    watch.has(s) ? watch.delete(s) : watch.add(s);
    saveWatch();
    $$(`[data-star="${CSS.escape(s)}"]`).forEach((x) => { x.classList.toggle("on", watch.has(s)); x.textContent = x.classList.contains("star") ? (watch.has(s) ? "★" : "☆") : watch.has(s) ? "★ Watching" : "☆ Watch"; });
  });
  $$(".co-actions [data-star]").forEach((b) => { if (watch.has(b.dataset.star)) b.textContent = "★ Watching"; });

  // ---------- leaderboards ----------
  const LABEL = { m: "Market cap", e: "Earnings", r: "Revenue", emp: "Employees", pe: "P/E", dy: "Dividend %", y1: "1Y return", ch: "Today", a: "Assets", ytd: "YTD", er: "Fee" };
  const boards = [];
  $$("[data-board]").forEach((el) => {
    const etf = el.dataset.kind === "etf";
    const b = { metric: etf ? "a" : "m", shown: 100, f: {}, list: null };
    boards.push(b);
    const total = () => b.all.reduce((s, c) => s + (c.m || 0), 0);
    b.fmt = (c) => {
      const v = c[b.metric];
      if (["m", "e", "r", "a"].includes(b.metric)) return money(v);
      if (b.metric === "emp") return v ? v.toLocaleString("en-US") : "—";
      if (b.metric === "pe") return v ?? "—";
      if (b.metric === "er") return v != null ? v.toFixed(2) + "%" : "—";
      return pct(v);
    };
    b.render = async () => {
      if (!b.all) return;
      const sp = await sparks();
      let l = b.all;
      if (b.f.c) l = l.filter((c) => c.c === b.f.c);
      if (b.f.cat) l = l.filter((c) => c.cats?.includes(b.f.cat));
      if (b.f.text) { const t = b.f.text.toLowerCase(); l = l.filter((c) => c.n.toLowerCase().includes(t) || c.s.toLowerCase().startsWith(t)); }
      if (b.f.watch) l = l.filter((c) => watch.has(c.s));
      const k = b.metric, asc = k === "pe" || k === "er";
      l = l.filter((c) => c[k] != null && (k !== "pe" || c[k] > 0)).sort((x, y) => (asc ? x[k] - y[k] : y[k] - x[k]));
      b.view = l;
      const tot = total();
      $("[data-col]", el).textContent = LABEL[k];
      $("tbody", el).innerHTML = l.slice(0, b.shown).map((c, i) => etf
        ? `<tr><td class="rk">${starBtn(c.s)}${i + 1}</td><td><a class="co" href="${R}etf/${c.slug}/"><span class="logo mono etf">${esc(c.s.split(".")[0].slice(0, 4))}</span><span><b>${esc(c.n)}</b><small>${esc(c.s)} · ${esc(c.type)}</small></span></a></td><td class="n v">${b.fmt(c)}</td><td class="n">${money(c.p)}</td><td class="n">${pct(c.ch)}</td><td class="n hide-s">${pct(c.y1)}</td><td class="n hide-s">${c.er != null ? c.er.toFixed(2) + "%" : "—"}</td><td class="hide-s">${spark(sp[c.s])}</td></tr>`
        : `<tr><td class="rk">${starBtn(c.s)}${i + 1}</td><td><a class="co" href="${R}company/${c.slug}/">${logo(c)}<span><b>${esc(short(c.n))}</b><small>${esc(c.s)} · ${flag(c.c)} ${esc(c.c)}</small></span></a></td><td class="n v">${b.fmt(c)}</td><td class="n">${money(c.p)}</td><td class="n">${pct(c.ch)}</td><td class="n hide-s">${pct(c.y1)}</td><td class="n hide-s share">${((c.m / tot) * 100).toFixed(2)}%</td><td class="hide-s">${spark(sp[c.s])}</td></tr>`).join("") || `<tr><td colspan="8" class="empty">Nothing matches.</td></tr>`;
      $("[data-count]", el).textContent = `${Math.min(b.shown, l.length).toLocaleString("en-US")} of ${l.length.toLocaleString("en-US")} ${etf ? "ETFs" : "companies"}`;
      $("[data-more]", el).hidden = b.shown >= l.length;
      if ($("thead tr th:nth-child(7)", el) && !etf) $("thead tr th:nth-child(7)", el).textContent = "Share";
    };
    const init = load(etf ? "etfs" : "companies").then((all) => {
      if (P.c) all = all.filter((c) => c.c === P.c);
      if (P.cat) all = all.filter((c) => c.cats.includes(P.cat));
      if (P.type) all = all.filter((e) => e.type === P.type);
      if (P.region) all = all.filter((e) => e.regions?.includes(P.region));
      b.all = all;
      if (P.c) { const s = $('[data-filter="c"]', el); if (s) s.closest("select").remove(); }
      if (P.cat) { const s = $('[data-filter="cat"]', el); if (s) s.remove(); }
    });
    const go = () => init.then(b.render);
    $$("[data-metric]", el).forEach((btn) => btn.onclick = () => { $$("[data-metric]", el).forEach((x) => x.classList.toggle("on", x === btn)); b.metric = btn.dataset.metric; b.shown = 100; go(); });
    $$("[data-filter]", el).forEach((inp) => inp.addEventListener(inp.type === "search" ? "input" : "change", () => { b.f[inp.dataset.filter] = inp.type === "checkbox" ? inp.checked : inp.value; b.shown = 100; go(); }));
    $("[data-more]", el).onclick = () => { b.shown += 200; go(); };
    $("[data-export]", el)?.addEventListener("click", () => init.then(() => {
      const rows = (b.view || b.all).slice(0, 100);
      const keys = Object.keys(rows[0]).filter((k) => k !== "cats" && k !== "slug" && k !== "regions");
      const csv = [keys.join(","), ...rows.map((r) => keys.map((k) => JSON.stringify(r[k] ?? "")).join(","))].join("\n");
      const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(new Blob([csv], { type: "text/csv" })), download: "caprank-export.csv" });
      a.click();
      toast(`Exported top 100 rows. <a href="${R}pro/">Go Pro</a> for unlimited exports.`);
    }));
    // Upgrade server-rendered rows with stars once data is ready
    go();
  });

  function toast(html) {
    const t = Object.assign(document.createElement("div"), { className: "toast", innerHTML: html });
    document.body.append(t);
    setTimeout(() => t.remove(), 5000);
  }

  // ---------- treemap (squarified) ----------
  function squarify(items, x, y, w, h, out) {
    if (!items.length) return;
    if (items.length === 1) { out.push({ ...items[0], x, y, w, h }); return; }
    const total = items.reduce((s, i) => s + i.v, 0);
    const wide = w >= h, side = wide ? h : w;
    let row = [], rowSum = 0, best = Infinity, i = 0;
    for (; i < items.length; i++) {
      const s = rowSum + items[i].v, len = (s / total) * (wide ? w : h);
      const worst = Math.max(...[...row, items[i]].map((r) => { const a = (r.v / s) * side; return Math.max(len / a, a / len); }));
      if (worst > best) break;
      best = worst; row.push(items[i]); rowSum = s;
    }
    const len = (rowSum / total) * (wide ? w : h);
    let off = 0;
    for (const r of row) {
      const a = (r.v / rowSum) * side;
      out.push(wide ? { ...r, x, y: y + off, w: len, h: a } : { ...r, x: x + off, y, w: a, h: len });
      off += a;
    }
    wide ? squarify(items.slice(i), x + len, y, w - len, h, out) : squarify(items.slice(i), x, y + len, w, h - len, out);
  }
  const heatColor = (ch) => {
    const t = Math.max(-1, Math.min(1, (ch || 0) / 3));
    return t >= 0 ? `hsl(158 ${40 + t * 35}% ${30 - t * 8}%)` : `hsl(352 ${40 - t * 35}% ${32 + t * 8}%)`;
  };
  $$("[data-treemap]").forEach(async (el) => {
    const n = +el.dataset.treemap;
    const all = await load("companies");
    const draw = () => {
      let l = all;
      const c = $('[data-heat="c"]')?.value, cat = $('[data-heat="cat"]')?.value;
      if (c) l = l.filter((x) => x.c === c);
      if (cat) l = l.filter((x) => x.cats.includes(cat));
      l = l.slice(0, n);
      const W = el.clientWidth, H = el.clientHeight, out = [];
      squarify(l.map((x) => ({ ...x, v: x.m })), 0, 0, W, H, out);
      el.innerHTML = out.map((t) => `<a href="${R}company/${t.slug}/" class="tm" style="left:${t.x}px;top:${t.y}px;width:${t.w}px;height:${t.h}px;background:${heatColor(t.ch)}" title="${esc(t.n)} ${money(t.m)} ${t.ch ?? ""}%">${t.w > 46 && t.h > 30 ? `<b style="font-size:${Math.max(10, Math.min(26, Math.sqrt(t.w * t.h) / 7))}px">${esc(t.s.split(".")[0])}</b><span>${t.ch != null ? (t.ch >= 0 ? "+" : "") + t.ch.toFixed(2) + "%" : ""}</span>` : ""}</a>`).join("");
    };
    draw();
    $$("[data-heat]").forEach((s) => (s.onchange = draw));
    let rt; addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(draw, 150); });
  });

  // ---------- command palette ----------
  const pal = $("#palette"), q = $("#q"), res = $("#results");
  let index, sel = 0;
  const openPal = async () => { pal.hidden = false; q.value = ""; res.innerHTML = ""; q.focus(); index ??= Promise.all([load("companies"), load("etfs")]); };
  $("#openSearch").onclick = openPal;
  addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k" || (e.key === "/" && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName))) { e.preventDefault(); openPal(); }
    if (e.key === "Escape") pal.hidden = true;
  });
  pal.onclick = (e) => { if (e.target === pal) pal.hidden = true; };
  const search = async (text, limit = 10) => {
    const [cs, es] = await (index ??= Promise.all([load("companies"), load("etfs")]));
    const t = text.trim().toLowerCase();
    if (!t) return [];
    const hit = (x) => x.s.toLowerCase() === t ? 0 : x.s.toLowerCase().startsWith(t) ? 1 : x.n.toLowerCase().startsWith(t) ? 2 : x.n.toLowerCase().includes(t) ? 3 : 9;
    return [...cs.map((c) => ({ c, k: "co", h: hit(c) })), ...es.map((c) => ({ c, k: "etf", h: hit(c) + 0.5 }))].filter((x) => x.h < 9).sort((a, b) => a.h - b.h || (b.c.m || b.c.a) - (a.c.m || a.c.a)).slice(0, limit);
  };
  q.oninput = async () => {
    const hits = await search(q.value);
    sel = 0;
    res.innerHTML = hits.map(({ c, k }, i) => `<a class="${i ? "" : "sel"}" href="${R}${k === "co" ? "company" : "etf"}/${c.slug}/">${k === "co" ? logo(c, 22) : `<span class="logo mono etf" style="width:22px;height:22px">E</span>`}<span>${esc(k === "co" ? short(c.n) : c.n)}</span><small>${esc(c.s)}</small><em>${money(c.m || c.a)}</em></a>`).join("") || (q.value ? `<p class="empty">No matches</p>` : "");
  };
  q.onkeydown = (e) => {
    const a = $$("a", res);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); sel = (sel + (e.key === "ArrowDown" ? 1 : -1) + a.length) % a.length; a.forEach((x, i) => x.classList.toggle("sel", i === sel)); }
    if (e.key === "Enter") a[sel]?.click();
  };

  // ---------- watchlist page ----------
  if (P.kind === "watchlist") (async () => {
    const [cs, es] = await Promise.all([load("companies"), load("etfs")]);
    const sp = await sparks();
    const items = [...cs.filter((c) => watch.has(c.s)).map((c) => ({ c, k: "company" })), ...es.filter((c) => watch.has(c.s)).map((c) => ({ c, k: "etf" }))];
    $("#watch").innerHTML = items.length ? `<div class="wgrid">${items.map(({ c, k }) => `<a class="wcard" href="${R}${k}/${c.slug}/">${starBtn(c.s)}<div class="w-top">${k === "company" ? logo(c, 28) : `<span class="logo mono etf">${esc(c.s.slice(0, 4))}</span>`}<b>${esc(short(c.n))}</b></div><div class="w-num">${money(c.m || c.a)}</div><div>${money(c.p)} ${pct(c.ch)}</div>${spark(sp[c.s], 220, 50)}</a>`).join("")}</div>`
      : `<div class="card empty">Your watchlist is empty. Tap ☆ next to any company or ETF to add it.</div>`;
  })();

  // ---------- compare page ----------
  if (P.kind === "compare") (async () => {
    const cs = await load("companies");
    const sp = await sparks();
    let picks = (new URLSearchParams(location.search).get("s") || "AAPL,MSFT").split(",").filter(Boolean).slice(0, 4);
    const ROWS = [["Market cap", (c) => money(c.m), "m"], ["Price", (c) => money(c.p)], ["Today", (c) => pct(c.ch)], ["1Y return", (c) => pct(c.y1), "y1"], ["Revenue", (c) => money(c.r), "r"], ["Earnings", (c) => money(c.e), "e"], ["P/E", (c) => c.pe ?? "—"], ["Dividend", (c) => (c.dy ? c.dy.toFixed(2) + "%" : "—"), "dy"], ["Employees", (c) => (c.emp ? c.emp.toLocaleString("en-US") : "—"), "emp"], ["Profit margin", (c) => (c.e && c.r ? ((c.e / c.r) * 100).toFixed(1) + "%" : "—")], ["Country", (c) => `${flag(c.c)} ${esc(c.c)}`], ["Industry", (c) => esc(c.ind)]];
    const draw = () => {
      history.replaceState(null, "", `?s=${picks.join(",")}`);
      const list = picks.map((s) => cs.find((c) => c.s === s)).filter(Boolean);
      $("#cmp").innerHTML = `<div class="tbl-wrap card"><table class="cmp"><thead><tr><th></th>${list.map((c) => `<th><a href="${R}company/${c.slug}/">${logo(c, 36)}<b>${esc(short(c.n))}</b></a><button class="x" data-rm="${esc(c.s)}">✕</button></th>`).join("")}</tr></thead><tbody>
${ROWS.map(([l, f, k]) => { const max = k ? Math.max(...list.map((c) => c[k] ?? -Infinity)) : null; return `<tr><td>${l}</td>${list.map((c) => `<td class="${k && c[k] === max && list.length > 1 ? "win" : ""}">${f(c)}</td>`).join("")}</tr>`; }).join("")}
<tr><td>30 days</td>${list.map((c) => `<td>${spark(sp[c.s], 160, 40)}</td>`).join("")}</tr></tbody></table></div>`;
      $$("[data-rm]").forEach((b) => (b.onclick = () => { picks = picks.filter((s) => s !== b.dataset.rm); draw(); }));
    };
    draw();
    const inp = $("#cmpq"), out = $("#cmpres");
    inp.oninput = async () => {
      const hits = (await search(inp.value, 8)).filter((h) => h.k === "co");
      out.innerHTML = hits.map(({ c }) => `<button data-add="${esc(c.s)}">${logo(c, 20)} ${esc(short(c.n))} <small>${esc(c.s)}</small></button>`).join("");
      $$("[data-add]", out).forEach((b) => (b.onclick = () => { if (!picks.includes(b.dataset.add)) picks = [...picks, b.dataset.add].slice(-4); inp.value = ""; out.innerHTML = ""; draw(); }));
    };
  })();
})();

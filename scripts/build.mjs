// Static site generator: data/market.json -> dist/
import { mkdir, writeFile, readFile, rm, cp } from "node:fs/promises";
import { CATEGORIES, CONTINENTS, continentOf, flagCode, ETF_TYPES, ETF_REGIONS } from "../data/taxonomy.mjs";
import cfg from "../site.config.mjs";

const root = new URL("../", import.meta.url);
const dist = new URL("dist/", root);
const { updated, fx, companies, etfs } = JSON.parse(await readFile(new URL("data/market.json", root), "utf8"));

// ---------- helpers ----------
const slug = (s) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const money = (v) => {
  if (v == null) return "—";
  const a = Math.abs(v), s = v < 0 ? "-" : "";
  return a >= 1e12 ? `${s}$${(a / 1e12).toFixed(2)}T` : a >= 1e9 ? `${s}$${(a / 1e9).toFixed(1)}B` : a >= 1e6 ? `${s}$${(a / 1e6).toFixed(0)}M` : `${s}$${a.toFixed(2)}`;
};
const price = (v) => (v == null ? "—" : `$${v >= 1000 ? v.toLocaleString("en-US", { maximumFractionDigits: 0 }) : v.toFixed(2)}`);
const pct = (v) => (v == null ? `<span class="mut">—</span>` : `<span class="${v >= 0 ? "up" : "dn"}">${v >= 0 ? "+" : ""}${v.toFixed(2)}%</span>`);
const flag = (c) => `<img class="flag" src="https://flagcdn.com/w20/${flagCode(c)}.png" width="20" height="15" alt="" loading="lazy">`;
const shortName = (n) => n.replace(/,? (Inc\.?|Incorporated|Corporation|Corp\.?|Co\., Ltd\.|Company Limited|Limited|Ltd\.?|plc|PLC|S\.A\.|N\.V\.|AG|SE|Holdings? (Inc|Ltd|Limited)\.?)$/i, "").replace(/^The /, "");
const logoUrl = (c) => (c.w ? `https://www.google.com/s2/favicons?domain=${c.w}&sz=64` : null);
const logo = (c, size = 32) => logoUrl(c)
  ? `<img class="logo" src="${logoUrl(c)}" width="${size}" height="${size}" alt="" loading="lazy">`
  : `<span class="logo mono" style="width:${size}px;height:${size}px">${esc(shortName(c.n)[0])}</span>`;
const spark = (pts, w = 110, h = 32, cls = "") => {
  if (!pts?.length || pts.length < 2) return "";
  const min = Math.min(...pts), max = Math.max(...pts), span = max - min || 1;
  const d = pts.map((p, i) => `${((i / (pts.length - 1)) * w).toFixed(1)},${(h - 3 - ((p - min) / span) * (h - 6)).toFixed(1)}`).join(" ");
  const up = pts.at(-1) >= pts[0];
  return `<svg class="spark ${up ? "up" : "dn"} ${cls}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true"><polyline points="${d}"/></svg>`;
};

// ---------- enrich ----------
const total = companies.reduce((s, c) => s + c.m, 0);
companies.forEach((c, i) => {
  c.rank = i + 1;
  c.slug = slug(c.s);
  const ln = c.n.toLowerCase();
  c.cats = CATEGORIES.filter((k) => k.industries.includes(c.ind) || k.names?.some((n) => new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(ln))).map((k) => k.name);
});
etfs.forEach((e, i) => {
  e.rank = i + 1;
  e.slug = slug(e.s);
  e.type = ETF_TYPES.find((t) => t.re.test(e.n))?.name ?? "Other";
  e.regions = ETF_REGIONS.filter(([, re]) => re.test(e.n)).map(([n]) => n);
});
const etfTotal = etfs.reduce((s, e) => s + e.a, 0);
const byCountry = Map.groupBy(companies, (c) => c.c ?? "Other");
const countries = [...byCountry.keys()].filter((c) => c !== "Other").sort((a, b) => byCountry.get(b).reduce((s, c) => s + c.m, 0) - byCountry.get(a).reduce((s, c) => s + c.m, 0));
const catList = CATEGORIES.map((k) => ({ ...k, list: companies.filter((c) => c.cats.includes(k.name)) })).filter((k) => k.list.length);
const etfTypes = ETF_TYPES.map((t) => ({ ...t, list: etfs.filter((e) => e.type === t.name) })).filter((t) => t.list.length);
const etfRegionList = ETF_REGIONS.map(([n]) => ({ name: n, list: etfs.filter((e) => e.regions.includes(n)) })).filter((r) => r.list.length);
const updatedText = new Date(updated).toUTCString().slice(5, 22) + " UTC";

// ---------- monetization blocks ----------
const ad = (slot, kind = "wide") => cfg.adsenseClient
  ? `<div class="ad ${kind}"><span class="ad-l">Ad</span><ins class="adsbygoogle" style="display:block" data-ad-client="${cfg.adsenseClient}" data-ad-slot="${slot}" data-ad-format="auto" data-full-width-responsive="true"></ins><script>(adsbygoogle=window.adsbygoogle||[]).push({})</script></div>`
  : `<a class="ad house ${kind}" href="${cfg.brokerAffiliateUrl}" rel="sponsored noopener" target="_blank"><span class="ad-l">Sponsored</span><b>Own a slice of the world's biggest companies</b><span>Commission-free investing with ${esc(cfg.brokerName)} →</span></a>`;

// ---------- layout ----------
const LOGO = `<svg class="mark" viewBox="0 0 32 32" aria-hidden="true"><defs><linearGradient id="g" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#6d5dfc"/><stop offset="1" stop-color="#20d6b5"/></linearGradient></defs><path d="M16 2 28.1 9v14L16 30 3.9 23V9z" fill="url(#g)"/><path d="M9 20.5 13.5 15l3.5 3 6-7.5" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="23" cy="10.5" r="2" fill="#fff"/></svg>`;

const sidebar = (up) => `<aside class="side" id="side">
<a class="brand" href="${up}">${LOGO}<span>${cfg.brand}</span></a>
<nav>
<a href="${up}"><i>🏆</i>Global leaderboard</a>
<a href="${up}heatmap/"><i>🟩</i>Market heatmap</a>
<a href="${up}movers/"><i>⚡</i>Today's movers</a>
<a href="${up}countries/"><i>🌍</i>Countries <em>${countries.length}</em></a>
<a href="${up}categories/"><i>🗂️</i>Categories <em>${catList.length}</em></a>
<a href="${up}etfs/"><i>📊</i>ETFs <em>${etfs.length.toLocaleString("en-US")}</em></a>
<a href="${up}compare/"><i>⚖️</i>Compare</a>
<a href="${up}watchlist/"><i>⭐</i>Watchlist</a>
</nav>
<div class="side-pro"><b>${cfg.brand} Pro</b><p>No ads, full exports & daily movers email.</p><a href="${up}pro/">Go Pro · ${cfg.proPrice}</a></div>
<div class="side-meta">Prices updated<br>${esc(updatedText)}</div>
</aside>`;

const layout = ({ title, desc, path, body, depth = 0, page = {} }) => {
  const up = "../".repeat(depth) || "./";
  return `<!doctype html><html lang="en" data-theme="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><meta name="description" content="${esc(desc)}"><link rel="canonical" href="${cfg.baseUrl}/${path}">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:image" content="${cfg.baseUrl}/og.png"><meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="${up}favicon.svg"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="${up}style.css">
<script>try{var t=localStorage.getItem("theme");if(t)document.documentElement.dataset.theme=t}catch(e){}</script>
${cfg.adsenseClient ? `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${cfg.adsenseClient}" crossorigin="anonymous"></script>` : ""}
</head><body>
<div class="shell">${sidebar(up)}
<div class="main">
<div class="bar"><button class="burger" id="burger" aria-label="Menu">☰</button>
<button class="search" id="openSearch"><span>🔍 Search ${companies.length.toLocaleString("en-US")} companies & ${etfs.length.toLocaleString("en-US")} ETFs</span><kbd>Ctrl K</kbd></button>
<select id="cur" aria-label="Currency">${["USD", "EUR", "GBP", "INR", "JPY", "CNY", "CAD", "AUD", "CHF"].filter((c) => c === "USD" || fx[c]).map((c) => `<option>${c}</option>`).join("")}</select>
<button id="theme" aria-label="Toggle theme">☾</button></div>
<div class="ticker"><span>World market cap <b data-usd="${total}">${money(total)}</b></span><span>Companies <b>${companies.length.toLocaleString("en-US")}</b></span><span>ETF assets <b data-usd="${etfTotal}">${money(etfTotal)}</b></span><span>Countries <b>${countries.length}</b></span></div>
<main>${body}</main>
<footer><div class="foot-brand">${LOGO}<b>${cfg.brand}</b></div><p>${esc(cfg.tagline)}. Data from public market sources, delayed; market caps converted to USD at live FX. Not investment advice.</p>
<p><a href="${up}pro/">Pro</a> · <a href="${up}advertise/">Advertise</a> · <a href="${up}api/">Data & API</a> · <a href="${up}privacy/">Privacy</a> · <a href="${cfg.supportUrl}" rel="noopener">Support</a> — Some outbound links are affiliate links.</p></footer>
</div></div>
<div class="palette" id="palette" hidden><div class="pal-box"><input id="q" placeholder="Type a company, ticker or ETF…" autocomplete="off"><div id="results"></div></div></div>
<script>window.ROOT=${JSON.stringify(up)};window.PAGE=${JSON.stringify(page)};window.FX=${JSON.stringify(Object.fromEntries(["EUR", "GBP", "INR", "JPY", "CNY", "CAD", "AUD", "CHF"].filter((c) => fx[c]).map((c) => [c, fx[c]])))};</script>
<script src="${up}app.js" defer></script></body></html>`;
};

// ---------- table (server-rendered first rows; app.js takes over with full data) ----------
const METRICS = [["m", "Market cap"], ["e", "Earnings"], ["r", "Revenue"], ["emp", "Employees"], ["pe", "P/E"], ["dy", "Dividend %"], ["y1", "1Y return"], ["ch", "Today"]];
const companyRows = (list, up, n = 100) => list.slice(0, n).map((c, i) => `<tr><td class="rk">${i + 1}</td>
<td><a class="co" href="${up}company/${c.slug}/">${logo(c)}<span><b>${esc(shortName(c.n))}</b><small>${esc(c.s)} · ${flag(c.c)} ${esc(c.c)}</small></span></a></td>
<td class="n v">${money(c.m)}</td><td class="n">${price(c.p)}</td><td class="n">${pct(c.ch)}</td><td class="n hide-s">${pct(c.y1)}</td>
<td class="n hide-s share">${((c.m / total) * 100).toFixed(2)}%</td><td class="hide-s">${spark(c.sp)}</td></tr>`).join("");

const leaderboard = (list, up, { filters = true } = {}) => `<section class="board" data-board>
<div class="controls">
<div class="seg" role="tablist">${METRICS.map(([k, l], i) => `<button data-metric="${k}" class="${i ? "" : "on"}">${l}</button>`).join("")}</div>
${filters ? `<div class="filters"><select data-filter="c"><option value="">All countries</option>${countries.map((c) => `<option>${esc(c)}</option>`).join("")}</select>
<select data-filter="cat"><option value="">All categories</option>${catList.map((k) => `<option>${esc(k.name)}</option>`).join("")}</select>
<input data-filter="text" type="search" placeholder="Filter…"><label class="chk"><input type="checkbox" data-filter="watch"> ⭐ only</label>
<button class="ghost" data-export>⬇ CSV</button></div>` : ""}
</div>
<div class="tbl-wrap"><table class="lb"><thead><tr><th>#</th><th>Company</th><th class="n" data-col>Market cap</th><th class="n">Price</th><th class="n">Today</th><th class="n hide-s">1Y</th><th class="n hide-s">Share</th><th class="hide-s">30 days</th></tr></thead>
<tbody>${companyRows(list, up)}</tbody></table></div>
<div class="pager"><button class="ghost" data-more>Show more</button><span data-count>${list.length.toLocaleString("en-US")} companies</span></div>
</section>`;

const etfRows = (list, up, n = 100) => list.slice(0, n).map((e, i) => `<tr><td class="rk">${i + 1}</td>
<td><a class="co" href="${up}etf/${e.slug}/"><span class="logo mono etf">${esc(e.s.split(".")[0].slice(0, 4))}</span><span><b>${esc(e.n)}</b><small>${esc(e.s)} · ${esc(e.type)}</small></span></a></td>
<td class="n v">${money(e.a)}</td><td class="n">${price(e.p)}</td><td class="n">${pct(e.ch)}</td><td class="n hide-s">${pct(e.y1)}</td><td class="n hide-s">${e.er != null ? e.er.toFixed(2) + "%" : "—"}</td><td class="hide-s">${spark(e.sp)}</td></tr>`).join("");
const etfBoard = (list, up) => `<section class="board" data-board data-kind="etf"><div class="controls"><div class="seg">${[["a", "Assets"], ["ch", "Today"], ["y1", "1Y return"], ["ytd", "YTD"], ["dy", "Yield %"], ["er", "Lowest fee"]].map(([k, l], i) => `<button data-metric="${k}" class="${i ? "" : "on"}">${l}</button>`).join("")}</div>
<div class="filters"><input data-filter="text" type="search" placeholder="Filter ETFs…"><button class="ghost" data-export>⬇ CSV</button></div></div>
<div class="tbl-wrap"><table class="lb"><thead><tr><th>#</th><th>ETF</th><th class="n" data-col>Assets</th><th class="n">Price</th><th class="n">Today</th><th class="n hide-s">1Y</th><th class="n hide-s">Fee</th><th class="hide-s">30 days</th></tr></thead>
<tbody>${etfRows(list, up)}</tbody></table></div><div class="pager"><button class="ghost" data-more>Show more</button><span data-count>${list.length.toLocaleString("en-US")} ETFs</span></div></section>`;

const hero = (title, sub, stats) => `<header class="hero"><h1>${title}</h1><p>${sub}</p>${stats ? `<div class="kpis">${stats.map(([l, v, usd]) => `<div><small>${l}</small><b ${usd != null ? `data-usd="${usd}"` : ""}>${v}</b></div>`).join("")}</div>` : ""}</header>`;
const capOf = (l) => l.reduce((s, c) => s + c.m, 0);
const gainers = companies.filter((c) => c.ch != null && c.m > 10e9).sort((a, b) => b.ch - a.ch);

// ---------- pages ----------
const pages = new Map();
const add = (path, o) => pages.set(path, layout({ ...o, path: path.replace(/index\.html$/, ""), depth: path.split("/").length - 1 }));

add("index.html", {
  title: `${cfg.brand} — The world's companies ranked by market cap`,
  desc: `Live leaderboard of ${companies.length.toLocaleString("en-US")} public companies and ${etfs.length.toLocaleString("en-US")} ETFs ranked by market cap, earnings, revenue, employees, P/E and dividends, across ${countries.length} countries.`,
  page: { kind: "companies" },
  body: hero(`The world's most valuable companies`, `${companies.length.toLocaleString("en-US")} public companies across ${countries.length} countries, ranked live. Click a metric to re-rank.`, [
    ["World market cap", money(total), total], ["Top 10 share", ((capOf(companies.slice(0, 10)) / total) * 100).toFixed(1) + "%"],
    ["Up today", `${companies.filter((c) => c.ch > 0).length.toLocaleString("en-US")} / ${companies.length.toLocaleString("en-US")}`],
    ["Best mover (>$10B)", `${esc(shortName(gainers[0]?.n ?? ""))} ${gainers[0] ? "+" + gainers[0].ch.toFixed(1) + "%" : ""}`],
  ]) + ad("1000000001") + `<div class="map-wrap"><div class="map-head"><h2>Market map</h2><a href="heatmap/">Full heatmap →</a></div><div class="treemap" data-treemap="60"></div></div>` + leaderboard(companies, "./") + ad("1000000002"),
});

add("heatmap/index.html", { title: `Global market heatmap — ${cfg.brand}`, desc: "Treemap of the world's largest companies, sized by market cap and colored by today's move.", page: { kind: "heatmap" },
  body: hero("Market heatmap", "Tiles sized by market cap, colored by today's change. Pick a country or category.") + `<div class="filters solo"><select data-heat="c"><option value="">World</option>${countries.map((c) => `<option>${esc(c)}</option>`).join("")}</select><select data-heat="cat"><option value="">All categories</option>${catList.map((k) => `<option>${esc(k.name)}</option>`).join("")}</select></div><div class="treemap big" data-treemap="250"></div>` + ad("1000000003") });

const moverCard = (title, list, up) => `<div class="card"><h3>${title}</h3><ol class="mini">${list.slice(0, 15).map((c) => `<li><a href="${up}company/${c.slug}/">${logo(c, 20)} ${esc(shortName(c.n))}</a><span>${money(c.m)}</span>${pct(c.ch)}</li>`).join("")}</ol></div>`;
add("movers/index.html", { title: `Today's biggest stock movers — ${cfg.brand}`, desc: "Largest gainers and losers today among companies worth over $10B.",
  body: hero("Today's movers", "Biggest gainers and losers today among companies worth over $10B.") + `<div class="cols2">${moverCard("🚀 Top gainers", gainers, "../")}${moverCard("📉 Top losers", [...gainers].reverse(), "../")}</div>` + ad("1000000004") +
    `<div class="cols2">${moverCard("📈 Best 1-year return", companies.filter((c) => c.y1 != null && c.m > 10e9).sort((a, b) => b.y1 - a.y1).map((c) => ({ ...c, ch: c.y1 })), "../")}${moverCard("💰 Highest dividend yield", companies.filter((c) => c.dy && c.m > 10e9).sort((a, b) => b.dy - a.dy).map((c) => ({ ...c, ch: c.dy })), "../")}</div>` });

// Countries
add("countries/index.html", { title: `Largest companies by country — ${cfg.brand}`, desc: `Market cap rankings for ${countries.length} countries.`,
  body: hero("Rankings by country", `${countries.length} countries, grouped by region. Bars show each country's share of world market cap.`) +
    Object.keys(CONTINENTS).map((cont) => {
      const list = countries.filter((c) => continentOf(c) === cont);
      if (!list.length) return "";
      return `<h2 class="group">${cont}</h2><div class="tiles">${list.map((c) => { const l = byCountry.get(c), cap = capOf(l); return `<a class="tile" href="../country/${slug(c)}/"><span class="t-top">${flag(c)} <b>${esc(c)}</b></span><span class="t-num" data-usd="${cap}">${money(cap)}</span><span class="t-sub">${l.length.toLocaleString("en-US")} companies · #1 ${esc(shortName(l[0].n))}</span><span class="meter"><i style="width:${Math.max(1, (cap / capOf(byCountry.get(countries[0]))) * 100).toFixed(1)}%"></i></span></a>`; }).join("")}</div>`;
    }).join("") + ad("1000000005") });
for (const c of countries) {
  const l = byCountry.get(c);
  add(`country/${slug(c)}/index.html`, { title: `Largest companies in ${c} by market cap — ${cfg.brand}`, desc: `Ranking of ${l.length} public companies in ${c} by market capitalization. #1: ${shortName(l[0].n)} (${money(l[0].m)}).`, page: { kind: "companies", c },
    body: `<nav class="crumbs"><a href="../../countries/">Countries</a> › ${esc(c)}</nav>` + hero(`${flag(c)} Largest companies in ${esc(c)}`, `${l.length.toLocaleString("en-US")} companies · ${((capOf(l) / total) * 100).toFixed(2)}% of world market cap`, [["Total market cap", money(capOf(l)), capOf(l)], ["Largest", esc(shortName(l[0].n))], ["Up today", `${l.filter((x) => x.ch > 0).length} / ${l.length}`]]) + ad("1000000006") + leaderboard(l, "../../", { filters: true }) });
}

// Categories
add("categories/index.html", { title: `Largest companies by category — ${cfg.brand}`, desc: `${catList.length} industry rankings.`,
  body: hero("Rankings by category", `${catList.length} categories, from AI and semiconductors to tobacco and airlines.`) + `<div class="tiles">${catList.sort((a, b) => capOf(b.list) - capOf(a.list)).map((k) => `<a class="tile" href="../category/${slug(k.name)}/"><span class="t-top"><i class="emo">${k.icon}</i> <b>${esc(k.name)}</b></span><span class="t-num" data-usd="${capOf(k.list)}">${money(capOf(k.list))}</span><span class="t-sub">${k.list.length.toLocaleString("en-US")} companies · #1 ${esc(shortName(k.list[0].n))}</span></a>`).join("")}</div>` + ad("1000000007") });
for (const k of catList) add(`category/${slug(k.name)}/index.html`, { title: `Largest ${k.name} companies by market cap — ${cfg.brand}`, desc: `Ranking of the ${k.list.length} largest ${k.name} companies worldwide by market capitalization.`, page: { kind: "companies", cat: k.name },
  body: `<nav class="crumbs"><a href="../../categories/">Categories</a> › ${esc(k.name)}</nav>` + hero(`${k.icon} Largest ${esc(k.name)} companies`, `${k.list.length.toLocaleString("en-US")} companies worldwide`, [["Total market cap", money(capOf(k.list)), capOf(k.list)], ["Largest", esc(shortName(k.list[0].n))], ["Countries", new Set(k.list.map((c) => c.c)).size]]) + ad("1000000008") + leaderboard(k.list, "../../") });

// ETFs
add("etfs/index.html", { title: `Largest ETFs by assets — ${cfg.brand}`, desc: `${etfs.length.toLocaleString("en-US")} ETFs ranked by assets under management, return, yield and fees.`, page: { kind: "etf" },
  body: hero("ETFs", `${etfs.length.toLocaleString("en-US")} exchange-traded funds holding ${money(etfTotal)}.`) +
    `<h2 class="group">By type</h2><div class="chips">${etfTypes.map((t) => `<a href="../etfs/${slug(t.name)}/">${t.icon} ${esc(t.name)} <em>${t.list.length}</em></a>`).join("")}</div>
<h2 class="group">By region</h2><div class="chips">${etfRegionList.map((r) => `<a href="../etfs/region-${slug(r.name)}/">${esc(r.name)} <em>${r.list.length}</em></a>`).join("")}</div>` + ad("1000000009") + etfBoard(etfs, "../") });
for (const t of etfTypes) add(`etfs/${slug(t.name)}/index.html`, { title: `Largest ${t.name} ETFs — ${cfg.brand}`, desc: `${t.list.length} ${t.name} ETFs ranked by assets.`, page: { kind: "etf", type: t.name },
  body: `<nav class="crumbs"><a href="../">ETFs</a> › ${esc(t.name)}</nav>` + hero(`${t.icon} ${esc(t.name)} ETFs`, `${t.list.length} funds · ${money(t.list.reduce((s, e) => s + e.a, 0))} in assets`) + etfBoard(t.list, "../../") });
for (const r of etfRegionList) add(`etfs/region-${slug(r.name)}/index.html`, { title: `${r.name} ETFs — ${cfg.brand}`, desc: `${r.list.length} ETFs focused on ${r.name}.`, page: { kind: "etf", region: r.name },
  body: `<nav class="crumbs"><a href="../">ETFs</a> › ${esc(r.name)}</nav>` + hero(`${esc(r.name)} ETFs`, `${r.list.length} funds`) + etfBoard(r.list, "../../") });

// Company pages
const STATIC_COMPANIES = +(process.env.STATIC_COMPANIES ?? companies.length);
const catRank = new Map(catList.map((k) => [k.name, new Map(k.list.map((c, i) => [c.s, i + 1]))]));
const ctyRank = new Map(countries.map((c) => [c, new Map(byCountry.get(c).map((x, i) => [x.s, i + 1]))]));
for (const c of companies.slice(0, STATIC_COMPANIES)) {
  const name = shortName(c.n);
  const peers = companies.filter((p) => p.ind === c.ind && p !== c).slice(0, 8);
  add(`company/${c.slug}/index.html`, {
    title: `${name} (${c.s}) market cap: ${money(c.m)} — ${cfg.brand}`,
    desc: `${name} is worth ${money(c.m)}, ranked #${c.rank} worldwide and #${ctyRank.get(c.c)?.get(c.s)} in ${c.c}. Price, revenue, earnings, P/E, dividend and employees.`,
    page: { kind: "company", s: c.s },
    body: `<nav class="crumbs"><a href="../../">Leaderboard</a> › <a href="../../country/${slug(c.c ?? "")}/">${esc(c.c)}</a> › ${esc(name)}</nav>
<section class="co-head">${logo(c, 56)}<div><h1>${esc(name)} <small>${esc(c.s)}</small></h1><p>${flag(c.c)} ${esc(c.c)} · ${esc(c.ind ?? "")}${c.w ? ` · <a href="https://${c.w}" rel="nofollow noopener" target="_blank">${esc(c.w)}</a>` : ""}</p></div>
<div class="co-actions"><button class="ghost" data-star="${esc(c.s)}">☆ Watch</button><a class="btn" href="${cfg.brokerAffiliateUrl}" rel="sponsored noopener" target="_blank">Trade ${esc(c.s.split(".")[0])} →</a></div></section>
<div class="rankbar"><div><small>Global rank</small><b>#${c.rank}</b></div><div><small>In ${esc(c.c)}</small><b>#${ctyRank.get(c.c)?.get(c.s) ?? "—"}</b></div>${c.cats.slice(0, 3).map((k) => `<div><small>In <a href="../../category/${slug(k)}/">${esc(k)}</a></small><b>#${catRank.get(k)?.get(c.s)}</b></div>`).join("")}</div>
<div class="kpis big">
<div><small>Market cap</small><b data-usd="${c.m}">${money(c.m)}</b></div><div><small>Share price</small><b data-usd="${c.p}" data-px>${price(c.p)}</b> ${pct(c.ch)}</div>
<div><small>Revenue (TTM)</small><b data-usd="${c.r ?? ""}">${money(c.r)}</b></div><div><small>Earnings (TTM)</small><b data-usd="${c.e ?? ""}">${money(c.e)}</b></div>
<div><small>P/E ratio</small><b>${c.pe ?? "—"}</b></div><div><small>Dividend yield</small><b>${c.dy ? c.dy.toFixed(2) + "%" : "—"}</b></div>
<div><small>Employees</small><b>${c.emp ? c.emp.toLocaleString("en-US") : "—"}</b></div><div><small>1-year return</small><b>${pct(c.y1)}</b></div>
<div><small>52-week range</small><b>${price(c.lo)} – ${price(c.hi)}</b></div><div><small>Revenue / employee</small><b>${c.r && c.emp ? money(c.r / c.emp) : "—"}</b></div>
<div><small>Share of world cap</small><b>${((c.m / total) * 100).toFixed(3)}%</b></div><div><small>Local price</small><b>${esc(c.lp)} ${esc(c.cur)}</b></div></div>
${c.sp ? `<div class="card chart"><h3>Last 30 days</h3>${spark(c.sp, 900, 220, "bigspark")}</div>` : ""}
${ad("1000000010")}
<div class="card prose"><h2>About ${esc(name)}</h2><p>${esc(c.ds ?? `${name} is a ${c.ind ?? ""} company based in ${c.c}.`)}</p>
<p>As of ${updated.slice(0, 10)}, ${esc(name)} has a market capitalization of <b>${money(c.m)}</b>, making it the world's <b>#${c.rank}</b> most valuable public company among the ${companies.length.toLocaleString("en-US")} tracked by ${cfg.brand}.${c.pe ? ` It trades at ${c.pe}× trailing earnings.` : ""}</p></div>
${peers.length ? `<h2 class="group">Peers in ${esc(c.ind)}</h2><div class="tbl-wrap card"><table class="lb"><tbody>${companyRows(peers, "../../")}</tbody></table></div>` : ""}`,
  });
}
// ETF pages (top 2000)
for (const e of etfs.slice(0, 2000)) add(`etf/${e.slug}/index.html`, {
  title: `${e.n} (${e.s}) — ${cfg.brand}`, desc: `${e.n} has ${money(e.a)} in assets. Price, returns, fees and yield.`, page: { kind: "etfpage", s: e.s },
  body: `<nav class="crumbs"><a href="../../etfs/">ETFs</a> › <a href="../../etfs/${slug(e.type)}/">${esc(e.type)}</a> › ${esc(e.s)}</nav>
<section class="co-head"><span class="logo mono etf big">${esc(e.s.split(".")[0].slice(0, 4))}</span><div><h1>${esc(e.n)} <small>${esc(e.s)}</small></h1><p>${flag(e.c)} Listed in ${esc(e.c)} · ${esc(e.type)} ETF · #${e.rank} by assets</p></div>
<div class="co-actions"><button class="ghost" data-star="${esc(e.s)}">☆ Watch</button><a class="btn" href="${cfg.brokerAffiliateUrl}" rel="sponsored noopener" target="_blank">Buy ${esc(e.s.split(".")[0])} →</a></div></section>
<div class="kpis big"><div><small>Assets</small><b data-usd="${e.a}">${money(e.a)}</b></div><div><small>Price</small><b>${price(e.p)}</b> ${pct(e.ch)}</div><div><small>Expense ratio</small><b>${e.er != null ? e.er + "%" : "—"}</b></div>
<div><small>1-year return</small><b>${pct(e.y1)}</b></div><div><small>YTD return</small><b>${pct(e.ytd)}</b></div><div><small>Yield</small><b>${e.dy ? e.dy.toFixed(2) + "%" : "—"}</b></div></div>
${e.sp ? `<div class="card chart"><h3>Last 30 days</h3>${spark(e.sp, 900, 220, "bigspark")}</div>` : ""}${ad("1000000011")}`,
});

// Tools & info
add("compare/index.html", { title: `Compare companies — ${cfg.brand}`, desc: "Compare market cap, revenue, earnings and valuation of up to 4 companies side by side.", page: { kind: "compare" },
  body: hero("Compare companies", "Add up to four companies to compare them side by side. The link updates so you can share it.") + `<div class="cmp-add"><input id="cmpq" placeholder="Add a company (e.g. Apple, TSMC, Reliance)…" autocomplete="off"><div id="cmpres"></div></div><div id="cmp"></div>` + ad("1000000012") });
add("watchlist/index.html", { title: `Your watchlist — ${cfg.brand}`, desc: "Your starred companies and ETFs.", page: { kind: "watchlist" },
  body: hero("⭐ Watchlist", "Star companies or ETFs anywhere on the site. Your watchlist stays in this browser.") + `<div id="watch"></div>` });
add("pro/index.html", { title: `${cfg.brand} Pro`, desc: "Ad-free rankings, unlimited exports, alerts and API access.",
  body: `<section class="pricing">${hero(`${cfg.brand} <span class="grad">Pro</span>`, "For investors, analysts and researchers who live in this data.")}
<div class="plans"><div class="plan"><h3>Free</h3><p class="amt">$0</p><ul><li>All rankings & pages</li><li>Watchlist (this browser)</li><li>CSV export, top 100 rows</li></ul></div>
<div class="plan hot"><h3>Pro</h3><p class="amt">${cfg.proPrice}</p><ul><li>No ads</li><li>Unlimited CSV export, every list</li><li>Daily movers email</li><li>Synced watchlists & price alerts</li><li>JSON data API</li></ul>
<a class="btn" href="${cfg.proCheckoutUrl || cfg.supportUrl}" rel="noopener">${cfg.proCheckoutUrl ? "Upgrade now" : "Join the waitlist"}</a></div></div></section>` });
add("advertise/index.html", { title: `Advertise on ${cfg.brand}`, desc: "Reach investors researching the world's largest companies.",
  body: hero(`Advertise on ${cfg.brand}`, "Put your brand in front of investors, analysts and finance students.") + `<div class="cols2"><div class="card"><h3>Placements</h3><ul><li>Homepage leaderboard banner</li><li>Sponsor a country or category page</li><li>Company page "Trade" button partnership (brokers)</li><li>ETF issuer spotlight</li></ul></div><div class="card"><h3>Get in touch</h3><p>Open an <a href="https://github.com/ayaan135/caprank/issues/new?title=Advertising%20inquiry">advertising inquiry</a> and we'll get back to you within two business days.</p></div></div>` });
add("api/index.html", { title: `Data & API — ${cfg.brand}`, desc: "Download the full dataset.",
  body: hero("Data & API", "The full dataset is available as JSON, refreshed several times a day.") + `<div class="card prose"><p><code>GET ${cfg.baseUrl}/data/companies.json</code>: every company: symbol, name, country, industry, market cap (USD), price, change, P/E, revenue, earnings, employees.</p><p><code>GET ${cfg.baseUrl}/data/etfs.json</code>: every ETF.</p><p>Free for personal use with attribution. Commercial licensing and higher-frequency data come with <a href="../pro/">Pro</a>.</p></div>` });
add("privacy/index.html", { title: `Privacy — ${cfg.brand}`, desc: "Privacy policy",
  body: hero("Privacy policy", "") + `<div class="card prose"><p>${cfg.brand} has no accounts. Your theme, currency and watchlist are stored only in your browser's local storage.</p><p>We use Google AdSense to show ads. Google may use cookies to serve ads based on your visits to this and other websites. You can opt out of personalized advertising at <a href="https://www.google.com/settings/ads">Google Ads Settings</a>.</p><p>Links to brokers may be affiliate links: if you open an account, we may earn a commission at no cost to you.</p></div>` });
add("404.html", { title: `Not found — ${cfg.brand}`, desc: "", body: hero("Page not found", `<a href="${cfg.baseUrl}/">Back to the leaderboard</a>`) });

// ---------- write ----------
await rm(dist, { recursive: true, force: true });
const entries = [...pages];
for (let i = 0; i < entries.length; i += 400) {
  await Promise.all(entries.slice(i, i + 400).map(async ([p, html]) => {
    const f = new URL(p, dist);
    await mkdir(new URL(".", f), { recursive: true });
    await writeFile(f, html);
  }));
}
await cp(new URL("public/", root), dist, { recursive: true });
await mkdir(new URL("data/", dist), { recursive: true });
// Compact column-oriented payloads for the client
const C_KEYS = ["s", "n", "c", "ind", "m", "p", "ch", "y1", "pe", "e", "r", "emp", "dy", "w", "slug"];
await writeFile(new URL("data/companies.json", dist), JSON.stringify({ updated, keys: [...C_KEYS, "cats"], rows: companies.map((c) => [...C_KEYS.map((k) => c[k] ?? null), c.cats.map((k) => catList.findIndex((x) => x.name === k))]), cats: catList.map((k) => k.name) }));
await writeFile(new URL("data/sparks.json", dist), JSON.stringify(Object.fromEntries([...companies, ...etfs].filter((c) => c.sp).map((c) => [c.s, c.sp]))));
const E_KEYS = ["s", "n", "c", "a", "p", "ch", "y1", "ytd", "er", "dy", "type", "regions", "slug"];
await writeFile(new URL("data/etfs.json", dist), JSON.stringify({ updated, keys: E_KEYS, rows: etfs.map((e) => E_KEYS.map((k) => e[k] ?? null)) }));
await writeFile(new URL("data/companies.csv", dist), ["rank,symbol,name,country,industry,market_cap_usd,price_usd,change_pct,pe,revenue_usd,earnings_usd,employees",
  ...companies.slice(0, 100).map((c) => [c.rank, c.s, `"${c.n.replace(/"/g, "'")}"`, `"${c.c}"`, `"${c.ind}"`, c.m, c.p, c.ch, c.pe ?? "", c.r ?? "", c.e ?? "", c.emp ?? ""].join(","))].join("\n"));
const urls = [...pages.keys()].filter((p) => p !== "404.html").map((p) => `${cfg.baseUrl}/${p.replace(/index\.html$/, "")}`);
const maps = [];
for (let i = 0; i < urls.length; i += 40000) {
  const name = `sitemap-${maps.length}.xml`;
  maps.push(name);
  await writeFile(new URL(name, dist), `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.slice(i, i + 40000).map((u) => `<url><loc>${u}</loc><lastmod>${updated.slice(0, 10)}</lastmod></url>`).join("")}</urlset>`);
}
await writeFile(new URL("sitemap.xml", dist), `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${maps.map((m) => `<sitemap><loc>${cfg.baseUrl}/${m}</loc></sitemap>`).join("")}</sitemapindex>`);
await writeFile(new URL("robots.txt", dist), `User-agent: *\nAllow: /\nSitemap: ${cfg.baseUrl}/sitemap.xml\n`);
if (cfg.adsenseClient) await writeFile(new URL("ads.txt", dist), `google.com, ${cfg.adsenseClient.replace("ca-", "")}, DIRECT, f08c47fec0942fa0\n`);
await writeFile(new URL(".nojekyll", dist), "");
console.log(`built ${pages.size} pages · ${companies.length} companies · ${countries.length} countries · ${catList.length} categories · ${etfs.length} ETFs (${etfTypes.length} types)`);

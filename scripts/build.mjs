// Static site generator: data/*.json + templates -> dist/
import { mkdir, writeFile, readFile, rm, cp } from "node:fs/promises";
import { companies } from "../data/companies.mjs";
import cfg from "../site.config.mjs";

const root = new URL("../", import.meta.url);
const dist = new URL("dist/", root);
const { updated, quotes } = JSON.parse(await readFile(new URL("data/quotes.json", root), "utf8"));

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const money = (v) => {
  const a = Math.abs(v), s = v < 0 ? "-" : "";
  if (a >= 1e12) return `${s}$${(a / 1e12).toFixed(3)} T`;
  if (a >= 1e9) return `${s}$${(a / 1e9).toFixed(2)} B`;
  return `${s}$${(a / 1e6).toFixed(1)} M`;
};
const FLAGS = { USA: "🇺🇸", Taiwan: "🇹🇼", Netherlands: "🇳🇱", Germany: "🇩🇪", Japan: "🇯🇵", Denmark: "🇩🇰", UK: "🇬🇧", Switzerland: "🇨🇭", China: "🇨🇳", Sweden: "🇸🇪", Canada: "🇨🇦", India: "🇮🇳", Australia: "🇦🇺", France: "🇫🇷", Spain: "🇪🇸", Belgium: "🇧🇪", Italy: "🇮🇹", Argentina: "🇦🇷" };

const rows = companies
  .filter((c) => quotes[c.ticker])
  .map((c) => {
    const q = quotes[c.ticker];
    const mcap = q.price * c.shares * 1e9;
    return { ...c, ...q, mcap, slug: slug(c.name), pe: c.earn > 0 ? mcap / (c.earn * 1e9) : null };
  })
  .sort((a, b) => b.mcap - a.mcap)
  .map((r, i) => ({ ...r, rank: i + 1 }));
const total = rows.reduce((s, r) => s + r.mcap, 0);
const countries = [...new Set(rows.map((r) => r.country))].sort();
const sectors = [...new Set(rows.map((r) => r.sector))].sort();
const updatedText = new Date(updated).toUTCString().replace("GMT", "UTC");

const sparkSvg = (pts, w = 120, h = 34) => {
  if (!pts?.length) return "";
  const min = Math.min(...pts), max = Math.max(...pts), span = max - min || 1;
  const d = pts.map((p, i) => `${((i / (pts.length - 1)) * w).toFixed(1)},${(h - 2 - ((p - min) / span) * (h - 4)).toFixed(1)}`).join(" ");
  const up = pts[pts.length - 1] >= pts[0];
  return `<svg class="spark ${up ? "up" : "down"}" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true"><polyline fill="none" stroke-width="1.6" points="${d}"/></svg>`;
};
const logo = (r, size = 32) => `<img class="logo" loading="lazy" width="${size}" height="${size}" alt="" src="https://www.google.com/s2/favicons?domain=${r.domain}&sz=64">`;
const chg = (v) => `<span class="${v >= 0 ? "pos" : "neg"}">${v >= 0 ? "▲" : "▼"} ${Math.abs(v).toFixed(2)}%</span>`;

const ad = (slot, label = "Advertisement") => cfg.adsenseClient
  ? `<div class="ad"><ins class="adsbygoogle" style="display:block" data-ad-client="${cfg.adsenseClient}" data-ad-slot="${slot}" data-ad-format="auto" data-full-width-responsive="true"></ins><script>(adsbygoogle=window.adsbygoogle||[]).push({});</script></div>`
  : `<a class="ad house" href="${cfg.brokerAffiliateUrl}" rel="sponsored noopener" target="_blank"><small>${label}</small><b>Invest in the world's biggest companies</b><span>Open an account with ${esc(cfg.brokerName)} →</span></a>`;

const layout = ({ title, desc, path, body, depth = 0 }) => {
  const up = "../".repeat(depth) || "./";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><meta name="description" content="${esc(desc)}"><link rel="canonical" href="${cfg.baseUrl}/${path}">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:type" content="website">
<link rel="icon" href="${up}favicon.svg"><link rel="stylesheet" href="${up}style.css">
<script>try{document.documentElement.dataset.theme=localStorage.theme||(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light')}catch(e){}</script>
${cfg.adsenseClient ? `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${cfg.adsenseClient}" crossorigin="anonymous"></script>` : ""}
</head><body>
<div class="topbar"><div class="wrap"><span>Companies: <b>${rows.length}</b></span><span>Total market cap: <b>${money(total)}</b></span><span class="grow"></span>
<a class="btn-pro" href="${up}pro.html">★ Pro</a><button id="theme" aria-label="Toggle dark mode">◐</button></div></div>
<header><div class="wrap nav"><a class="brand" href="${up}"><svg width="26" height="26" viewBox="0 0 26 26"><rect x="1" y="16" width="6" height="9" rx="2" fill="#f59e0b"/><rect x="10" y="9" width="6" height="16" rx="2" fill="#f97316"/><rect x="19" y="1" width="6" height="24" rx="2" fill="#ef4444"/></svg>${cfg.brand}</a>
<nav><a href="${up}">Global ranking</a><a href="${up}countries.html">By country</a><a href="${up}sectors.html">By sector</a></nav>
<input id="q" type="search" placeholder="Company name, ticker…" autocomplete="off"><div id="results"></div></div></header>
<main class="wrap">${body}</main>
<footer><div class="wrap"><p><b>${cfg.brand}</b> — ${esc(cfg.tagline)}. Prices updated ${esc(updatedText)}. Market caps are estimates (price × shares outstanding); fundamentals are approximate. Not investment advice.</p>
<p><a href="${up}pro.html">Pro</a> · <a href="${up}advertise.html">Advertise</a> · <a href="${up}privacy.html">Privacy</a> · <a href="${cfg.supportUrl}" rel="noopener">Support us</a> · Some links are affiliate links.</p></div></footer>
<script>window.SITE_ROOT=${JSON.stringify(up)}</script><script src="${up}app.js" defer></script></body></html>`;
};

const table = (list, depth) => {
  const up = "../".repeat(depth) || "./";
  return `<div class="card"><table class="rank"><thead><tr>
<th data-k="rank" class="num">Rank</th><th data-k="name">Name</th><th data-k="mcap" class="num">Market Cap</th><th data-k="price" class="num">Price</th>
<th data-k="change" class="num">Today</th><th class="hide-sm">Price (30 days)</th><th data-k="country" class="hide-sm">Country</th></tr></thead><tbody>
${list.map((r, i) => `<tr data-rank="${r.rank}" data-name="${esc(r.name)}" data-mcap="${r.mcap}" data-price="${r.price}" data-change="${r.change}" data-country="${r.country}" data-rev="${r.rev}" data-earn="${r.earn}" data-emp="${r.emp}" data-pe="${r.pe ?? ""}">
<td class="num rk">${i + 1}</td><td><a class="co" href="${up}company/${r.slug}/">${logo(r)}<span><b>${esc(r.name)}</b><small>${r.ticker}</small></span></a></td>
<td class="num val">${money(r.mcap)}</td><td class="num">$${r.price.toFixed(2)}</td><td class="num">${chg(r.change)}</td>
<td class="hide-sm">${sparkSvg(r.spark)}</td><td class="hide-sm">${FLAGS[r.country] ?? ""} ${r.country}</td></tr>`).join("\n")}
</tbody></table></div>`;
};

const rankTabs = `<div class="tabs" role="tablist"><span>Rank by</span>
${[["mcap", "Market Cap"], ["earn", "Earnings"], ["rev", "Revenue"], ["emp", "Employees"], ["pe", "P/E ratio"], ["change", "Today's gain"]].map(([k, l], i) => `<button data-sort="${k}" class="${i ? "" : "on"}">${l}</button>`).join("")}</div>`;

const pages = new Map();
pages.set("index.html", layout({
  title: `${cfg.brand} — Largest Companies by Market Cap`, desc: `Ranking of the world's largest public companies by market capitalization, earnings, revenue and employees. Updated several times a day.`, path: "",
  body: `<h1>Largest Companies by Market Cap</h1><p class="sub">Companies: <b>${rows.length}</b> · total market cap: <b>${money(total)}</b> · <a href="data.csv" download data-pro>⬇ CSV</a></p>
${ad("1000000001")}${rankTabs}${table(rows, 0)}${ad("1000000002")}`,
}));

for (const r of rows) {
  const peers = rows.filter((p) => p.sector === r.sector && p !== r).slice(0, 6);
  pages.set(`company/${r.slug}/index.html`, layout({
    depth: 2, path: `company/${r.slug}/`,
    title: `${r.name} (${r.ticker}) Market Cap — ${cfg.brand}`,
    desc: `${r.name} market cap is ${money(r.mcap)}, ranking #${r.rank} among the world's largest companies. Price, revenue, earnings and employees.`,
    body: `<nav class="crumbs"><a href="../../">Ranking</a> › <a href="../../country/${slug(r.country)}.html">${r.country}</a> › ${esc(r.name)}</nav>
<div class="hero">${logo(r, 64)}<div><h1>${esc(r.name)} <small>${r.ticker}</small></h1><p>${r.sector} · ${FLAGS[r.country] ?? ""} ${r.country} · Rank <b>#${r.rank}</b></p></div>
<a class="cta" href="${cfg.brokerAffiliateUrl}" rel="sponsored noopener" target="_blank">Buy ${r.ticker} stock →</a></div>
<div class="stats">
<div><small>Market cap</small><b>${money(r.mcap)}</b></div><div><small>Share price</small><b>$${r.price.toFixed(2)}</b> ${chg(r.change)}</div>
<div><small>Revenue (TTM)</small><b>${money(r.rev * 1e9)}</b></div><div><small>Earnings (TTM)</small><b>${money(r.earn * 1e9)}</b></div>
<div><small>P/E ratio</small><b>${r.pe ? r.pe.toFixed(1) : "—"}</b></div><div><small>Employees</small><b>${Math.round(r.emp * 1000).toLocaleString("en-US")}</b></div>
<div><small>52-week range</small><b>$${r.low52?.toFixed(2)} – $${r.high52?.toFixed(2)}</b></div><div><small>Shares outstanding</small><b>${r.shares.toFixed(2)} B</b></div></div>
<div class="card chart"><h2>Price, last 30 days</h2>${sparkSvg(r.spark, 800, 220)}</div>
${ad("1000000003")}
<h2>As of ${new Date(updated).toISOString().slice(0, 10)}, ${esc(r.name)} has a market cap of ${money(r.mcap)}</h2>
<p>This makes ${esc(r.name)} the world's #${r.rank} most valuable company tracked by ${cfg.brand}. Market capitalization is the share price ($${r.price.toFixed(2)}) multiplied by the number of shares outstanding.</p>
${peers.length ? `<h2>Other ${esc(r.sector)} companies</h2>${table(peers, 2)}` : ""}`,
  }));
}

const groupPage = (kind, name, list) => layout({
  depth: 1, path: `${kind}/${slug(name)}.html`,
  title: `Largest ${kind === "country" ? `companies in ${name}` : `${name} companies`} by market cap — ${cfg.brand}`,
  desc: `Ranking of the largest ${name} companies by market capitalization.`,
  body: `<h1>Largest ${kind === "country" ? `companies in ${FLAGS[name] ?? ""} ${esc(name)}` : `${esc(name)} companies`}</h1>
<p class="sub">Companies: <b>${list.length}</b> · total market cap: <b>${money(list.reduce((s, r) => s + r.mcap, 0))}</b></p>${ad("1000000004")}${rankTabs}${table(list, 1)}`,
});
const indexPage = (kind, names, title) => layout({
  path: `${kind === "country" ? "countries" : "sectors"}.html`, title: `${title} — ${cfg.brand}`, desc: title,
  body: `<h1>${title}</h1><div class="grid">${names.map((n) => {
    const l = rows.filter((r) => r[kind === "country" ? "country" : "sector"] === n);
    return `<a class="tile" href="${kind}/${slug(n)}.html"><b>${kind === "country" ? (FLAGS[n] ?? "") + " " : ""}${esc(n)}</b><span>${l.length} companies · ${money(l.reduce((s, r) => s + r.mcap, 0))}</span></a>`;
  }).join("")}</div>`,
});
for (const c of countries) pages.set(`country/${slug(c)}.html`, groupPage("country", c, rows.filter((r) => r.country === c)));
for (const s of sectors) pages.set(`sector/${slug(s)}.html`, groupPage("sector", s, rows.filter((r) => r.sector === s)));
pages.set("countries.html", indexPage("country", countries, "Ranking by country"));
pages.set("sectors.html", indexPage("sector", sectors, "Ranking by sector"));

pages.set("pro.html", layout({
  path: "pro.html", title: `${cfg.brand} Pro`, desc: `Ad-free rankings, full CSV exports and alerts.`,
  body: `<div class="pro"><h1>★ ${cfg.brand} Pro</h1><p class="sub">Support independent data and get more out of it.</p>
<ul><li>✔ No ads, anywhere</li><li>✔ Unlimited CSV / Excel exports of every ranking</li><li>✔ Daily email digest of the biggest movers</li><li>✔ Watchlists synced across devices</li></ul>
<p class="price">${cfg.proPrice}</p>${cfg.proCheckoutUrl ? `<a class="cta" href="${cfg.proCheckoutUrl}">Upgrade now</a>` : `<a class="cta" href="${cfg.supportUrl}">Join the waitlist / sponsor</a>`}</div>`,
}));
pages.set("advertise.html", layout({
  path: "advertise.html", title: `Advertise on ${cfg.brand}`, desc: `Reach investors researching the world's largest companies.`,
  body: `<h1>Advertise on ${cfg.brand}</h1><p>Sponsor a company page, a country ranking, or the homepage banner. Our audience is investors, analysts and finance students.</p>
<p>Get in touch via <a href="https://github.com/ayaan135/caprank/issues/new?title=Advertising%20inquiry">this form</a>.</p>`,
}));
pages.set("privacy.html", layout({
  path: "privacy.html", title: `Privacy — ${cfg.brand}`, desc: "Privacy policy",
  body: `<h1>Privacy policy</h1><p>${cfg.brand} does not require an account and stores only your theme and watchlist preference in your browser. We use Google AdSense, which may use cookies to serve ads based on your visits to this and other sites; you can opt out at <a href="https://www.google.com/settings/ads">Google Ads Settings</a>. Outbound links to brokers may be affiliate links, which pay us a commission at no cost to you.</p>`,
}));

await rm(dist, { recursive: true, force: true });
for (const [p, html] of pages) {
  const f = new URL(p, dist);
  await mkdir(new URL(".", f), { recursive: true });
  await writeFile(f, html);
}
await cp(new URL("public/", root), dist, { recursive: true });
const csv = ["rank,name,ticker,country,sector,market_cap_usd,price_usd,change_pct,revenue_usd,earnings_usd,employees",
  ...rows.map((r) => [r.rank, `"${r.name}"`, r.ticker, r.country, r.sector, Math.round(r.mcap), r.price, r.change.toFixed(2), r.rev * 1e9, r.earn * 1e9, r.emp * 1000].join(","))].join("\n");
await writeFile(new URL("data.csv", dist), csv);
await writeFile(new URL("search.json", dist), JSON.stringify(rows.map((r) => [r.name, r.ticker, r.slug, r.domain])));
await writeFile(new URL("sitemap.xml", dist), `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${[...pages.keys()].map((p) => `<url><loc>${cfg.baseUrl}/${p.replace(/index\.html$/, "")}</loc><lastmod>${updated.slice(0, 10)}</lastmod></url>`).join("")}</urlset>`);
await writeFile(new URL("robots.txt", dist), `User-agent: *\nAllow: /\nSitemap: ${cfg.baseUrl}/sitemap.xml\n`);
if (cfg.adsenseClient) await writeFile(new URL("ads.txt", dist), `google.com, ${cfg.adsenseClient.replace("ca-", "")}, DIRECT, f08c47fec0942fa0\n`);
await writeFile(new URL(".nojekyll", dist), "");
console.log(`built ${pages.size} pages`);

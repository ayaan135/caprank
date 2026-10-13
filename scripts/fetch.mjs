// Builds data/market.json: every listed company >= MIN_CAP (USD) worldwide + ETFs, from Yahoo Finance.
// Usage: node scripts/fetch.mjs            (PROFILE_LIMIT=n controls how many company profiles to refresh this run)
import { readFile, writeFile } from "node:fs/promises";
import { session, yget, screen, quotes, sparks, profile, pool } from "./yahoo.mjs";
import { SUFFIX, COUNTRY_ALIAS } from "../data/taxonomy.mjs";

const MIN_CAP = 200e6, MIN_AUM = 50e6;
const PROFILE_LIMIT = +(process.env.PROFILE_LIMIT ?? 500);
const SPARK_COMPANIES = 3000, SPARK_ETFS = 600;
const OTC = new Set(["PNK", "OQB", "OQX", "OEM", "OGM", "YHD", "NCM"]);
const dataFile = (f) => new URL(`../data/${f}`, import.meta.url);
const readJson = async (f, d) => { try { return JSON.parse(await readFile(dataFile(f), "utf8")); } catch { return d; } };

await session();
const t0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(0)}s]`, ...a);

// 1. Industries
const SECTORS = ["technology", "basic-materials", "communication-services", "consumer-cyclical", "consumer-defensive", "energy", "financial-services", "healthcare", "industrials", "real-estate", "utilities"];
const industries = (await pool(SECTORS, 4, async (s) => {
  const d = (await yget(`https://query1.finance.yahoo.com/v1/finance/sectors/${s}`)).data;
  return d.industries.filter((i) => i.name !== "All Industries").map((i) => ({ sector: d.name, industry: i.name }));
})).flat().filter(Boolean);
log(`${industries.length} industries`);

// 2. Screen all equities per industry
const raw = [];
await pool(industries, 4, async ({ sector, industry }) => {
  await screen("EQUITY", [{ operator: "eq", operands: ["industry", industry.replace(" - ", "—")] }], "intradaymarketcap", (qs) => {
    for (const q of qs) raw.push({ ...q, sector, industry });
  });
});
log(`${raw.length} raw equity quotes`);

const suffixOf = (s) => (s.includes(".") ? s.split(".").pop() : "");
const majorCur = (c) => ({ GBp: "GBP", ZAc: "ZAR", ILA: "ILS" })[c] ?? c;
const minorDiv = (c) => (c === "GBp" || c === "ZAc" || c === "ILA" ? 100 : 1);

// 3. ETFs
const rawEtf = [];
await screen("ETF", [{ operator: "gt", operands: ["fundnetassets", 1e7] }], "fundnetassets", (qs) => rawEtf.push(...qs));
log(`${rawEtf.length} raw ETF quotes`);

// 4. FX
const curs = new Set([...raw, ...rawEtf].map((q) => majorCur(q.currency)).filter(Boolean));
const profiles = await readJson("profiles.json", {});
for (const p of Object.values(profiles)) if (p.revCur) curs.add(p.revCur);
for (const q of raw) if (q.financialCurrency) curs.add(q.financialCurrency);
curs.delete("USD");
const fx = { USD: 1 };
for (const q of await quotes([...curs].map((c) => `${c}USD=X`), "regularMarketPrice")) fx[q.symbol.slice(0, 3)] = q.regularMarketPrice;
log(`fx for ${Object.keys(fx).length} currencies`);
const toUsd = (v, cur) => (v != null && fx[majorCur(cur)] ? v * fx[majorCur(cur)] : null);

// 5. Normalize + dedupe companies across listings
const norm = (n) => n.toLowerCase().replace(/&amp;/g, "&").replace(/[.,()'’]/g, " ")
  .replace(/\b(the|inc|incorporated|corp|corporation|co|company|ltd|limited|plc|sa|s a|ag|nv|n v|se|spa|s p a|ab|asa|oyj|a s|as|bhd|berhad|tbk|pt|pcl|public|holdings?|group|class [a-c]|adr|ord|shares?)\b/g, " ")
  .replace(/\s+/g, " ").trim();
// Venues that mostly carry depositary receipts of foreign companies; their caps are unreliable unless currencies match.
const FOREIGN_VENUE = /\.(NE|BA|MX|SN|CL|VI|LM)$|\d{2}\.BK$|3[2-9]\.SA$|^0[A-Z0-9]{3}\.L$/;
const groups = new Map();
for (const q of raw) {
  const suf = suffixOf(q.symbol);
  if (!(suf in SUFFIX) || OTC.has(q.exchange) || !q.marketCap || !q.regularMarketPrice) continue;
  const name = (q.longName || q.shortName || q.symbol).replace(/&amp;/g, "&");
  if (q.symbol.includes("-P") || /\b(preferred|pref|warrants?|rights?|notes?|cedear|cdr|bdr|depositary)\b/i.test(name)) continue;
  const match = majorCur(q.currency) === q.financialCurrency;
  if (!match && FOREIGN_VENUE.test(q.symbol)) continue;
  const cap = toUsd(q.marketCap, q.currency);
  if (!cap) continue;
  const score = (match ? 4 : 0) + (FOREIGN_VENUE.test(q.symbol) ? 0 : 2) + (/\.(BO|TWO|V|KQ)$/.test(q.symbol) ? 0 : 1)
    + Math.log10(1 + (q.averageDailyVolume3Month ?? 0) * q.regularMarketPrice) / 20;
  const key = norm(name) || q.symbol;
  const prev = groups.get(key);
  if (!prev || score > prev.score) groups.set(key, { q, cap, score, name });
}
const companies = [...groups.values()].filter((c) => c.cap >= MIN_CAP).sort((a, b) => b.cap - a.cap);
log(`${companies.length} companies >= $${MIN_CAP / 1e6}M`);

// 6. Profiles (country, revenue, employees, website) — refreshed incrementally, largest first
const now = Date.now(), MONTH = 30 * 864e5;
const stale = companies.filter(({ q }) => !profiles[q.symbol] || now - profiles[q.symbol].t > MONTH).slice(0, PROFILE_LIMIT);
let done = 0;
await pool(stale, 6, async ({ q }) => {
  const p = await profile(q.symbol);
  profiles[q.symbol] = { ...(p ?? {}), t: now };
  if (++done % 250 === 0) log(`profiles ${done}/${stale.length}`);
});
await writeFile(dataFile("profiles.json"), JSON.stringify(profiles));
log(`profiles refreshed: ${stale.length}`);

// 7. Sparklines
const seenEtf = new Set();
const etfs = rawEtf.filter((q) => !OTC.has(q.exchange) && q.regularMarketPrice && (suffixOf(q.symbol) in SUFFIX) && !FOREIGN_VENUE.test(q.symbol))
  .map((q) => ({ q, aum: toUsd(q.netAssets, q.currency) })).filter((e) => e.aum >= MIN_AUM)
  .sort((a, b) => b.aum - a.aum || (suffixOf(a.q.symbol) ? 1 : -1))
  .filter(({ q }) => { const k = (q.longName || q.shortName || q.symbol).toLowerCase(); return !seenEtf.has(k) && seenEtf.add(k); });
const sp = await sparks([...companies.slice(0, SPARK_COMPANIES).map((c) => c.q.symbol), ...etfs.slice(0, SPARK_ETFS).map((e) => e.q.symbol)]);
log(`sparks: ${Object.keys(sp).length}`);

// 8. Output
const r2 = (v, d = 2) => (v == null || !isFinite(v) ? null : +v.toFixed(d));
const domain = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return null; } };
const out = {
  updated: new Date().toISOString(),
  fx,
  companies: companies.map(({ q, cap, name }) => {
    const p = profiles[q.symbol] ?? {};
    const div = minorDiv(q.currency);
    const country = COUNTRY_ALIAS[p.country] ?? p.country ?? SUFFIX[suffixOf(q.symbol)];
    return {
      s: q.symbol, n: name, c: country, sec: q.sector, ind: q.industry,
      m: Math.round(cap), p: r2(toUsd(q.regularMarketPrice / div, q.currency), 4), lp: q.regularMarketPrice, cur: q.currency,
      ch: r2(q.regularMarketChangePercent), y1: r2(q.fiftyTwoWeekChangePercent),
      pe: q.trailingPE > 0 ? r2(q.trailingPE, 1) : null,
      e: q.trailingPE > 0 ? Math.round(cap / q.trailingPE) : q.epsTrailingTwelveMonths < 0 && q.sharesOutstanding ? Math.round(toUsd(q.epsTrailingTwelveMonths * q.sharesOutstanding / div, q.currency)) : null,
      r: p.rev ? Math.round(toUsd(p.rev, p.revCur ?? q.financialCurrency) ?? 0) || null : null,
      emp: p.emp ?? null, dy: q.dividendYield ?? null, w: domain(p.web), ds: p.desc ?? null, city: p.city ?? null,
      hi: r2(toUsd(q.fiftyTwoWeekHigh / div, q.currency)), lo: r2(toUsd(q.fiftyTwoWeekLow / div, q.currency)),
      sp: sp[q.symbol]?.map((v) => r2(v, 3)) ?? null,
    };
  }),
  etfs: etfs.map(({ q, aum }) => ({
    s: q.symbol, n: (q.longName || q.shortName || q.symbol).replace(/&amp;/g, "&"), c: SUFFIX[suffixOf(q.symbol)], a: Math.round(aum),
    p: r2(toUsd(q.regularMarketPrice / minorDiv(q.currency), q.currency), 4), ch: r2(q.regularMarketChangePercent),
    y1: r2(q.fiftyTwoWeekChangePercent), ytd: r2(q.ytdReturn), er: r2(q.netExpenseRatio), dy: r2(q.trailingAnnualDividendYield * 100),
    sp: sp[q.symbol]?.map((v) => r2(v, 3)) ?? null,
  })),
};
await writeFile(dataFile("market.json"), JSON.stringify(out));
log(`wrote ${out.companies.length} companies, ${out.etfs.length} ETFs`);

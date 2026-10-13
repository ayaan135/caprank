// Pulls live price + 30-day history for every company and writes data/quotes.json.
import { writeFile, readFile } from "node:fs/promises";
import { companies } from "../data/companies.mjs";

const OUT = new URL("../data/quotes.json", import.meta.url);
let previous = {};
try { previous = JSON.parse(await readFile(OUT, "utf8")).quotes ?? {}; } catch {}

async function quote(ticker) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=1mo&interval=1d`;
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 CapRankBot" } });
  if (!res.ok) throw new Error(`${ticker}: HTTP ${res.status}`);
  const r = (await res.json()).chart.result[0];
  const closes = r.indicators.quote[0].close.filter((c) => c != null);
  const price = r.meta.regularMarketPrice;
  const prev = r.meta.chartPreviousClose && closes.length > 1 ? closes[closes.length - 2] : r.meta.chartPreviousClose;
  return {
    price,
    change: r.meta.regularMarketChangePercent ?? (prev ? ((price - prev) / prev) * 100 : 0),
    high52: r.meta.fiftyTwoWeekHigh,
    low52: r.meta.fiftyTwoWeekLow,
    spark: closes.map((c) => +c.toFixed(2)),
  };
}

const quotes = {};
const queue = [...companies];
await Promise.all(Array.from({ length: 6 }, async () => {
  for (let c; (c = queue.shift()); ) {
    try { quotes[c.ticker] = await quote(c.ticker); }
    catch (e) { console.warn("skip", e.message); if (previous[c.ticker]) quotes[c.ticker] = previous[c.ticker]; }
  }
}));

await writeFile(OUT, JSON.stringify({ updated: new Date().toISOString(), quotes }));
console.log(`fetched ${Object.keys(quotes).length}/${companies.length}`);

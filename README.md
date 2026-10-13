# CapRank

The world's public companies and ETFs, ranked live: **~19,500 companies in 80+ countries, 57 categories, ~6,000 ETFs in 34 types + 13 regions**.

**Features:** a leaderboard you can re-rank by market cap, earnings, revenue, employees, P/E, dividend, 1Y return or today's move; filters by country, category and watchlist · market heatmap (treemap) · today's movers · company and ETF pages · side-by-side compare (shareable URL) · watchlist · Ctrl+K command palette · 9 display currencies · dark/light theme · CSV export · JSON data endpoints.

Zero runtime dependencies. Node scripts pull data from Yahoo Finance and generate a static site. GitHub Actions refreshes it every 30 minutes during US market hours and deploys to GitHub Pages.

```
npm run fetch   # ~4 min: screen every industry worldwide -> data/market.json (+ profile cache)
npm run build   # ~30 s: generate dist/ (~22k pages)
npm run dev     # build + serve locally
```

## Monetization

Set as GitHub **repository variables** (Settings → Secrets and variables → Actions → Variables):

| Variable | Purpose |
|---|---|
| `ADSENSE_CLIENT` | `ca-pub-…`: turns on AdSense in every ad slot and writes `ads.txt`. Until it's set, slots show a broker affiliate banner. |
| `BROKER_URL` | Brokerage referral link: banner and the "Trade" button on every company and ETF page. |
| `PRO_URL` | Stripe Payment Link / Gumroad checkout for CapRank Pro. |
| `SITE_URL` | Custom domain, if you add one. |

Also: an `/advertise/` sponsorship page, and Pro-gated exports (free = top 100 rows).

## Data notes

Companies are de-duplicated across their listings. The home listing, where the quote currency matches the reporting currency, wins. Caps are converted to USD at live FX. Country, revenue, employees and website come from company profiles. These are cached in `data/profiles.json` and refreshed about 400 per run.

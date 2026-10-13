# CapRank

The world's largest public companies ranked by market cap, earnings, revenue, employees and P/E, with pages per company, country and sector.

Zero dependencies: Node scripts fetch quotes and generate a static site. GitHub Actions refreshes prices every 30 minutes during US market hours and deploys to GitHub Pages.

```
npm run fetch   # pull live prices -> data/quotes.json
npm run build   # generate dist/
npm run dev     # build + serve locally
```

## Monetization

Set these as GitHub **repository variables** (Settings → Secrets and variables → Actions → Variables):

| Variable | Purpose |
|---|---|
| `ADSENSE_CLIENT` | `ca-pub-…` AdSense id. Turns on ad slots and `ads.txt`. Until set, slots show a broker affiliate banner. |
| `BROKER_URL` | Your brokerage referral/affiliate link (banner + "Buy stock" button on every company page). |
| `PRO_URL` | Stripe Payment Link / Gumroad checkout for CapRank Pro. |
| `SITE_URL` | Custom domain, if you add one. |

Also: `advertise.html` sells direct sponsorships.

## Data

`data/companies.mjs` lists the companies, with shares outstanding and approximate fundamentals. Add a row to track a new company. Market cap = live price × shares outstanding.

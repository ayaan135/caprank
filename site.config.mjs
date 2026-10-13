// Edit these to turn on revenue. Empty values hide the related UI.
export default {
  brand: "CapRank",
  tagline: "Largest companies ranked by market cap",
  baseUrl: process.env.SITE_URL || "https://ayaan135.github.io/caprank",
  // Google AdSense publisher id, e.g. "ca-pub-1234567890123456". Until set, house ads fill the slots.
  adsenseClient: process.env.ADSENSE_CLIENT || "",
  // Affiliate link for a brokerage (e.g. Interactive Brokers, eToro, Zerodha referral link).
  brokerAffiliateUrl: process.env.BROKER_URL || "https://www.interactivebrokers.com/",
  brokerName: "Interactive Brokers",
  // Paid "Pro" product: a Stripe Payment Link / Gumroad / Lemon Squeezy checkout URL.
  proCheckoutUrl: process.env.PRO_URL || "",
  proPrice: "$5/month",
  // Tip jar
  supportUrl: process.env.SUPPORT_URL || "https://github.com/sponsors/ayaan135",
};

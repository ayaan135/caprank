// Minimal Yahoo Finance client: cookie + crumb session, retries, concurrency helper.
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
let cookie = "", crumb = "";

export async function session() {
  const r = await fetch("https://fc.yahoo.com", { headers: { "User-Agent": UA }, redirect: "manual" }).catch(() => null);
  cookie = (r?.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
  crumb = await (await fetch("https://query1.finance.yahoo.com/v1/test/getcrumb", { headers: { "User-Agent": UA, cookie } })).text();
  if (!crumb || crumb.includes("<")) throw new Error("could not get Yahoo crumb");
}

export async function yget(url, body, tries = 4) {
  const u = url + (url.includes("?") ? "&" : "?") + "crumb=" + encodeURIComponent(crumb);
  for (let i = 0; ; i++) {
    try {
      const res = await fetch(u, {
        method: body ? "POST" : "GET",
        headers: { "User-Agent": UA, cookie, ...(body && { "Content-Type": "application/json" }) },
        body: body && JSON.stringify(body),
      });
      if (res.status === 401 && i < tries) { await session(); continue; }
      if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
      return await res.json();
    } catch (e) {
      if (i >= tries) throw e;
      await new Promise((r) => setTimeout(r, 1000 * 2 ** i));
    }
  }
}

export async function pool(items, n, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (next < items.length) { const i = next++; out[i] = await fn(items[i], i).catch((e) => (console.warn(e.message), null)); }
  }));
  return out;
}

export async function screen(quoteType, operands, sortField, cb) {
  for (let offset = 0; ; offset += 250) {
    const j = await yget("https://query1.finance.yahoo.com/v1/finance/screener?formatted=false&lang=en-US", {
      size: 250, offset, sortField, sortType: "DESC", quoteType,
      query: { operator: "AND", operands },
    });
    const res = j.finance.result[0];
    cb(res.quotes);
    if (offset + 250 >= res.total || offset >= 9750) return;
  }
}

export async function quotes(symbols, fields) {
  const out = [];
  for (let i = 0; i < symbols.length; i += 100) {
    const j = await yget(`https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbols.slice(i, i + 100).map(encodeURIComponent).join(",")}${fields ? "&fields=" + fields : ""}`);
    out.push(...j.quoteResponse.result);
  }
  return out;
}

export async function sparks(symbols) {
  const map = {};
  const batches = [];
  for (let i = 0; i < symbols.length; i += 20) batches.push(symbols.slice(i, i + 20));
  await pool(batches, 6, async (b) => {
    const j = await yget(`https://query1.finance.yahoo.com/v8/finance/spark?symbols=${b.map(encodeURIComponent).join(",")}&range=1mo&interval=1d`);
    for (const [s, v] of Object.entries(j)) map[s] = (v.close ?? []).filter((x) => x != null);
  });
  return map;
}

export async function profile(symbol) {
  const j = await yget(`https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=assetProfile,financialData`);
  const r = j.quoteSummary.result?.[0];
  if (!r) return null;
  const a = r.assetProfile ?? {}, f = r.financialData ?? {};
  return {
    country: a.country, emp: a.fullTimeEmployees, web: a.website, desc: a.longBusinessSummary?.slice(0, 600),
    city: a.city, rev: f.totalRevenue?.raw, revCur: f.financialCurrency,
  };
}

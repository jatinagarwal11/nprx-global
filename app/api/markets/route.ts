type YahooChart = {
  chart?: {
    result?: Array<{
      meta?: {
        regularMarketPrice?: number;
        chartPreviousClose?: number;
        previousClose?: number;
        regularMarketTime?: number;
        marketState?: string;
      };
      timestamp?: number[];
      indicators?: { quote?: Array<{ close?: Array<number | null> }> };
    }>;
  };
};

type NrbPayload = {
  date?: string;
  rates?: Array<{
    currency?: { iso3?: string; unit?: number };
    buy?: string;
    sell?: string;
  }>;
};

type MarketDefinition = {
  id: "wti" | "brent" | "usdnpr";
  symbol: string;
  name: string;
  shortName: string;
  unit: string;
  hedgeUse: string;
  fallbackPrice: number;
  fallbackPrevious: number;
};

const definitions: MarketDefinition[] = [
  {
    id: "wti",
    symbol: "CL=F",
    name: "WTI Crude Oil",
    shortName: "WTI",
    unit: "USD / barrel",
    hedgeUse: "Fuel, transport and energy-input costs",
    fallbackPrice: 87.5,
    fallbackPrevious: 84.34,
  },
  {
    id: "brent",
    symbol: "BZ=F",
    name: "Brent Crude Oil",
    shortName: "BRENT",
    unit: "USD / barrel",
    hedgeUse: "Imported petroleum and global freight exposure",
    fallbackPrice: 94.18,
    fallbackPrevious: 91.01,
  },
  {
    id: "usdnpr",
    symbol: "NPR=X",
    name: "USD / NPR",
    shortName: "USD/NPR",
    unit: "NPR per USD",
    hedgeUse: "Dollar invoices, imports and currency budgets",
    fallbackPrice: 154.242,
    fallbackPrevious: 153.983,
  },
];

async function fetchYahooMarket(definition: MarketDefinition) {
  const symbol = encodeURIComponent(definition.symbol);
  const response = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=5m&range=1d`,
    {
      headers: { "User-Agent": "NPRX-Global-Devnet-Demo/2.0" },
      cf: { cacheTtl: 20, cacheEverything: true },
    } as RequestInit,
  );
  if (!response.ok) throw new Error(`quote request failed (${response.status})`);

  const payload = (await response.json()) as YahooChart;
  const chart = payload.chart?.result?.[0];
  const price = chart?.meta?.regularMarketPrice;
  if (!price || !Number.isFinite(price)) throw new Error("quote was unavailable");

  const previous =
    chart?.meta?.chartPreviousClose ?? chart?.meta?.previousClose ?? price;
  const closes = chart?.indicators?.quote?.[0]?.close ?? [];
  const timestamps = chart?.timestamp ?? [];
  const points = closes
    .map((value, index) => ({ value, time: timestamps[index] }))
    .filter(
      (point): point is { value: number; time: number } =>
        typeof point.value === "number" && typeof point.time === "number",
    )
    .slice(-30);

  return {
    ...definition,
    price,
    previousClose: previous,
    change: price - previous,
    changePct: previous ? ((price - previous) / previous) * 100 : 0,
    updatedAt: new Date(
      (chart?.meta?.regularMarketTime ?? Math.floor(Date.now() / 1_000)) * 1_000,
    ).toISOString(),
    marketState: chart?.meta?.marketState ?? "UNKNOWN",
    points,
    provider: "Yahoo Finance · indicative delayed quote",
    isFallback: false,
  };
}

async function fetchNrbReference() {
  const to = new Date();
  const from = new Date(to.getTime() - 8 * 24 * 60 * 60 * 1_000);
  const date = (value: Date) => value.toISOString().slice(0, 10);
  const params = new URLSearchParams({
    page: "1",
    per_page: "10",
    from: date(from),
    to: date(to),
  });
  const response = await fetch(
    `https://www.nrb.org.np/api/forex/v1/rates?${params.toString()}`,
    {
      headers: { "User-Agent": "NPRX-Global-Devnet-Demo/2.0" },
      cf: { cacheTtl: 900, cacheEverything: true },
    } as RequestInit,
  );
  if (!response.ok) throw new Error("NRB reference unavailable");
  const payload = (await response.json()) as {
    data?: { payload?: NrbPayload[] };
  };
  const latest = [...(payload.data?.payload ?? [])]
    .filter((item) => item.date)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
  const usd = latest?.rates?.find((rate) => rate.currency?.iso3 === "USD");
  if (!usd) throw new Error("USD reference unavailable");
  const buy = Number(usd.buy);
  const sell = Number(usd.sell);
  return {
    date: latest.date,
    buy,
    sell,
    mid: (buy + sell) / 2,
    provider: "Nepal Rastra Bank · official daily reference",
  };
}

export async function GET() {
  const settled = await Promise.allSettled(
    definitions.map((definition) => fetchYahooMarket(definition)),
  );
  const markets = settled.map((result, index) => {
    if (result.status === "fulfilled") return result.value;
    const definition = definitions[index];
    const price = definition.fallbackPrice;
    const previous = definition.fallbackPrevious;
    return {
      ...definition,
      price,
      previousClose: previous,
      change: price - previous,
      changePct: ((price - previous) / previous) * 100,
      updatedAt: new Date().toISOString(),
      marketState: "FALLBACK",
      points: [previous, previous * 1.002, price * 0.998, price].map(
        (value, index) => ({
          value,
          time: Math.floor(Date.now() / 1_000) - (3 - index) * 300,
        }),
      ),
      provider: "Demo fallback · live provider temporarily unavailable",
      isFallback: true,
    };
  });

  let nrbReference = null;
  try {
    nrbReference = await fetchNrbReference();
  } catch {
    nrbReference = null;
  }

  return Response.json(
    { markets, nrbReference, asOf: new Date().toISOString() },
    {
      headers: {
        "Cache-Control": "public, max-age=20, stale-while-revalidate=60",
      },
    },
  );
}

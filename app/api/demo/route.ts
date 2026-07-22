import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";

export const dynamic = "force-dynamic";

type DemoStatement = {
  bind: (...values: unknown[]) => DemoStatement;
  all: <T = Record<string, unknown>>() => Promise<{ results?: T[] }>;
  first: <T = Record<string, unknown>>() => Promise<T | null>;
  run: () => Promise<{ meta?: { changes?: number }; changes?: number }>;
};

type DemoDb = {
  prepare: (sql: string) => DemoStatement;
  batch: (statements: DemoStatement[]) => Promise<unknown[]>;
};

type DemoAccount = {
  id: string;
  email: string;
  display_name: string;
  company: string;
  role: string;
  hedge_story: string;
  available_balance: number;
  funding_total: number;
  withdrawn_total: number;
  owner_key?: string | null;
  claimed_at?: string | null;
  created_at: string;
};

type DemoOrder = {
  id: string;
  user_id: string;
  market_id: string;
  side: "long" | "short";
  notional: number;
  posted_price: number;
  status: string;
  created_at: string;
};

type DemoTrade = {
  id: string;
  match_id: string;
  market_id: string;
  long_user_id: string;
  short_user_id: string;
  notional: number;
  price: number;
};

const MAX_LIFETIME_FUNDING = 1_000_000;
const validMarkets = new Set(["wti", "brent", "usdnpr"]);
const MEMO_PROGRAM_ID = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr";
const SOLANA_DEVNET_RPC = "https://api.devnet.solana.com";

type ViewerIdentity = { ownerKey: string; displayName: string };

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

const seedAccounts = [
  ["person1", "Asha Shrestha", "Himal Agro Imports", "Procurement Director", "Imports goods priced in USD and pays fuel-linked freight. Long oil and USD/NPR hedges can stabilise landed cost.", 300000],
  ["person2", "Bikash Karki", "Surya Solar Nepal", "Commercial Director", "Benefits when conventional energy becomes more expensive. Short oil exposure can smooth that natural sensitivity.", 300000],
  ["person3", "Nima Gurung", "Everest Freight & Logistics", "Operations Manager", "Fuel and dollar-priced equipment pressure margins. Long oil and USD/NPR hedges can reduce budget shocks.", 450000],
  ["person4", "Maya Rana", "Annapurna Garment Exports", "Treasury Lead", "Receives USD export revenue. Short USD/NPR exposure can stabilise the NPR value of expected receipts.", 500000],
  ["participant5", "Sanjay Thapa", "Koshi Cold Chain", "Finance Manager", "Electricity, diesel and imported refrigeration equipment create oil and dollar exposure.", 600000],
  ["participant6", "Rojina Lama", "Himalayan Tea Export", "Export Director", "Future USD receipts create a natural long USD/NPR position that may be hedged short.", 550000],
  ["participant7", "Prakash Yadav", "Terai Plastics", "Plant Controller", "Petrochemical inputs and freight create a natural short-oil business exposure.", 650000],
  ["participant8", "Anu Maharjan", "Valley EV Mobility", "Strategy Lead", "Higher oil prices can strengthen EV demand, creating an economic long-oil sensitivity.", 500000],
  ["participant9", "Tsering Sherpa", "Summit Hospitality", "Finance Director", "Imported equipment, food and transport costs create USD and fuel exposure.", 700000],
  ["participant10", "Deepak Chaudhary", "Lumbini Rice Exports", "Commercial Manager", "Expected foreign-currency receipts create an implicit long USD/NPR position.", 500000],
  ["participant11", "Sarita Rai", "Eastern Aviation Services", "Treasury Manager", "Jet-fuel costs make the business naturally short oil and sensitive to USD appreciation.", 750000],
  ["participant12", "Ramesh Adhikari", "Gandaki Hydro Systems", "Operations Director", "Renewable generation can benefit when fossil-fuel prices rise, supporting an opposing oil hedge.", 600000],
] as const;

function getDemoDb() {
  const db = (env as unknown as { DB?: DemoDb }).DB;
  if (!db) throw new Error("The shared paper-market database is unavailable.");
  return db;
}

async function getViewerIdentity(): Promise<ViewerIdentity | null> {
  const user = await getChatGPTUser();
  if (!user) return null;
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`nprx-owner-v1:${user.email.trim().toLowerCase()}`),
  );
  const ownerKey = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return { ownerKey: `chatgpt:${ownerKey}`, displayName: user.fullName ?? user.displayName };
}

async function requireOwnedAccount(db: DemoDb, identity: ViewerIdentity | null, userId: string) {
  if (!identity) throw new ApiError("Sign in with ChatGPT to continue", 401);
  const account = await db.prepare("SELECT * FROM demo_accounts WHERE id = ? AND owner_key = ?")
    .bind(userId, identity.ownerKey).first<DemoAccount>();
  if (!account) throw new ApiError("This participant is not linked to your signed-in identity", 403);
  return account;
}

async function verifySolanaReceipt(signature: string, walletAddress: string, tradeId: string) {
  const rpcResponse = await fetch(SOLANA_DEVNET_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "nprx-receipt-check",
      method: "getTransaction",
      params: [signature, { encoding: "jsonParsed", commitment: "confirmed", maxSupportedTransactionVersion: 0 }],
    }),
  });
  if (!rpcResponse.ok) return false;
  const rpc = await rpcResponse.json() as { result?: { meta?: { err?: unknown }; transaction?: unknown } | null };
  if (!rpc.result || rpc.result.meta?.err) return false;
  const transactionText = JSON.stringify(rpc.result);
  return transactionText.includes(MEMO_PROGRAM_ID) && transactionText.includes(walletAddress) && transactionText.includes(tradeId);
}

async function batchInChunks(db: DemoDb, statements: DemoStatement[], size = 40) {
  for (let index = 0; index < statements.length; index += size) {
    await db.batch(statements.slice(index, index + size));
  }
}

async function ensureDemoState(db: DemoDb) {
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS demo_accounts (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      company TEXT NOT NULL,
      role TEXT NOT NULL,
      hedge_story TEXT NOT NULL,
      available_balance INTEGER NOT NULL,
      funding_total INTEGER NOT NULL DEFAULT 0,
      withdrawn_total INTEGER NOT NULL DEFAULT 0,
      owner_key TEXT,
      claimed_at TEXT,
      created_at TEXT NOT NULL DEFAULT '2026-07-22T00:00:00.000Z'
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS demo_orders (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, market_id TEXT NOT NULL, side TEXT NOT NULL,
      notional INTEGER NOT NULL, posted_price REAL NOT NULL, status TEXT NOT NULL DEFAULT 'open',
      counterparty_id TEXT, match_price REAL, created_at TEXT NOT NULL, matched_at TEXT
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS demo_positions (
      id TEXT PRIMARY KEY, match_id TEXT NOT NULL, user_id TEXT NOT NULL, counterparty_id TEXT NOT NULL,
      market_id TEXT NOT NULL, side TEXT NOT NULL, notional INTEGER NOT NULL, entry_price REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'open', created_at TEXT NOT NULL, signature TEXT
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS demo_deposits (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, amount INTEGER NOT NULL,
      reference TEXT NOT NULL UNIQUE, rail TEXT NOT NULL, created_at TEXT NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS demo_withdrawals (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, amount INTEGER NOT NULL,
      reference TEXT NOT NULL UNIQUE, status TEXT NOT NULL DEFAULT 'simulated', created_at TEXT NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS demo_audit_events (
      id TEXT PRIMARY KEY, kind TEXT NOT NULL, actor_id TEXT, title TEXT NOT NULL,
      detail TEXT NOT NULL, created_at TEXT NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS demo_trades (
      id TEXT PRIMARY KEY, match_id TEXT NOT NULL UNIQUE, market_id TEXT NOT NULL,
      long_user_id TEXT NOT NULL, short_user_id TEXT NOT NULL, notional INTEGER NOT NULL,
      price REAL NOT NULL, status TEXT NOT NULL DEFAULT 'matched', chain_signature TEXT, created_at TEXT NOT NULL
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS demo_orders_status_idx ON demo_orders(status)"),
    db.prepare("CREATE INDEX IF NOT EXISTS demo_positions_user_idx ON demo_positions(user_id)"),
    db.prepare("CREATE INDEX IF NOT EXISTS demo_trades_created_idx ON demo_trades(created_at)"),
    db.prepare("CREATE INDEX IF NOT EXISTS demo_withdrawals_user_idx ON demo_withdrawals(user_id)"),
  ]);

  const accountColumns = await db.prepare("PRAGMA table_info(demo_accounts)").all<{ name: string }>();
  const existingColumns = new Set((accountColumns.results ?? []).map((column) => column.name));
  const accountUpgrades: DemoStatement[] = [];
  if (!existingColumns.has("funding_total")) accountUpgrades.push(db.prepare("ALTER TABLE demo_accounts ADD COLUMN funding_total INTEGER NOT NULL DEFAULT 0"));
  if (!existingColumns.has("withdrawn_total")) accountUpgrades.push(db.prepare("ALTER TABLE demo_accounts ADD COLUMN withdrawn_total INTEGER NOT NULL DEFAULT 0"));
  if (!existingColumns.has("owner_key")) accountUpgrades.push(db.prepare("ALTER TABLE demo_accounts ADD COLUMN owner_key TEXT"));
  if (!existingColumns.has("claimed_at")) accountUpgrades.push(db.prepare("ALTER TABLE demo_accounts ADD COLUMN claimed_at TEXT"));
  if (!existingColumns.has("created_at")) accountUpgrades.push(db.prepare("ALTER TABLE demo_accounts ADD COLUMN created_at TEXT NOT NULL DEFAULT '2026-07-22T00:00:00.000Z'"));
  if (accountUpgrades.length) await db.batch(accountUpgrades);
  await db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS demo_accounts_owner_key_idx ON demo_accounts(owner_key) WHERE owner_key IS NOT NULL").run();

  const accountStatements = seedAccounts.map(([id, name, company, role, story, funded], index) =>
    db.prepare(`INSERT OR IGNORE INTO demo_accounts
      (id, email, display_name, company, role, hedge_story, available_balance, funding_total, withdrawn_total, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`)
      .bind(id, `${id}@market.nprx`, name, company, role, story, Math.max(100000, funded - 100000), funded, new Date(Date.UTC(2026, 6, 12 + (index % 6), 4, index * 3)).toISOString()),
  );
  await batchInChunks(db, accountStatements);

  await db.batch([
    db.prepare(`UPDATE demo_accounts SET funding_total = CASE id
      WHEN 'person1' THEN 300000 WHEN 'person2' THEN 300000 WHEN 'person3' THEN 450000 WHEN 'person4' THEN 500000
      ELSE funding_total END WHERE id IN ('person1','person2','person3','person4') AND funding_total = 0`),
    db.prepare("UPDATE demo_deposits SET rail = 'Paper funding faucet', reference = 'TNPR-LEGACY-' || id WHERE rail != 'Paper funding faucet'"),
    db.prepare("UPDATE demo_audit_events SET kind = 'funding', title = 'Paper funds credited', detail = 'Legacy paper funding record migrated to the capped faucet' WHERE kind = 'deposit'"),
  ]);

  const fundingStatements = seedAccounts.map(([id, , , , , funded]) =>
    db.prepare(`INSERT OR IGNORE INTO demo_deposits (id, user_id, amount, reference, rail, created_at)
      VALUES (?, ?, ?, ?, 'Paper funding faucet', ?)`)
      .bind(`funding-${id}`, id, funded, `TNPR-SEED-${id.toUpperCase()}`, "2026-07-17T04:00:00.000Z"),
  );
  await batchInChunks(db, fundingStatements);

  const openPositionSeeds = [
    ["match-brent-1044", "person1", "person2", "brent", 40000, 91.8, "2026-07-18T05:10:00.000Z"],
    ["match-fx-0921", "person1", "person2", "usdnpr", 25000, 153.9, "2026-07-20T06:25:00.000Z"],
    ["match-wti-3118", "person3", "person4", "wti", 35000, 86.2, "2026-07-19T08:42:00.000Z"],
    ["match-fx-4411", "person3", "person4", "usdnpr", 45000, 153.72, "2026-07-21T05:35:00.000Z"],
  ] as const;
  const positionStatements: DemoStatement[] = [];
  for (const [matchId, longId, shortId, marketId, notional, price, createdAt] of openPositionSeeds) {
    positionStatements.push(
      db.prepare(`INSERT OR IGNORE INTO demo_positions
        (id, match_id, user_id, counterparty_id, market_id, side, notional, entry_price, status, created_at, signature)
        VALUES (?, ?, ?, ?, ?, 'long', ?, ?, 'open', ?, NULL)`)
        .bind(`pos-${matchId}-long`, matchId, longId, shortId, marketId, notional, price, createdAt),
      db.prepare(`INSERT OR IGNORE INTO demo_positions
        (id, match_id, user_id, counterparty_id, market_id, side, notional, entry_price, status, created_at, signature)
        VALUES (?, ?, ?, ?, ?, 'short', ?, ?, 'open', ?, NULL)`)
        .bind(`pos-${matchId}-short`, matchId, shortId, longId, marketId, notional, price, createdAt),
    );
  }
  await batchInChunks(db, positionStatements);

  const marketBase = { wti: 86.4, brent: 89.7, usdnpr: 153.85 } as const;
  const tapeReady = await db.prepare("SELECT id FROM demo_trades WHERE id = 'tape-trade-100'").first();
  const tradeStatements: DemoStatement[] = [];
  const tradeStart = Date.UTC(2026, 6, 17, 7, 0, 0);
  for (let index = 0; !tapeReady && index < 100; index += 1) {
    const marketId = (["wti", "brent", "usdnpr"] as const)[index % 3];
    const longAccount = seedAccounts[index % seedAccounts.length][0];
    let shortIndex = (index * 5 + 3) % seedAccounts.length;
    if (seedAccounts[shortIndex][0] === longAccount) shortIndex = (shortIndex + 1) % seedAccounts.length;
    const shortAccount = seedAccounts[shortIndex][0];
    const wave = Math.sin(index * 0.61) * (marketId === "usdnpr" ? 0.75 : 3.1);
    const drift = (index % 11) * (marketId === "usdnpr" ? 0.025 : 0.08);
    const price = Number((marketBase[marketId] + wave + drift).toFixed(marketId === "usdnpr" ? 3 : 2));
    const notional = 15000 + (index % 10) * 5000;
    const createdAt = new Date(tradeStart + index * 60 * 60 * 1000).toISOString();
    tradeStatements.push(
      db.prepare(`INSERT OR IGNORE INTO demo_trades
        (id, match_id, market_id, long_user_id, short_user_id, notional, price, status, chain_signature, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'settled', NULL, ?)`)
        .bind(`tape-trade-${String(index + 1).padStart(3, "0")}`, `tape-match-${String(index + 1).padStart(3, "0")}`, marketId, longAccount, shortAccount, notional, price, createdAt),
    );
  }
  await batchInChunks(db, tradeStatements);

  const liquidityReady = await db.prepare("SELECT id FROM demo_orders WHERE id = 'liquidity-order-12'").first();
  const orderStatements: DemoStatement[] = [];
  for (let index = 0; !liquidityReady && index < 12; index += 1) {
    const owner = seedAccounts[(index + 4) % seedAccounts.length][0];
    const marketId = (["wti", "brent", "usdnpr"] as const)[index % 3];
    const side = index % 2 === 0 ? "long" : "short";
    const notional = 20000 + (index % 6) * 10000;
    const price = marketBase[marketId] + (index % 4) * (marketId === "usdnpr" ? 0.08 : 0.2);
    orderStatements.push(
      db.prepare(`INSERT OR IGNORE INTO demo_orders
        (id, user_id, market_id, side, notional, posted_price, status, counterparty_id, match_price, created_at, matched_at)
        VALUES (?, ?, ?, ?, ?, ?, 'open', NULL, NULL, ?, NULL)`)
        .bind(`liquidity-order-${String(index + 1).padStart(2, "0")}`, owner, marketId, side, notional, price, new Date(Date.UTC(2026, 6, 22, 4 + index, 5)).toISOString()),
    );
  }
  await batchInChunks(db, orderStatements);

  await db.batch([
    db.prepare(`INSERT OR IGNORE INTO demo_audit_events VALUES
      ('audit-market-open', 'system', NULL, 'Participant simulation opened', '100 historical matches and participant-created liquidity loaded', '2026-07-22T03:45:00.000Z')`),
    db.prepare(`INSERT OR IGNORE INTO demo_audit_events VALUES
      ('audit-funding-cap', 'control', NULL, 'Lifetime funding cap active', 'Each account can claim no more than 1,000,000 tNPR', '2026-07-22T03:46:00.000Z')`),
  ]);
}

async function readDemoState(db: DemoDb, identity: ViewerIdentity | null = null) {
  const accountsQuery = identity
    ? db.prepare(`SELECT id, email, CASE WHEN owner_key = ? THEN display_name ELSE 'Market participant' END AS display_name,
        company, role, hedge_story, available_balance, funding_total, withdrawn_total, created_at
        FROM demo_accounts ORDER BY created_at ASC`).bind(identity.ownerKey)
    : db.prepare(`SELECT id, email, 'Market participant' AS display_name, company, role, hedge_story,
        available_balance, funding_total, withdrawn_total, created_at FROM demo_accounts ORDER BY created_at ASC`);
  const [accounts, orders, positions, trades, deposits, withdrawals, audit, participant] = await Promise.all([
    accountsQuery.all(),
    db.prepare("SELECT * FROM demo_orders WHERE status = 'open' ORDER BY created_at DESC").all(),
    db.prepare("SELECT * FROM demo_positions WHERE status = 'open' ORDER BY created_at DESC").all(),
    db.prepare("SELECT * FROM demo_trades ORDER BY created_at DESC LIMIT 100").all(),
    db.prepare("SELECT * FROM demo_deposits ORDER BY created_at DESC LIMIT 100").all(),
    db.prepare("SELECT * FROM demo_withdrawals ORDER BY created_at DESC LIMIT 100").all(),
    db.prepare("SELECT * FROM demo_audit_events ORDER BY created_at DESC LIMIT 60").all(),
    identity
      ? db.prepare("SELECT id FROM demo_accounts WHERE owner_key = ?").bind(identity.ownerKey).first<{ id: string }>()
      : Promise.resolve(null),
  ]);
  return {
    accounts: accounts.results ?? [], orders: orders.results ?? [], positions: positions.results ?? [],
    trades: trades.results ?? [], deposits: deposits.results ?? [], withdrawals: withdrawals.results ?? [], audit: audit.results ?? [],
    limits: { lifetimeFunding: MAX_LIFETIME_FUNDING },
    viewer: {
      authenticated: Boolean(identity),
      displayName: identity?.displayName ?? null,
      participantId: participant?.id ?? null,
    },
  };
}

export async function GET() {
  try {
    const db = getDemoDb();
    await ensureDemoState(db);
    const identity = await getViewerIdentity();
    return Response.json(await readDemoState(db, identity), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Paper market unavailable" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const db = getDemoDb();
    await ensureDemoState(db);
    const payload = (await request.json()) as Record<string, unknown>;
    const action = String(payload.action ?? "");
    const now = new Date().toISOString();
    const identity = await getViewerIdentity();
    if (!identity) return Response.json({ error: "Sign in with ChatGPT to create or use a participant", signInUrl: "/signin-with-chatgpt?return_to=%2F" }, { status: 401 });

    if (action === "create_account") {
      const displayName = String(payload.displayName ?? "").trim().slice(0, 60);
      const company = String(payload.company ?? "").trim().slice(0, 80);
      const role = String(payload.role ?? "Business participant").trim().slice(0, 60);
      const hedgeStory = String(payload.hedgeStory ?? "Exploring a business hedge against global price volatility.").trim().slice(0, 300);
      if (displayName.length < 2 || company.length < 2) return Response.json({ error: "Enter your name and business name" }, { status: 400 });
      const existingAccount = await db.prepare("SELECT id FROM demo_accounts WHERE owner_key = ?").bind(identity.ownerKey).first<{ id: string }>();
      if (existingAccount) return Response.json({ error: "Your signed-in identity already has a participant account" }, { status: 409 });
      const userId = `participant-${crypto.randomUUID()}`;
      await db.batch([
        db.prepare(`INSERT INTO demo_accounts
          (id, email, display_name, company, role, hedge_story, available_balance, funding_total, withdrawn_total, owner_key, claimed_at, created_at)
          VALUES (?, ?, ?, ?, ?, ?, 0, 0, 0, ?, ?, ?)`)
          .bind(userId, `${userId}@sandbox.nprx`, displayName, company, role, hedgeStory, identity.ownerKey, now, now),
        db.prepare("INSERT INTO demo_audit_events VALUES (?, 'account', ?, 'New sandbox participant joined', ?, ?)")
          .bind(crypto.randomUUID(), userId, `${company} joined the live paper market`, now),
      ]);
      return Response.json({ ok: true, userId, state: await readDemoState(db, identity) });
    }

    if (action === "claim_legacy") {
      const displayName = String(payload.displayName ?? "").trim().slice(0, 60);
      const company = String(payload.company ?? "").trim().slice(0, 80);
      if (displayName.length < 2 || company.length < 2) return Response.json({ error: "Enter the exact name and business used for the old account" }, { status: 400 });
      const existingAccount = await db.prepare("SELECT id FROM demo_accounts WHERE owner_key = ?").bind(identity.ownerKey).first<{ id: string }>();
      if (existingAccount) return Response.json({ error: "Your signed-in identity is already linked to a participant" }, { status: 409 });
      const matches = await db.prepare(`SELECT id FROM demo_accounts
        WHERE owner_key IS NULL AND id LIKE 'participant-%' AND lower(display_name) = lower(?) AND lower(company) = lower(?)
        LIMIT 2`).bind(displayName, company).all<{ id: string }>();
      if ((matches.results ?? []).length === 0) return Response.json({ error: "No unclaimed legacy account matched those exact details" }, { status: 404 });
      if ((matches.results ?? []).length > 1) return Response.json({ error: "More than one account matched; contact the sandbox operator" }, { status: 409 });
      const userId = matches.results![0].id;
      const claim = await db.prepare("UPDATE demo_accounts SET owner_key = ?, claimed_at = ? WHERE id = ? AND owner_key IS NULL")
        .bind(identity.ownerKey, now, userId).run();
      if ((claim.meta?.changes ?? claim.changes ?? 0) !== 1) return Response.json({ error: "That account was claimed by another session" }, { status: 409 });
      await db.prepare("INSERT INTO demo_audit_events VALUES (?, 'account', ?, 'Legacy participant access secured', ?, ?)")
        .bind(crypto.randomUUID(), userId, "Old device-only participant linked to a signed-in identity", now).run();
      return Response.json({ ok: true, userId, state: await readDemoState(db, identity) });
    }

    const userId = String(payload.userId ?? "");
    const account = await requireOwnedAccount(db, identity, userId);

    if (action === "claim_funds" || action === "deposit") {
      const amount = Math.round(Number(payload.amount));
      const remaining = Math.max(0, MAX_LIFETIME_FUNDING - account.funding_total);
      if (!Number.isFinite(amount) || amount < 10_000 || amount > remaining) {
        return Response.json({ error: `You can claim between 10,000 and ${remaining.toLocaleString()} tNPR more` }, { status: 400 });
      }
      const update = await db.prepare(`UPDATE demo_accounts
        SET available_balance = available_balance + ?, funding_total = funding_total + ?
        WHERE id = ? AND funding_total + ? <= ?`).bind(amount, amount, userId, amount, MAX_LIFETIME_FUNDING).run();
      if ((update.meta?.changes ?? update.changes ?? 0) !== 1) return Response.json({ error: "Lifetime tNPR funding cap reached" }, { status: 409 });
      const reference = `TNPR-FAUCET-${Date.now().toString().slice(-9)}`;
      await db.batch([
        db.prepare("INSERT INTO demo_deposits VALUES (?, ?, ?, ?, 'Paper funding faucet', ?)").bind(crypto.randomUUID(), userId, amount, reference, now),
        db.prepare("INSERT INTO demo_audit_events VALUES (?, 'funding', ?, 'Paper funds claimed', ?, ?)").bind(crypto.randomUUID(), userId, `${amount.toLocaleString()} tNPR credited; no real money moved`, now),
      ]);
      return Response.json({ ok: true, reference, state: await readDemoState(db, identity) });
    }

    if (action === "withdraw") {
      const amount = Math.round(Number(payload.amount));
      if (!Number.isFinite(amount) || amount < 10_000 || amount > account.available_balance) {
        return Response.json({ error: "Withdrawal must be at least 10,000 tNPR and within available balance" }, { status: 400 });
      }
      const update = await db.prepare(`UPDATE demo_accounts
        SET available_balance = available_balance - ?, withdrawn_total = withdrawn_total + ?
        WHERE id = ? AND available_balance >= ?`).bind(amount, amount, userId, amount).run();
      if ((update.meta?.changes ?? update.changes ?? 0) !== 1) return Response.json({ error: "Available balance changed; try again" }, { status: 409 });
      const reference = `TNPR-REDEEM-${Date.now().toString().slice(-9)}`;
      await db.batch([
        db.prepare("INSERT INTO demo_withdrawals VALUES (?, ?, ?, ?, 'simulated', ?)").bind(crypto.randomUUID(), userId, amount, reference, now),
        db.prepare("INSERT INTO demo_audit_events VALUES (?, 'withdrawal', ?, 'tNPR redemption simulated', ?, ?)").bind(crypto.randomUUID(), userId, `${amount.toLocaleString()} tNPR removed; no real NPR was paid`, now),
      ]);
      return Response.json({ ok: true, reference, state: await readDemoState(db, identity) });
    }

    if (action === "place_order") {
      const marketId = String(payload.marketId ?? "");
      const side = String(payload.side ?? "");
      const notional = Math.round(Number(payload.notional));
      const postedPrice = Number(payload.postedPrice);
      if (!validMarkets.has(marketId) || !["long", "short"].includes(side)) return Response.json({ error: "Invalid market or side" }, { status: 400 });
      if (!Number.isFinite(notional) || notional < 10_000 || notional > 250_000) return Response.json({ error: "Notional must be 10,000-250,000 tNPR" }, { status: 400 });
      if (!Number.isFinite(postedPrice) || postedPrice <= 0) return Response.json({ error: "A current market price is required" }, { status: 400 });
      if (account.available_balance < notional) return Response.json({ error: "Insufficient available paper margin" }, { status: 400 });
      const orderId = `order-${crypto.randomUUID().slice(0, 8)}`;
      await db.batch([
        db.prepare("UPDATE demo_accounts SET available_balance = available_balance - ? WHERE id = ?").bind(notional, userId),
        db.prepare(`INSERT INTO demo_orders
          (id, user_id, market_id, side, notional, posted_price, status, counterparty_id, match_price, created_at, matched_at)
          VALUES (?, ?, ?, ?, ?, ?, 'open', NULL, NULL, ?, NULL)`)
          .bind(orderId, userId, marketId, side, notional, postedPrice, now),
        db.prepare("INSERT INTO demo_audit_events VALUES (?, 'order', ?, 'Participant hedge request posted', ?, ?)")
          .bind(crypto.randomUUID(), userId, `${side.toUpperCase()} ${marketId.toUpperCase()} - ${notional.toLocaleString()} tNPR - awaiting another participant`, now),
      ]);
      return Response.json({ ok: true, orderId, state: await readDemoState(db, identity) });
    }

    if (action === "take_order") {
      const orderId = String(payload.orderId ?? "");
      const matchPrice = Number(payload.matchPrice);
      const order = await db.prepare("SELECT * FROM demo_orders WHERE id = ? AND status = 'open'").bind(orderId).first<DemoOrder>();
      if (!order) return Response.json({ error: "Order is no longer available" }, { status: 409 });
      if (order.user_id === userId) return Response.json({ error: "Participants cannot match their own order" }, { status: 400 });
      if (!Number.isFinite(matchPrice) || matchPrice <= 0) return Response.json({ error: "A current market price is required" }, { status: 400 });
      if (account.available_balance < order.notional) return Response.json({ error: "Insufficient available paper margin" }, { status: 400 });
      const claim = await db.prepare("UPDATE demo_orders SET status = 'matching' WHERE id = ? AND status = 'open'").bind(orderId).run();
      if ((claim.meta?.changes ?? claim.changes ?? 0) !== 1) return Response.json({ error: "Another participant already accepted this order" }, { status: 409 });

      const matchId = `match-${crypto.randomUUID().slice(0, 8)}`;
      const tradeId = `trade-${crypto.randomUUID().slice(0, 8)}`;
      const takerSide = order.side === "long" ? "short" : "long";
      const longUserId = order.side === "long" ? order.user_id : userId;
      const shortUserId = order.side === "short" ? order.user_id : userId;
      try {
        await db.batch([
          db.prepare("UPDATE demo_accounts SET available_balance = available_balance - ? WHERE id = ?").bind(order.notional, userId),
          db.prepare("UPDATE demo_orders SET status = 'matched', counterparty_id = ?, match_price = ?, matched_at = ? WHERE id = ? AND status = 'matching'").bind(userId, matchPrice, now, orderId),
          db.prepare(`INSERT INTO demo_positions
            (id, match_id, user_id, counterparty_id, market_id, side, notional, entry_price, status, created_at, signature)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, NULL)`)
            .bind(`pos-${crypto.randomUUID().slice(0, 8)}`, matchId, order.user_id, userId, order.market_id, order.side, order.notional, matchPrice, now),
          db.prepare(`INSERT INTO demo_positions
            (id, match_id, user_id, counterparty_id, market_id, side, notional, entry_price, status, created_at, signature)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, NULL)`)
            .bind(`pos-${crypto.randomUUID().slice(0, 8)}`, matchId, userId, order.user_id, order.market_id, takerSide, order.notional, matchPrice, now),
          db.prepare(`INSERT INTO demo_trades
            (id, match_id, market_id, long_user_id, short_user_id, notional, price, status, chain_signature, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'matched', NULL, ?)`)
            .bind(tradeId, matchId, order.market_id, longUserId, shortUserId, order.notional, matchPrice, now),
          db.prepare("INSERT INTO demo_audit_events VALUES (?, 'match', ?, 'Participant-to-participant match completed', ?, ?)")
            .bind(crypto.randomUUID(), userId, `${longUserId} LONG / ${shortUserId} SHORT - ${order.notional.toLocaleString()} tNPR`, now),
        ]);
      } catch (cause) {
        await db.prepare("UPDATE demo_orders SET status = 'open' WHERE id = ? AND status = 'matching'").bind(orderId).run();
        throw cause;
      }
      return Response.json({ ok: true, matchId, tradeId, state: await readDemoState(db, identity) });
    }

    if (action === "cancel_order") {
      const orderId = String(payload.orderId ?? "");
      const order = await db.prepare("SELECT * FROM demo_orders WHERE id = ? AND status = 'open'").bind(orderId).first<DemoOrder>();
      if (!order || order.user_id !== userId) return Response.json({ error: "Open order not found" }, { status: 404 });
      await db.batch([
        db.prepare("UPDATE demo_orders SET status = 'cancelled' WHERE id = ?").bind(orderId),
        db.prepare("UPDATE demo_accounts SET available_balance = available_balance + ? WHERE id = ?").bind(order.notional, userId),
        db.prepare("INSERT INTO demo_audit_events VALUES (?, 'order', ?, 'Hedge request cancelled', ?, ?)").bind(crypto.randomUUID(), userId, `${order.notional.toLocaleString()} tNPR margin released`, now),
      ]);
      return Response.json({ ok: true, state: await readDemoState(db, identity) });
    }

    if (action === "attach_signature") {
      const tradeId = String(payload.tradeId ?? "");
      const signature = String(payload.signature ?? "");
      const walletAddress = String(payload.walletAddress ?? "");
      if (!/^[1-9A-HJ-NP-Za-km-z]{80,90}$/.test(signature)) return Response.json({ error: "Invalid Solana signature" }, { status: 400 });
      if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(walletAddress)) return Response.json({ error: "Invalid Solana wallet address" }, { status: 400 });
      const trade = await db.prepare("SELECT * FROM demo_trades WHERE id = ?").bind(tradeId).first<DemoTrade>();
      if (!trade || (trade.long_user_id !== userId && trade.short_user_id !== userId)) return Response.json({ error: "Only a trade participant can attach a receipt" }, { status: 403 });
      if (!(await verifySolanaReceipt(signature, walletAddress, tradeId))) {
        return Response.json({ error: "The Devnet transaction could not be verified as this NPRX receipt" }, { status: 400 });
      }
      await db.batch([
        db.prepare("UPDATE demo_trades SET chain_signature = ? WHERE id = ?").bind(signature, tradeId),
        db.prepare("UPDATE demo_positions SET signature = ? WHERE match_id = ?").bind(signature, trade.match_id),
        db.prepare("INSERT INTO demo_audit_events VALUES (?, 'chain', ?, 'Solana Devnet receipt confirmed', ?, ?)").bind(crypto.randomUUID(), userId, `${tradeId} - ${signature.slice(0, 12)}...`, now),
      ]);
      return Response.json({ ok: true, state: await readDemoState(db, identity) });
    }

    return Response.json({ error: "Unknown paper-market action" }, { status: 400 });
  } catch (error) {
    const status = error instanceof ApiError ? error.status : 500;
    return Response.json({ error: error instanceof Error ? error.message : "Paper-market action failed" }, { status });
  }
}

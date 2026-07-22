import { env } from "cloudflare:workers";

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
  long_user_id: string;
  short_user_id: string;
};

const validMarkets = new Set(["wti", "brent", "usdnpr"]);
const validUsers = new Set(["person1", "person2", "person3", "person4"]);

function getDemoDb() {
  const db = (env as unknown as { DB?: DemoDb }).DB;
  if (!db) throw new Error("The shared demo database is unavailable.");
  return db;
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
      available_balance INTEGER NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS demo_orders (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      market_id TEXT NOT NULL,
      side TEXT NOT NULL,
      notional INTEGER NOT NULL,
      posted_price REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      counterparty_id TEXT,
      match_price REAL,
      created_at TEXT NOT NULL,
      matched_at TEXT
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS demo_positions (
      id TEXT PRIMARY KEY,
      match_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      counterparty_id TEXT NOT NULL,
      market_id TEXT NOT NULL,
      side TEXT NOT NULL,
      notional INTEGER NOT NULL,
      entry_price REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      created_at TEXT NOT NULL,
      signature TEXT
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS demo_deposits (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      amount INTEGER NOT NULL,
      reference TEXT NOT NULL UNIQUE,
      rail TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS demo_audit_events (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      actor_id TEXT,
      title TEXT NOT NULL,
      detail TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS demo_trades (
      id TEXT PRIMARY KEY,
      match_id TEXT NOT NULL UNIQUE,
      market_id TEXT NOT NULL,
      long_user_id TEXT NOT NULL,
      short_user_id TEXT NOT NULL,
      notional INTEGER NOT NULL,
      price REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'matched',
      chain_signature TEXT,
      created_at TEXT NOT NULL
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS demo_orders_status_idx ON demo_orders(status)"),
    db.prepare("CREATE INDEX IF NOT EXISTS demo_positions_user_idx ON demo_positions(user_id)"),
    db.prepare("CREATE INDEX IF NOT EXISTS demo_audit_created_idx ON demo_audit_events(created_at)"),
    db.prepare("CREATE INDEX IF NOT EXISTS demo_trades_market_idx ON demo_trades(market_id)"),
    db.prepare("CREATE INDEX IF NOT EXISTS demo_trades_created_idx ON demo_trades(created_at)"),
  ]);

  await db.batch([
    db.prepare("INSERT OR IGNORE INTO demo_accounts VALUES (?, ?, ?, ?, ?, ?, ?)").bind(
      "person1",
      "asha@himalagro.demo",
      "Asha Shrestha",
      "Himal Agro Imports",
      "Procurement Director",
      "Imports fuel-dependent food products. Long oil and USD/NPR positions help budget rising landed costs.",
      225000,
    ),
    db.prepare("INSERT OR IGNORE INTO demo_accounts VALUES (?, ?, ?, ?, ?, ?, ?)").bind(
      "person2",
      "bikash@suryasolar.demo",
      "Bikash Karki",
      "Surya Solar Nepal",
      "Commercial Director",
      "A solar operator that can take the opposing oil view when conventional energy prices fall.",
      235000,
    ),
    db.prepare("INSERT OR IGNORE INTO demo_accounts VALUES (?, ?, ?, ?, ?, ?, ?)").bind(
      "person3",
      "nima@everestfreight.demo",
      "Nima Gurung",
      "Everest Freight & Logistics",
      "Operations Manager",
      "Freight margins are sensitive to fuel and dollar-priced equipment, creating long oil and USD/NPR hedge demand.",
      340000,
    ),
    db.prepare("INSERT OR IGNORE INTO demo_accounts VALUES (?, ?, ?, ?, ?, ?, ?)").bind(
      "person4",
      "maya@annapurnaexports.demo",
      "Maya Rana",
      "Annapurna Garment Exports",
      "Treasury Lead",
      "Receives USD export revenue and benefits from lower energy costs, creating natural short USD/NPR and oil exposure.",
      400000,
    ),
    db.prepare("INSERT OR IGNORE INTO demo_deposits VALUES (?, ?, ?, ?, ?, ?)").bind("dep-seed-p1", "person1", 300000, "CIPS-SBX-240801", "connectIPS Sandbox", "2026-07-18T04:15:00.000Z"),
    db.prepare("INSERT OR IGNORE INTO demo_deposits VALUES (?, ?, ?, ?, ?, ?)").bind("dep-seed-p2", "person2", 300000, "CIPS-SBX-240802", "connectIPS Sandbox", "2026-07-18T04:18:00.000Z"),
    db.prepare("INSERT OR IGNORE INTO demo_deposits VALUES (?, ?, ?, ?, ?, ?)").bind("dep-seed-p3", "person3", 450000, "CIPS-SBX-240803", "connectIPS Sandbox", "2026-07-18T04:24:00.000Z"),
    db.prepare("INSERT OR IGNORE INTO demo_deposits VALUES (?, ?, ?, ?, ?, ?)").bind("dep-seed-p4", "person4", 500000, "CIPS-SBX-240804", "connectIPS Sandbox", "2026-07-18T04:31:00.000Z"),

    db.prepare("INSERT OR IGNORE INTO demo_positions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind("pos-brent-p1", "match-brent-1044", "person1", "person2", "brent", "long", 40000, 91.8, "open", "2026-07-18T05:10:00.000Z", null),
    db.prepare("INSERT OR IGNORE INTO demo_positions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind("pos-brent-p2", "match-brent-1044", "person2", "person1", "brent", "short", 40000, 91.8, "open", "2026-07-18T05:10:00.000Z", null),
    db.prepare("INSERT OR IGNORE INTO demo_positions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind("pos-fx-p1", "match-fx-0921", "person1", "person2", "usdnpr", "long", 25000, 153.9, "open", "2026-07-20T06:25:00.000Z", null),
    db.prepare("INSERT OR IGNORE INTO demo_positions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind("pos-fx-p2", "match-fx-0921", "person2", "person1", "usdnpr", "short", 25000, 153.9, "open", "2026-07-20T06:25:00.000Z", null),
    db.prepare("INSERT OR IGNORE INTO demo_positions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind("pos-wti-p3", "match-wti-3118", "person3", "person4", "wti", "long", 35000, 86.2, "open", "2026-07-19T08:42:00.000Z", null),
    db.prepare("INSERT OR IGNORE INTO demo_positions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind("pos-wti-p4", "match-wti-3118", "person4", "person3", "wti", "short", 35000, 86.2, "open", "2026-07-19T08:42:00.000Z", null),
    db.prepare("INSERT OR IGNORE INTO demo_positions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind("pos-fx-p3", "match-fx-4411", "person3", "person4", "usdnpr", "long", 45000, 153.72, "open", "2026-07-21T05:35:00.000Z", null),
    db.prepare("INSERT OR IGNORE INTO demo_positions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind("pos-fx-p4", "match-fx-4411", "person4", "person3", "usdnpr", "short", 45000, 153.72, "open", "2026-07-21T05:35:00.000Z", null),

    db.prepare("INSERT OR IGNORE INTO demo_orders VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind("order-wti-2048", "person1", "wti", "long", 10000, 87.5, "open", null, null, "2026-07-22T07:45:00.000Z", null),
    db.prepare("INSERT OR IGNORE INTO demo_orders VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind("order-brent-3091", "person3", "brent", "long", 30000, 93.85, "open", null, null, "2026-07-22T08:18:00.000Z", null),
    db.prepare("INSERT OR IGNORE INTO demo_orders VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind("order-fx-4016", "person4", "usdnpr", "short", 20000, 154.18, "open", null, null, "2026-07-22T08:36:00.000Z", null),

    db.prepare("INSERT OR IGNORE INTO demo_trades VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind("trade-brent-1044", "match-brent-1044", "brent", "person1", "person2", 40000, 91.8, "matched", null, "2026-07-18T05:10:00.000Z"),
    db.prepare("INSERT OR IGNORE INTO demo_trades VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind("trade-fx-0921", "match-fx-0921", "usdnpr", "person1", "person2", 25000, 153.9, "matched", null, "2026-07-20T06:25:00.000Z"),
    db.prepare("INSERT OR IGNORE INTO demo_trades VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind("trade-wti-3118", "match-wti-3118", "wti", "person3", "person4", 35000, 86.2, "matched", null, "2026-07-19T08:42:00.000Z"),
    db.prepare("INSERT OR IGNORE INTO demo_trades VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind("trade-fx-4411", "match-fx-4411", "usdnpr", "person3", "person4", 45000, 153.72, "matched", null, "2026-07-21T05:35:00.000Z"),
    db.prepare("INSERT OR IGNORE INTO demo_trades VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind("trade-wti-3020", "match-wti-3020", "wti", "person1", "person2", 30000, 84.65, "settled", null, "2026-07-12T07:12:00.000Z"),
    db.prepare("INSERT OR IGNORE INTO demo_trades VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind("trade-brent-2708", "match-brent-2708", "brent", "person3", "person2", 50000, 90.4, "settled", null, "2026-07-13T09:05:00.000Z"),
    db.prepare("INSERT OR IGNORE INTO demo_trades VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind("trade-fx-1514", "match-fx-1514", "usdnpr", "person4", "person1", 20000, 152.75, "settled", null, "2026-07-14T04:48:00.000Z"),
    db.prepare("INSERT OR IGNORE INTO demo_trades VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind("trade-wti-0830", "match-wti-0830", "wti", "person2", "person4", 15000, 82.3, "settled", null, "2026-07-15T06:20:00.000Z"),

    db.prepare("INSERT OR IGNORE INTO demo_audit_events VALUES (?, ?, ?, ?, ?, ?)").bind("audit-seed-1", "order", "person1", "WTI hedge request posted", "Long · 10,000 tNPR · awaiting a participant short", "2026-07-22T07:45:00.000Z"),
    db.prepare("INSERT OR IGNORE INTO demo_audit_events VALUES (?, ?, ?, ?, ?, ?)").bind("audit-seed-2", "match", "person2", "Brent position matched", "Himal Agro long ↔ Surya Solar short · 40,000 tNPR", "2026-07-18T05:10:00.000Z"),
    db.prepare("INSERT OR IGNORE INTO demo_audit_events VALUES (?, ?, ?, ?, ?, ?)").bind("audit-seed-3", "match", "person3", "WTI position matched", "Everest Freight long ↔ Annapurna Exports short · 35,000 tNPR", "2026-07-19T08:42:00.000Z"),
    db.prepare("INSERT OR IGNORE INTO demo_audit_events VALUES (?, ?, ?, ?, ?, ?)").bind("audit-seed-4", "order", "person4", "USD/NPR hedge request posted", "Short · 20,000 tNPR · awaiting a participant long", "2026-07-22T08:36:00.000Z"),
  ]);
}

async function readDemoState(db: DemoDb) {
  const [accounts, orders, positions, trades, deposits, audit] = await Promise.all([
    db.prepare("SELECT * FROM demo_accounts ORDER BY id").all(),
    db.prepare("SELECT * FROM demo_orders WHERE status = 'open' ORDER BY created_at DESC").all(),
    db.prepare("SELECT * FROM demo_positions WHERE status = 'open' ORDER BY created_at DESC").all(),
    db.prepare("SELECT * FROM demo_trades ORDER BY created_at DESC LIMIT 100").all(),
    db.prepare("SELECT * FROM demo_deposits ORDER BY created_at DESC LIMIT 40").all(),
    db.prepare("SELECT * FROM demo_audit_events ORDER BY created_at DESC LIMIT 50").all(),
  ]);
  return {
    accounts: accounts.results ?? [],
    orders: orders.results ?? [],
    positions: positions.results ?? [],
    trades: trades.results ?? [],
    deposits: deposits.results ?? [],
    audit: audit.results ?? [],
  };
}

export async function GET() {
  try {
    const db = getDemoDb();
    await ensureDemoState(db);
    return Response.json(await readDemoState(db), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Demo state unavailable" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const db = getDemoDb();
    await ensureDemoState(db);
    const payload = (await request.json()) as Record<string, unknown>;
    const action = String(payload.action ?? "");
    const userId = String(payload.userId ?? "");
    if (!validUsers.has(userId)) return Response.json({ error: "Unknown demo participant" }, { status: 400 });
    const now = new Date().toISOString();

    if (action === "deposit") {
      const amount = Math.round(Number(payload.amount));
      if (!Number.isFinite(amount) || amount < 10_000 || amount > 1_000_000) {
        return Response.json({ error: "Sandbox deposit must be between 10,000 and 1,000,000 tNPR" }, { status: 400 });
      }
      const reference = `CIPS-SBX-${Date.now().toString().slice(-9)}`;
      await db.batch([
        db.prepare("UPDATE demo_accounts SET available_balance = available_balance + ? WHERE id = ?").bind(amount, userId),
        db.prepare("INSERT INTO demo_deposits VALUES (?, ?, ?, ?, ?, ?)").bind(crypto.randomUUID(), userId, amount, reference, "connectIPS Sandbox", now),
        db.prepare("INSERT INTO demo_audit_events VALUES (?, ?, ?, ?, ?, ?)").bind(crypto.randomUUID(), "deposit", userId, "Sandbox deposit credited", `${amount.toLocaleString()} tNPR · ${reference} · 1:1 test credit`, now),
      ]);
      return Response.json({ ok: true, reference, state: await readDemoState(db) });
    }

    if (action === "place_order") {
      const marketId = String(payload.marketId ?? "");
      const side = String(payload.side ?? "");
      const notional = Math.round(Number(payload.notional));
      const postedPrice = Number(payload.postedPrice);
      if (!validMarkets.has(marketId) || !["long", "short"].includes(side)) return Response.json({ error: "Invalid market or side" }, { status: 400 });
      if (!Number.isFinite(notional) || notional < 10_000 || notional > 250_000) return Response.json({ error: "Notional must be 10,000–250,000 tNPR" }, { status: 400 });
      if (!Number.isFinite(postedPrice) || postedPrice <= 0) return Response.json({ error: "A current market price is required" }, { status: 400 });
      const account = await db.prepare("SELECT * FROM demo_accounts WHERE id = ?").bind(userId).first<DemoAccount>();
      if (!account || account.available_balance < notional) return Response.json({ error: "Insufficient available test margin" }, { status: 400 });
      const orderId = `order-${crypto.randomUUID().slice(0, 8)}`;
      await db.batch([
        db.prepare("UPDATE demo_accounts SET available_balance = available_balance - ? WHERE id = ?").bind(notional, userId),
        db.prepare("INSERT INTO demo_orders VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(orderId, userId, marketId, side, notional, postedPrice, "open", null, null, now, null),
        db.prepare("INSERT INTO demo_audit_events VALUES (?, ?, ?, ?, ?, ?)").bind(crypto.randomUUID(), "order", userId, "Participant hedge request posted", `${side.toUpperCase()} · ${notional.toLocaleString()} tNPR · ${marketId.toUpperCase()} · awaiting counterparty`, now),
      ]);
      return Response.json({ ok: true, orderId, state: await readDemoState(db) });
    }

    if (action === "take_order") {
      const orderId = String(payload.orderId ?? "");
      const matchPrice = Number(payload.matchPrice);
      const order = await db.prepare("SELECT * FROM demo_orders WHERE id = ? AND status = 'open'").bind(orderId).first<DemoOrder>();
      if (!order) return Response.json({ error: "Order is no longer available" }, { status: 409 });
      if (order.user_id === userId) return Response.json({ error: "Participants cannot match their own order" }, { status: 400 });
      if (!Number.isFinite(matchPrice) || matchPrice <= 0) return Response.json({ error: "A current market price is required" }, { status: 400 });
      const account = await db.prepare("SELECT * FROM demo_accounts WHERE id = ?").bind(userId).first<DemoAccount>();
      if (!account || account.available_balance < order.notional) return Response.json({ error: "Insufficient available test margin" }, { status: 400 });

      const matchId = `match-${crypto.randomUUID().slice(0, 8)}`;
      const tradeId = `trade-${crypto.randomUUID().slice(0, 8)}`;
      const makerPosition = `pos-${crypto.randomUUID().slice(0, 8)}`;
      const takerPosition = `pos-${crypto.randomUUID().slice(0, 8)}`;
      const takerSide = order.side === "long" ? "short" : "long";
      const longUserId = order.side === "long" ? order.user_id : userId;
      const shortUserId = order.side === "short" ? order.user_id : userId;
      const claim = await db.prepare("UPDATE demo_orders SET status = 'matching' WHERE id = ? AND status = 'open'").bind(orderId).run();
      const claimChanges = claim.meta?.changes ?? claim.changes ?? 0;
      if (claimChanges !== 1) return Response.json({ error: "Another participant already accepted this order" }, { status: 409 });

      try {
        await db.batch([
          db.prepare("UPDATE demo_accounts SET available_balance = available_balance - ? WHERE id = ?").bind(order.notional, userId),
          db.prepare("UPDATE demo_orders SET status = 'matched', counterparty_id = ?, match_price = ?, matched_at = ? WHERE id = ? AND status = 'matching'").bind(userId, matchPrice, now, orderId),
          db.prepare("INSERT INTO demo_positions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(makerPosition, matchId, order.user_id, userId, order.market_id, order.side, order.notional, matchPrice, "open", now, null),
          db.prepare("INSERT INTO demo_positions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(takerPosition, matchId, userId, order.user_id, order.market_id, takerSide, order.notional, matchPrice, "open", now, null),
          db.prepare("INSERT INTO demo_trades VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(tradeId, matchId, order.market_id, longUserId, shortUserId, order.notional, matchPrice, "matched", null, now),
          db.prepare("INSERT INTO demo_audit_events VALUES (?, ?, ?, ?, ?, ?)").bind(crypto.randomUUID(), "match", userId, "Participant-to-participant match completed", `${longUserId} LONG ↔ ${shortUserId} SHORT · ${order.notional.toLocaleString()} tNPR · entry ${matchPrice}`, now),
        ]);
      } catch (cause) {
        await db.prepare("UPDATE demo_orders SET status = 'open' WHERE id = ? AND status = 'matching'").bind(orderId).run();
        throw cause;
      }
      return Response.json({ ok: true, matchId, tradeId, state: await readDemoState(db) });
    }

    if (action === "cancel_order") {
      const orderId = String(payload.orderId ?? "");
      const order = await db.prepare("SELECT * FROM demo_orders WHERE id = ? AND status = 'open'").bind(orderId).first<DemoOrder>();
      if (!order || order.user_id !== userId) return Response.json({ error: "Open order not found" }, { status: 404 });
      await db.batch([
        db.prepare("UPDATE demo_orders SET status = 'cancelled' WHERE id = ?").bind(orderId),
        db.prepare("UPDATE demo_accounts SET available_balance = available_balance + ? WHERE id = ?").bind(order.notional, userId),
        db.prepare("INSERT INTO demo_audit_events VALUES (?, ?, ?, ?, ?, ?)").bind(crypto.randomUUID(), "order", userId, "Hedge request cancelled", `${order.notional.toLocaleString()} tNPR margin released`, now),
      ]);
      return Response.json({ ok: true, state: await readDemoState(db) });
    }

    if (action === "attach_signature") {
      const tradeId = String(payload.tradeId ?? "");
      const signature = String(payload.signature ?? "");
      if (!/^[1-9A-HJ-NP-Za-km-z]{64,100}$/.test(signature)) return Response.json({ error: "Invalid Solana signature" }, { status: 400 });
      const trade = await db.prepare("SELECT * FROM demo_trades WHERE id = ?").bind(tradeId).first<DemoTrade>();
      if (!trade || ![trade.long_user_id, trade.short_user_id].includes(userId)) return Response.json({ error: "Trade receipt is not available for this participant" }, { status: 404 });
      await db.batch([
        db.prepare("UPDATE demo_trades SET chain_signature = ? WHERE id = ?").bind(signature, tradeId),
        db.prepare("UPDATE demo_positions SET signature = ? WHERE match_id = ?").bind(signature, trade.match_id),
        db.prepare("INSERT INTO demo_audit_events VALUES (?, ?, ?, ?, ?, ?)").bind(crypto.randomUUID(), "chain", userId, "Solana Devnet receipt attached", `${trade.match_id} · Memo Program · ${signature.slice(0, 8)}…`, now),
      ]);
      return Response.json({ ok: true, state: await readDemoState(db) });
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Demo action failed" }, { status: 500 });
  }
}

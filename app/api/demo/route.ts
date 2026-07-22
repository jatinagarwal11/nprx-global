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

const validMarkets = new Set(["wti", "brent", "usdnpr"]);
const validUsers = new Set(["person1", "person2"]);

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
    db.prepare("CREATE INDEX IF NOT EXISTS demo_orders_status_idx ON demo_orders(status)"),
    db.prepare("CREATE INDEX IF NOT EXISTS demo_positions_user_idx ON demo_positions(user_id)"),
    db.prepare("CREATE INDEX IF NOT EXISTS demo_audit_created_idx ON demo_audit_events(created_at)"),
  ]);

  await db.batch([
    db
      .prepare("INSERT OR IGNORE INTO demo_accounts VALUES (?, ?, ?, ?, ?, ?, ?)")
      .bind(
        "person1",
        "asha@himalagro.demo",
        "Asha Shrestha",
        "Himal Agro Imports",
        "Procurement Director",
        "Imports fuel-dependent food products. Long oil and USD/NPR positions help budget rising landed costs.",
        225000,
      ),
    db
      .prepare("INSERT OR IGNORE INTO demo_accounts VALUES (?, ?, ?, ?, ?, ?, ?)")
      .bind(
        "person2",
        "bikash@suryasolar.demo",
        "Bikash Karki",
        "Surya Solar Nepal",
        "Commercial Director",
        "A solar operator that benefits when oil becomes less competitive and can take the opposing short view.",
        235000,
      ),
    db
      .prepare("INSERT OR IGNORE INTO demo_deposits VALUES (?, ?, ?, ?, ?, ?)")
      .bind("dep-seed-p1", "person1", 300000, "CIPS-SBX-240801", "connectIPS Sandbox", "2026-07-18T04:15:00.000Z"),
    db
      .prepare("INSERT OR IGNORE INTO demo_deposits VALUES (?, ?, ?, ?, ?, ?)")
      .bind("dep-seed-p2", "person2", 300000, "CIPS-SBX-240802", "connectIPS Sandbox", "2026-07-18T04:18:00.000Z"),
    db
      .prepare("INSERT OR IGNORE INTO demo_positions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .bind("pos-brent-p1", "match-brent-1044", "person1", "person2", "brent", "long", 40000, 91.8, "open", "2026-07-18T05:10:00.000Z", null),
    db
      .prepare("INSERT OR IGNORE INTO demo_positions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .bind("pos-brent-p2", "match-brent-1044", "person2", "person1", "brent", "short", 40000, 91.8, "open", "2026-07-18T05:10:00.000Z", null),
    db
      .prepare("INSERT OR IGNORE INTO demo_positions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .bind("pos-fx-p1", "match-fx-0921", "person1", "person2", "usdnpr", "long", 25000, 153.9, "open", "2026-07-20T06:25:00.000Z", null),
    db
      .prepare("INSERT OR IGNORE INTO demo_positions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .bind("pos-fx-p2", "match-fx-0921", "person2", "person1", "usdnpr", "short", 25000, 153.9, "open", "2026-07-20T06:25:00.000Z", null),
    db
      .prepare("INSERT OR IGNORE INTO demo_orders VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .bind("order-wti-2048", "person1", "wti", "long", 10000, 87.5, "open", null, null, "2026-07-22T07:45:00.000Z", null),
    db
      .prepare("INSERT OR IGNORE INTO demo_audit_events VALUES (?, ?, ?, ?, ?, ?)")
      .bind("audit-seed-1", "order", "person1", "Asha posted a WTI hedge request", "Long · 10,000 tNPR · awaiting a participant short", "2026-07-22T07:45:00.000Z"),
    db
      .prepare("INSERT OR IGNORE INTO demo_audit_events VALUES (?, ?, ?, ?, ?, ?)")
      .bind("audit-seed-2", "match", "person2", "Brent position matched", "Himal Agro long ↔ Surya Solar short · 40,000 tNPR", "2026-07-18T05:10:00.000Z"),
  ]);
}

async function readDemoState(db: DemoDb) {
  const [accounts, orders, positions, deposits, audit] = await Promise.all([
    db.prepare("SELECT * FROM demo_accounts ORDER BY id").all(),
    db.prepare("SELECT * FROM demo_orders WHERE status = 'open' ORDER BY created_at DESC").all(),
    db.prepare("SELECT * FROM demo_positions WHERE status = 'open' ORDER BY created_at DESC").all(),
    db.prepare("SELECT * FROM demo_deposits ORDER BY created_at DESC LIMIT 20").all(),
    db.prepare("SELECT * FROM demo_audit_events ORDER BY created_at DESC LIMIT 30").all(),
  ]);
  return {
    accounts: accounts.results ?? [],
    orders: orders.results ?? [],
    positions: positions.results ?? [],
    deposits: deposits.results ?? [],
    audit: audit.results ?? [],
  };
}

export async function GET() {
  try {
    const db = getDemoDb();
    await ensureDemoState(db);
    return Response.json(await readDemoState(db), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Demo state unavailable" },
      { status: 503 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const db = getDemoDb();
    await ensureDemoState(db);
    const payload = (await request.json()) as Record<string, unknown>;
    const action = String(payload.action ?? "");
    const userId = String(payload.userId ?? "");
    if (!validUsers.has(userId)) {
      return Response.json({ error: "Unknown demo participant" }, { status: 400 });
    }
    const now = new Date().toISOString();

    if (action === "deposit") {
      const amount = Math.round(Number(payload.amount));
      if (!Number.isFinite(amount) || amount < 10_000 || amount > 1_000_000) {
        return Response.json(
          { error: "Sandbox deposit must be between 10,000 and 1,000,000 tNPR" },
          { status: 400 },
        );
      }
      const reference = `CIPS-SBX-${Date.now().toString().slice(-9)}`;
      await db.batch([
        db
          .prepare("UPDATE demo_accounts SET available_balance = available_balance + ? WHERE id = ?")
          .bind(amount, userId),
        db
          .prepare("INSERT INTO demo_deposits VALUES (?, ?, ?, ?, ?, ?)")
          .bind(crypto.randomUUID(), userId, amount, reference, "connectIPS Sandbox", now),
        db
          .prepare("INSERT INTO demo_audit_events VALUES (?, ?, ?, ?, ?, ?)")
          .bind(crypto.randomUUID(), "deposit", userId, "Sandbox deposit credited", `${amount.toLocaleString()} tNPR · ${reference} · 1:1 test credit`, now),
      ]);
      return Response.json({ ok: true, reference, state: await readDemoState(db) });
    }

    if (action === "place_order") {
      const marketId = String(payload.marketId ?? "");
      const side = String(payload.side ?? "");
      const notional = Math.round(Number(payload.notional));
      const postedPrice = Number(payload.postedPrice);
      if (!validMarkets.has(marketId) || !["long", "short"].includes(side)) {
        return Response.json({ error: "Invalid market or side" }, { status: 400 });
      }
      if (!Number.isFinite(notional) || notional < 10_000 || notional > 250_000) {
        return Response.json({ error: "Notional must be 10,000–250,000 tNPR" }, { status: 400 });
      }
      if (!Number.isFinite(postedPrice) || postedPrice <= 0) {
        return Response.json({ error: "A current market price is required" }, { status: 400 });
      }
      const account = await db
        .prepare("SELECT * FROM demo_accounts WHERE id = ?")
        .bind(userId)
        .first<DemoAccount>();
      if (!account || account.available_balance < notional) {
        return Response.json({ error: "Insufficient available test margin" }, { status: 400 });
      }
      const orderId = `order-${crypto.randomUUID().slice(0, 8)}`;
      await db.batch([
        db
          .prepare("UPDATE demo_accounts SET available_balance = available_balance - ? WHERE id = ?")
          .bind(notional, userId),
        db
          .prepare("INSERT INTO demo_orders VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
          .bind(orderId, userId, marketId, side, notional, postedPrice, "open", null, null, now, null),
        db
          .prepare("INSERT INTO demo_audit_events VALUES (?, ?, ?, ?, ?, ?)")
          .bind(crypto.randomUUID(), "order", userId, "Participant hedge request posted", `${side.toUpperCase()} · ${notional.toLocaleString()} tNPR · ${marketId.toUpperCase()} · awaiting counterparty`, now),
      ]);
      return Response.json({ ok: true, orderId, state: await readDemoState(db) });
    }

    if (action === "take_order") {
      const orderId = String(payload.orderId ?? "");
      const matchPrice = Number(payload.matchPrice);
      const order = await db
        .prepare("SELECT * FROM demo_orders WHERE id = ? AND status = 'open'")
        .bind(orderId)
        .first<DemoOrder>();
      if (!order) return Response.json({ error: "Order is no longer available" }, { status: 409 });
      if (order.user_id === userId) {
        return Response.json({ error: "Participants cannot match their own order" }, { status: 400 });
      }
      if (!Number.isFinite(matchPrice) || matchPrice <= 0) {
        return Response.json({ error: "A current market price is required" }, { status: 400 });
      }
      const account = await db
        .prepare("SELECT * FROM demo_accounts WHERE id = ?")
        .bind(userId)
        .first<DemoAccount>();
      if (!account || account.available_balance < order.notional) {
        return Response.json({ error: "Insufficient available test margin" }, { status: 400 });
      }
      const matchId = `match-${crypto.randomUUID().slice(0, 8)}`;
      const makerPosition = `pos-${crypto.randomUUID().slice(0, 8)}`;
      const takerPosition = `pos-${crypto.randomUUID().slice(0, 8)}`;
      const takerSide = order.side === "long" ? "short" : "long";
      const claim = await db
        .prepare("UPDATE demo_orders SET status = 'matching' WHERE id = ? AND status = 'open'")
        .bind(orderId)
        .run();
      const claimChanges = claim.meta?.changes ?? claim.changes ?? 0;
      if (claimChanges !== 1) {
        return Response.json({ error: "Another participant already accepted this order" }, { status: 409 });
      }
      try {
        await db.batch([
          db
            .prepare("UPDATE demo_accounts SET available_balance = available_balance - ? WHERE id = ?")
            .bind(order.notional, userId),
          db
            .prepare("UPDATE demo_orders SET status = 'matched', counterparty_id = ?, match_price = ?, matched_at = ? WHERE id = ? AND status = 'matching'")
            .bind(userId, matchPrice, now, orderId),
          db
            .prepare("INSERT INTO demo_positions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
            .bind(makerPosition, matchId, order.user_id, userId, order.market_id, order.side, order.notional, matchPrice, "open", now, null),
          db
            .prepare("INSERT INTO demo_positions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
            .bind(takerPosition, matchId, userId, order.user_id, order.market_id, takerSide, order.notional, matchPrice, "open", now, null),
          db
            .prepare("INSERT INTO demo_audit_events VALUES (?, ?, ?, ?, ?, ?)")
            .bind(crypto.randomUUID(), "match", userId, "Participant-to-participant match completed", `${order.user_id} ${order.side.toUpperCase()} ↔ ${userId} ${takerSide.toUpperCase()} · ${order.notional.toLocaleString()} tNPR · entry ${matchPrice}`, now),
        ]);
      } catch (cause) {
        await db
          .prepare("UPDATE demo_orders SET status = 'open' WHERE id = ? AND status = 'matching'")
          .bind(orderId)
          .run();
        throw cause;
      }
      return Response.json({ ok: true, matchId, state: await readDemoState(db) });
    }

    if (action === "cancel_order") {
      const orderId = String(payload.orderId ?? "");
      const order = await db
        .prepare("SELECT * FROM demo_orders WHERE id = ? AND status = 'open'")
        .bind(orderId)
        .first<DemoOrder>();
      if (!order || order.user_id !== userId) {
        return Response.json({ error: "Open order not found" }, { status: 404 });
      }
      await db.batch([
        db
          .prepare("UPDATE demo_orders SET status = 'cancelled' WHERE id = ?")
          .bind(orderId),
        db
          .prepare("UPDATE demo_accounts SET available_balance = available_balance + ? WHERE id = ?")
          .bind(order.notional, userId),
        db
          .prepare("INSERT INTO demo_audit_events VALUES (?, ?, ?, ?, ?, ?)")
          .bind(crypto.randomUUID(), "order", userId, "Hedge request cancelled", `${order.notional.toLocaleString()} tNPR margin released`, now),
      ]);
      return Response.json({ ok: true, state: await readDemoState(db) });
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Demo action failed" },
      { status: 500 },
    );
  }
}

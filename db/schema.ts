import { index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const demoAccounts = sqliteTable("demo_accounts", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  displayName: text("display_name").notNull(),
  company: text("company").notNull(),
  role: text("role").notNull(),
  hedgeStory: text("hedge_story").notNull(),
  availableBalance: integer("available_balance").notNull(),
});

export const demoOrders = sqliteTable(
  "demo_orders",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    marketId: text("market_id").notNull(),
    side: text("side", { enum: ["long", "short"] }).notNull(),
    notional: integer("notional").notNull(),
    postedPrice: real("posted_price").notNull(),
    status: text("status", { enum: ["open", "matched", "cancelled"] })
      .notNull()
      .default("open"),
    counterpartyId: text("counterparty_id"),
    matchPrice: real("match_price"),
    createdAt: text("created_at").notNull(),
    matchedAt: text("matched_at"),
  },
  (table) => [
    index("demo_orders_status_idx").on(table.status),
    index("demo_orders_market_idx").on(table.marketId),
  ],
);

export const demoPositions = sqliteTable(
  "demo_positions",
  {
    id: text("id").primaryKey(),
    matchId: text("match_id").notNull(),
    userId: text("user_id").notNull(),
    counterpartyId: text("counterparty_id").notNull(),
    marketId: text("market_id").notNull(),
    side: text("side", { enum: ["long", "short"] }).notNull(),
    notional: integer("notional").notNull(),
    entryPrice: real("entry_price").notNull(),
    status: text("status", { enum: ["open", "settled"] })
      .notNull()
      .default("open"),
    createdAt: text("created_at").notNull(),
    signature: text("signature"),
  },
  (table) => [
    index("demo_positions_user_idx").on(table.userId),
    index("demo_positions_market_idx").on(table.marketId),
  ],
);

export const demoDeposits = sqliteTable(
  "demo_deposits",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    amount: integer("amount").notNull(),
    reference: text("reference").notNull().unique(),
    rail: text("rail").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("demo_deposits_user_idx").on(table.userId)],
);

export const demoAuditEvents = sqliteTable(
  "demo_audit_events",
  {
    id: text("id").primaryKey(),
    kind: text("kind").notNull(),
    actorId: text("actor_id"),
    title: text("title").notNull(),
    detail: text("detail").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("demo_audit_created_idx").on(table.createdAt)],
);

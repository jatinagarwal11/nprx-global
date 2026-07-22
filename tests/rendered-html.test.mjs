import assert from "node:assert/strict";
import { access, readFile, stat } from "node:fs/promises";
import test from "node:test";

test("opens with participant creation instead of promoted demo accounts", async () => {
  const [page, route] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/demo/route.ts", import.meta.url), "utf8"),
  ]);
  assert.match(page, /Create your participant/);
  assert.match(page, /No password or personal email is collected/);
  assert.doesNotMatch(page, /personaCatalog|hedge123|Demo accounts/);
  assert.match(route, /action === "create_account"/);
  assert.match(route, /participant-\$\{crypto\.randomUUID\(\)\}/);
});

test("enforces capped paper funding and supports simulated redemption", async () => {
  const [page, route, migration] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/demo/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0002_panoramic_wilson_fisk.sql", import.meta.url), "utf8"),
  ]);
  assert.match(route, /MAX_LIFETIME_FUNDING = 1_000_000/);
  assert.match(route, /funding_total \+ \? <= \?/);
  assert.match(route, /action === "withdraw"/);
  assert.match(page, /lifetime allowance cannot exceed 1,000,000 tNPR/i);
  assert.match(page, /This prototype pays nothing/);
  assert.match(migration, /CREATE TABLE `demo_withdrawals`/);
  assert.match(migration, /ADD `funding_total`/);
});

test("ships live charts, 100 seeded trades, and participant-only matching", async () => {
  const [page, route, marketApi] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/demo/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/markets/route.ts", import.meta.url), "utf8"),
  ]);
  assert.match(marketApi, /CL=F/);
  assert.match(marketApi, /BZ=F/);
  assert.match(marketApi, /NPR=X/);
  assert.match(marketApi, /nrb\.org\.np\/api\/forex/);
  assert.match(page, /function MarketLineChart/);
  assert.match(page, /100-transaction market tape/);
  assert.match(route, /index < 100/);
  assert.match(route, /Participants cannot match their own order/);
  assert.match(page, /Both participants start at 0\.00 tNPR unrealised P&L/);
  assert.match(page, /No unilateral exit/);
});

test("explains the regulatory thesis without overstating the prototype", async () => {
  const [page, readme, script, route] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../README.md", import.meta.url), "utf8"),
    readFile(new URL("../DEMO_SCRIPT.md", import.meta.url), "utf8"),
    readFile(new URL("../app/api/demo/route.ts", import.meta.url), "utf8"),
  ]);
  assert.match(readme, /only \*\*12 of 81\*\*/);
  assert.match(readme, /capital account is not/);
  assert.match(readme, /No unilateral exit/);
  assert.match(readme, /1:1 reserve-backed tNPR/);
  assert.match(page, /Global exposure\. Domestic settlement\./);
  assert.match(page, /A real launch would require legislation/);
  assert.match(script, /Target length: \*\*2 minutes 50 seconds\*\*/);
  for (const source of [page, readme, script, route]) assert.doesNotMatch(source, /connectIPS/i);
});

test("provides an honestly scoped Solana Devnet receipt flow and social preview", async () => {
  const [page, route] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/demo/route.ts", import.meta.url), "utf8"),
  ]);
  assert.match(page, /MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr/);
  assert.match(page, /PAPER_TRADE_RECEIPT/);
  assert.match(page, /Today, tNPR is unbacked play money and matching is stored off-chain/);
  assert.match(route, /action === "attach_signature"/);
  assert.match(route, /UPDATE demo_trades SET chain_signature/);
  const og = await stat(new URL("../public/og.png", import.meta.url));
  assert.ok(og.size > 100_000);
  await assert.rejects(access(new URL("../app/_sites-preview/", import.meta.url)));
});

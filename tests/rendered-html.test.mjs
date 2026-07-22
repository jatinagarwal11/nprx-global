import assert from "node:assert/strict";
import { access, readFile, stat } from "node:fs/promises";
import test from "node:test";

test("ships four paper-trading personas and a clear problem statement", async () => {
  const [page, layout] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(layout, /Solana paper trading for business hedges/);
  assert.match(page, /Nepali businesses budget in NPR while fuel, freight and dollar invoices move globally/);
  for (const email of ["asha@himalagro.demo", "bikash@suryasolar.demo", "nima@everestfreight.demo", "maya@annapurnaexports.demo"]) {
    assert.match(page, new RegExp(email.replace(".", "\\.")));
  }
  assert.match(page, /No real identity, bank account, or money/);
  assert.doesNotMatch(page, /codex-preview|Your site is taking shape|SkeletonPreview/);
});

test("implements live charts, shared transactions, P&L, and participant-only matching", async () => {
  const [page, demoApi, marketApi, migration] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/demo/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/markets/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0001_powerful_iron_fist.sql", import.meta.url), "utf8"),
  ]);
  assert.match(marketApi, /CL=F/);
  assert.match(marketApi, /BZ=F/);
  assert.match(marketApi, /NPR=X/);
  assert.match(marketApi, /nrb\.org\.np\/api\/forex/);
  assert.match(page, /function MarketLineChart/);
  assert.match(page, /className="price-line"/);
  assert.match(page, /Transaction history/);
  assert.match(page, /Paper trade matched at/);
  assert.match(page, /Initial P&L is 0\.00 tNPR/);
  assert.match(demoApi, /INSERT INTO demo_trades/);
  assert.match(demoApi, /Participants cannot match their own order/);
  assert.match(demoApi, /person4/);
  assert.match(migration, /CREATE TABLE `demo_trades`/);
});

test("provides a functional and honestly scoped Solana Devnet receipt flow", async () => {
  const [page, demoApi, readme, script] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/demo/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../README.md", import.meta.url), "utf8"),
    readFile(new URL("../DEMO_SCRIPT.md", import.meta.url), "utf8"),
  ]);
  assert.match(page, /MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr/);
  assert.match(page, /import\("@coral-xyz\/anchor\/dist\/browser\/index\.js"\)/);
  assert.match(page, /PAPER_TRADE_RECEIPT/);
  assert.match(demoApi, /action === "attach_signature"/);
  assert.match(demoApi, /UPDATE demo_trades SET chain_signature/);
  assert.match(page, /Paper balances, price feeds and order matching are off-chain simulations/);
  assert.match(readme, /functional Devnet component/);
  assert.match(script, /Target length: \*\*2 minutes 45 seconds\*\*/);
  assert.ok(readme.length < 6000, "README should remain concise");
});

test("ships the social preview and removes starter artifacts", async () => {
  const og = await stat(new URL("../public/og.png", import.meta.url));
  assert.ok(og.size > 100_000);
  await assert.rejects(access(new URL("../app/_sites-preview/", import.meta.url)));
});

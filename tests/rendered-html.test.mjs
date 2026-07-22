import assert from "node:assert/strict";
import { access, readFile, readdir, stat } from "node:fs/promises";
import test from "node:test";

test("supports durable sign-in and one-time legacy recovery", async () => {
  const [page, route, auth] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/demo/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/chatgpt-auth.ts", import.meta.url), "utf8"),
  ]);
  assert.match(page, /Sign in with ChatGPT/);
  assert.match(page, /Recover old account/);
  assert.match(page, /pseudonymous ownership key/);
  assert.doesNotMatch(page, /personaCatalog|hedge123|Demo accounts/);
  assert.match(route, /action === "create_account"/);
  assert.match(route, /action === "claim_legacy"/);
  assert.match(route, /requireOwnedAccount/);
  assert.match(route, /owner_key/);
  assert.match(route, /'Market participant' AS display_name/);
  assert.match(auth, /oai-authenticated-user-email/);
  assert.match(route, /participant-\$\{crypto\.randomUUID\(\)\}/);
});

test("enforces capped paper funding and supports simulated redemption", async () => {
  const migrationFiles = (await readdir(new URL("../drizzle/", import.meta.url))).filter((name) => name.endsWith(".sql"));
  const [page, route, migrations] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/demo/route.ts", import.meta.url), "utf8"),
    Promise.all(migrationFiles.map((name) => readFile(new URL(`../drizzle/${name}`, import.meta.url), "utf8"))).then((parts) => parts.join("\n")),
  ]);
  assert.match(route, /MAX_LIFETIME_FUNDING = 1_000_000/);
  assert.match(route, /funding_total \+ \? <= \?/);
  assert.match(route, /action === "withdraw"/);
  assert.match(page, /lifetime allowance cannot exceed 1,000,000 tNPR/i);
  assert.match(page, /This prototype pays nothing/);
  assert.match(migrations, /CREATE TABLE `demo_withdrawals`/);
  assert.match(migrations, /ADD `funding_total`/);
  assert.match(migrations, /owner_key/);
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
  assert.match(page, /MY SOLANA AUDIT TRAIL/);
  assert.match(page, /A receipt is evidence, not clearing/);
  assert.match(page, /Today, tNPR is unbacked play money and matching is stored off-chain/);
  assert.match(route, /action === "attach_signature"/);
  assert.match(route, /verifySolanaReceipt/);
  assert.match(route, /getTransaction/);
  assert.match(route, /UPDATE demo_trades SET chain_signature/);
  const og = await stat(new URL("../public/og.png", import.meta.url));
  assert.ok(og.size > 100_000);
  await assert.rejects(access(new URL("../app/_sites-preview/", import.meta.url)));
});

test("adds guided onboarding and exposes the application audit log", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /GETTING STARTED/);
  assert.match(page, /PRODUCT WALKTHROUGH/);
  assert.match(page, /APPLICATION AUDIT LOG/);
  assert.match(page, /Contract expiry, final settlement/);
});

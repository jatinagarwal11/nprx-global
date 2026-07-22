import assert from "node:assert/strict";
import { access, readFile, stat } from "node:fs/promises";
import test from "node:test";

test("ships the demo login and safety boundary", async () => {
  const [page, layout] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(layout, /NPRX Global — Business hedging/);
  assert.match(page, /Hedge the costs your business cannot control/);
  assert.match(page, /asha@himalagro\.demo/);
  assert.match(page, /bikash@suryasolar\.demo/);
  assert.match(page, /demo persona selector, not production authentication/i);
  assert.doesNotMatch(page, /codex-preview|Your site is taking shape|SkeletonPreview/);
});

test("implements participant matching, live markets, P&L, and Solana receipt boundaries", async () => {
  const [page, demoApi, marketApi, layout, packageJson, readme] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/demo/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/markets/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../README.md", import.meta.url), "utf8"),
  ]);

  assert.match(marketApi, /CL=F/);
  assert.match(marketApi, /BZ=F/);
  assert.match(marketApi, /NPR=X/);
  assert.match(marketApi, /nrb\.org\.np\/api\/forex/);
  assert.match(demoApi, /order-wti-2048/);
  assert.match(demoApi, /Participants cannot match their own order/);
  assert.match(demoApi, /takerSide = order\.side === "long" \? "short" : "long"/);
  assert.match(page, /matchPrice/);
  assert.match(page, /Your unrealised P&L starts at 0\.00 tNPR/);
  assert.match(page, /Platform position/);
  assert.match(page, /No automatic market maker or platform counterparty/);
  assert.match(page, /MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr/);
  assert.match(page, /import\("@coral-xyz\/anchor\/dist\/browser\/index\.js"\)/);
  assert.match(layout, /summary_large_image/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  assert.match(readme, /hybrid architecture/i);
  assert.match(readme, /does \*\*not\*\* include/);
});

test("ships a bespoke social preview and removes starter artifacts", async () => {
  const og = await stat(new URL("../public/og.png", import.meta.url));
  assert.ok(og.size > 100_000);
  await assert.rejects(access(new URL("../app/_sites-preview/", import.meta.url)));
});

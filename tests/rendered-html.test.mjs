import assert from "node:assert/strict";
import { access, readFile, stat } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("https://nprx.example/", {
      headers: { accept: "text/html", host: "nprx.example" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the complete NPRX product shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>NPRX Global/);
  assert.match(html, /Solana Devnet simulation/);
  assert.match(html, /tNPR has no monetary value/);
  assert.match(html, /Global Equity Daily Future/);
  assert.match(html, /Orders are matched in five-minute batches/);
  assert.match(html, /Technical simulation only/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|SkeletonPreview/);
});

test("keeps the risk and Solana boundaries explicit in source", async () => {
  const [page, layout, packageJson, readme] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../README.md", import.meta.url), "utf8"),
  ]);

  assert.match(page, /LOWER_BAND = 995/);
  assert.match(page, /UPPER_BAND = 1_005/);
  assert.match(page, /Only 180,000 tNPR of opposing liquidity is available/);
  assert.match(page, /Insufficient available tNPR for 100% prefunded margin/);
  assert.match(page, /MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr/);
  assert.match(page, /import\("@coral-xyz\/anchor\/dist\/browser\/index\.js"\)/);
  assert.match(page, /TEST ONLY · NO MONETARY VALUE/);
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

# NPRX Global

**A Solana-enabled paper market for testing how Nepali businesses could hedge global price risk without sending capital abroad.**

> NPRX is a hackathon prototype. It uses no real money, offers no real derivative, and is not a bank, broker, exchange, clearing house, custodian, or investment service. `tNPR` is simulated and has no monetary value.

**Live simulation:** https://nprx-global-devnet.j4tin11.chatgpt.site

## Why this matters

Nepali businesses earn, spend and budget in NPR, but many of their economics move with global prices. Importers owe USD for inventory, machinery, freight and inputs. Exporters expect USD receipts. Transport, aviation, manufacturing and hospitality businesses absorb fuel-price volatility. These are implicit market positions even when the business never buys a financial asset.

The exposure is material. Nepal Rastra Bank's eleven-month 2025/26 report recorded merchandise imports of **NPR 1,894.10 billion**, exports of **NPR 277.97 billion**, and a **NPR 1,616.13 billion trade deficit**. It also reported that Brent crude was up **16.63% year-on-year** and the NPR had depreciated **9.8% against the USD**.

Nepal does have a legal and regulatory route for FX hedging. NRB's study of the market says non-financial firms can hedge through Class A commercial banks and national-level Class B development banks, and that banks can transact forwards with customers while covering their own risk. But access is institutional and bank-mediated: the market is dominated by commercial banks, only **12 of 81** surveyed non-financial firms used FX derivatives, and firms cited non-availability plus legal and administrative hurdles. The same study describes current forward contracts as constrained by rigidity, short maturity, cost and **no exit policy**.

Nepal also maintains capital-account controls. NRB states that the current account is convertible but the capital account is not, while the Foreign Investment Prohibition Act restricts investment abroad unless an exemption applies. NPRX therefore explores a domestic, NPR-settled design: participants obtain price exposure to an index, but the prototype neither purchases the referenced foreign asset nor transfers money outside Nepal.

This is a product hypothesis for regulatory discussion—not a claim that a public derivatives venue is presently authorised. A real launch would require legislation, licensing, market-conduct rules and approval from the relevant Government of Nepal, NRB and securities/commodities authorities.

## What NPRX tests

NPRX acts as a broker and matching venue between participants with opposite business exposures. The platform itself cannot take a directional position.

- An **importer** expecting a future USD invoice is naturally short USD/NPR: a stronger dollar raises its NPR cost. It may request a long USD/NPR hedge.
- An **exporter** expecting USD receipts is naturally long USD/NPR: a stronger dollar increases its NPR revenue. It may take the opposite short hedge to stabilise the NPR value of those receipts.
- A **fuel-intensive company** is naturally short oil because higher oil prices raise costs. It may take a long oil hedge.
- A **solar company** may benefit commercially when conventional-energy prices rise, giving it an economic long-oil exposure. It may take a short oil hedge to reduce that sensitivity.

NPRX connects these complementary exposures. Open interest exists only after two participants match; there is no house market maker and no hidden platform inventory.

## Important limitations

This bilateral model is deliberately narrower than a conventional futures exchange.

1. **No unilateral exit:** a participant cannot close an open position unless its counterparty agrees to an offset or novation. The current prototype does not implement exits.
2. **Participant-created liquidity:** an order remains open until another participant takes the opposite side. NPRX never fills it from a platform account.
3. **Index-only exposure:** no USD, oil or overseas security is purchased. Settlement is an NPR-denominated difference derived from a reference index.
4. **Regulatory dependency:** a real system would need an approved legal structure, licensed operators, market surveillance, suitability controls, audited reserves and recognised price/oracle governance.
5. **Residual risk remains:** full collateral and deterministic settlement can reduce counterparty risk; they do not eliminate oracle, smart-contract, custody, operational, legal or governance risk.

## Why use a blockchain?

A shared settlement layer can make participant-only rules visible and enforceable:

- collateral can be locked before an order becomes matchable;
- one long and one short position can be created atomically;
- rules can prevent self-matching and platform inventory;
- settlement instructions and reserves can be audited;
- participants can verify receipts independently of the broker;
- a permissioned, regulator-observable market can share one tamper-evident ledger.

In a regulated production model, a licensed operator would accept NPR through domestic banking rails, mint the same amount of **1:1 reserve-backed tNPR**, lock tNPR as margin, settle gains and losses on-chain, and redeem tNPR back to NPR. Exposure would be cash-settled domestically; no participant money would be used to buy the referenced foreign asset. Reserve backing and redemption are only a proposed operating model—the prototype's tNPR is unbacked play money.

## The working prototype

- Create a public sandbox account for a Nepali business use case.
- Claim test funds subject to a strict **1,000,000 tNPR lifetime cap per account**.
- Follow near-live WTI, Brent and USD/NPR reference charts.
- See an official NRB USD/NPR daily reference separately.
- Post long or short hedge requests to a shared participant order book.
- Match fully collateralised paper positions with zero initial P&L.
- Explore 100 seeded market transactions and a deeper portfolio view.
- Simulate tNPR redemption to illustrate the intended real-world withdrawal flow.
- Optionally sign a paper-trade receipt through Solana's deployed Memo Program using `@coral-xyz/anchor`.

Paper accounts, matching, funding and balances are stored in a shared Cloudflare D1 database. Only optional audit receipts are currently written to Solana Devnet. No real asset or claim is represented.

## Run locally

```bash
pnpm install
pnpm dev
```

Run the production checks with `pnpm test`.

## Sources and regulatory context

- [NRB: Foreign Exchange Derivative Market in Nepal (2021)](https://www.nrb.org.np/contents/uploads/2021/10/Foreign-Exchange-Derivative-Market-in-Nepal.pdf)
- [NRB: Current Macroeconomic and Financial Situation, eleven months of 2025/26](https://www.nrb.org.np/red/current-macroeconomic-and-financial-situation-english-based-on-eleven-months-data-of-2025-26/)
- [NRB explanation of current-account convertibility and capital-account controls](https://www.nrb.org.np/2023/08/%E0%A4%A8%E0%A5%87%E0%A4%AA%E0%A4%BE%E0%A4%B2%E0%A4%AE%E0%A4%BE-%E0%A4%95%E0%A5%8D%E0%A4%B0%E0%A4%BF%E0%A4%AA%E0%A5%8D%E0%A4%9F%E0%A5%8B%E0%A4%95%E0%A4%B0%E0%A5%87%E0%A4%A8%E0%A5%8D%E0%A4%B8%E0%A5%80/)
- [Nepal Law Commission: Foreign Exchange (Regulation) Act, 2019 B.S.](https://repository.lawcommission.gov.np/np/category/documents/prevailing-law/statutes-acts/%E0%A4%B5%E0%A4%BF%E0%A4%A6%E0%A5%87%E0%A4%B6%E0%A5%80-%E0%A4%B5%E0%A4%BF%E0%A4%A8%E0%A4%BF%E0%A4%AE%E0%A4%AF-%E0%A4%A8%E0%A4%BF%E0%A4%AF%E0%A4%AE%E0%A4%BF%E0%A4%A4-%E0%A4%97%E0%A4%B0%E0%A5%8D/)
- [Nepal Law Commission: Act Restricting Investment Abroad, 2021 B.S.](https://repository.lawcommission.gov.np/np/category/documents/prevailing-law/statutes-acts/%E0%A4%B5%E0%A4%BF%E0%A4%A6%E0%A5%87%E0%A4%B6%E0%A4%AE%E0%A4%BE-%E0%A4%B2%E0%A4%97%E0%A4%BE%E0%A4%A8%E0%A5%80-%E0%A4%97%E0%A4%B0%E0%A5%8D%E0%A4%A8-%E0%A4%AA%E0%A5%8D%E0%A4%B0%E0%A4%A4%E0%A4%BF/)

## Demo video

Use [`DEMO_SCRIPT.md`](./DEMO_SCRIPT.md) to record the required sub-three-minute Loom or YouTube walkthrough, then add the published video link here before submission.

## Disclaimer

Educational hackathon simulation only. Nothing in this repository is legal, regulatory, financial or investment advice.

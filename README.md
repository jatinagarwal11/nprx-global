# NPRX Global

NPRX Global is a Solana Devnet paper-trading MVP for Nepali businesses exposed to global oil prices and USD/NPR movements.

**Live demo:** https://nprx-global-devnet.j4tin11.chatgpt.site

## The problem

Nepali businesses budget in NPR while fuel, freight, equipment and invoices move with global oil and dollar prices. Most cannot easily test how a hedge would affect those costs.

## The prototype

- Near-live WTI, Brent and USD/NPR indicative charts.
- Official Nepal Rastra Bank daily USD/NPR reference.
- Four business personas with different natural exposures.
- Simulated connectIPS funding and test-only tNPR balances.
- Shared participant order book with no platform trading account.
- Fully collateralised paper positions and live unrealised P&L.
- Populated transaction history and audit trail.
- Optional signed trade receipts on Solana Devnet.

## Solana integration

Participants can connect Phantom or Solflare and publish a structured paper-trade receipt through Solana’s deployed Memo Program. The app uses `@coral-xyz/anchor` to submit the signed transaction, then stores the confirmed signature with the shared trade and links to Solana Explorer.

Paper balances, prices and matching remain an off-chain simulation. The on-chain receipt is the functional Devnet component; no real funds or assets are represented.

## Demo accounts

Password for every account: `hedge123`

| Business | Email | Example exposure |
|---|---|---|
| Himal Agro Imports | `asha@himalagro.demo` | Long oil and USD/NPR |
| Surya Solar Nepal | `bikash@suryasolar.demo` | Opposing oil exposure |
| Everest Freight & Logistics | `nima@everestfreight.demo` | Long fuel and USD costs |
| Annapurna Garment Exports | `maya@annapurnaexports.demo` | Short USD/NPR and oil |

## Run locally

```bash
pnpm install
pnpm dev
```

Production check:

```bash
pnpm test
```

## Stack

Vinext, React, TypeScript, Cloudflare D1, Solana Web3.js and `@coral-xyz/anchor`.

## Demo video

Use [`DEMO_SCRIPT.md`](./DEMO_SCRIPT.md) to record the required sub-three-minute Loom or YouTube walkthrough, then add the published video link here before submission.

## Disclaimer

Hackathon paper-trading prototype only. No real money, deposits, custody, securities, derivatives, settlement, or investment service.

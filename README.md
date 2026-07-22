# NPRX Global

> Global reference. Local risk. Public proof.

NPRX Global is a Solana Devnet MVP for a locally settled derivatives market. It demonstrates how a verified Nepali participant could take a fully collateralised long or short position on an approved global benchmark while using only a closed-loop test margin unit called **tNPR**.

This release is a technical and economic simulation. tNPR has no monetary value, cannot be redeemed, and is not a representation of real Nepalese rupees. No foreign currency, security, or real customer deposit is involved.

## The problem

Nepali institutions, businesses, and qualified investors do not have a transparent local venue for managing global benchmark risk. Existing offshore routes conflict with capital-control, investor-protection, and supervisory requirements.

NPRX tests a different model: locally listed, locally collateralised, locally settled contracts with hard risk limits and a live regulator view.

## What the MVP does

- Simulates a verified participant with a prefunded tNPR margin account.
- Offers one one-day Global Equity Future (`GEF-1D`).
- Accepts long or short limit orders inside a ±0.5% reference-price band.
- Enforces 1× maximum exposure and 100% prefunded margin.
- Rejects orders when collateral, price-band, or opposing-liquidity limits fail.
- Creates positions only when the long and short sides remain balanced.
- Settles positions deterministically against a mock official closing reference.
- Shows total supply, matched open interest, market-maker inventory, oracle health, and an audit stream in a dedicated oversight console.
- Lets a connected Solana wallet publish a signed position commitment through the Memo Program on Devnet and opens the confirmed transaction in Solana Explorer.

## Three-minute demo path

1. Open **Trade** and explain the permanent Devnet and no-value disclosures.
2. Place the prefilled `100,000 tNPR` long order at the `1,000.00` opening reference.
3. Point out that the order is fully collateralised and matched in a five-minute batch.
4. Settle the position at the `1,030.00` demo close to show a `+3,000 tNPR` result.
5. Open **Oversight** to show equal long/short open interest, system controls, and the new settlement audit event.
6. Optionally connect Phantom or Solflare on Devnet, anchor the position commitment, and open its explorer receipt.
7. Open **How it works** to explain the regulatory-first architecture and the exact boundary between the MVP and a future approved pilot.

## Architecture

```text
Browser participant simulation
        │
        ├── Compliance attestation state (demo)
        ├── tNPR margin ledger (demo)
        ├── Batch matching + risk checks (deterministic client engine)
        ├── Daily settlement engine (deterministic client engine)
        ├── Regulator oversight console (same shared state)
        │
        └── Solana Devnet
              └── Signed position commitment via Memo Program
```

The MVP deliberately uses a hybrid architecture: matching and financial state are simulated locally, while a user can publish a verifiable commitment on Devnet. This proves the product flow and Solana audit primitive without pretending that an undeployed clearing program controls real funds.

The production path is an Anchor program with program-derived compliance, margin, market, position, and settlement accounts; a licensed oracle adapter; and separate multisignature authorities for upgrades, minting, market creation, oracle replacement, and emergency pause.

## Settlement model

For a position with tNPR notional `N`, opening reference `I₀`, and settlement reference `Iₜ`:

```text
Long P&L  = N × (Iₜ / I₀ − 1)
Short P&L = −Long P&L
```

The market is zero-sum. Every executed long is backed by an executed short or a market maker operating inside a fixed inventory limit. Unmatched demand remains unfilled.

## Solana integration

The frontend uses `@coral-xyz/anchor` and `@solana/web3.js` to:

- discover and connect an injected Solana wallet;
- create an `AnchorProvider` against Devnet;
- encode a concise position commitment;
- request a wallet signature;
- submit the commitment to the deployed Solana Memo Program; and
- link the confirmed signature to Solana Explorer.

A small amount of Devnet SOL is required for the network fee. The simulation works without a wallet.

## Run locally

Prerequisites: Node.js 22.13+ and pnpm 11.

```bash
pnpm install
pnpm dev
```

Then open the local URL printed by the development server.

Production build:

```bash
pnpm build
```

## Safety boundary

This MVP does **not** include:

- real NPR, bank deposits, withdrawals, or redemption;
- a public or transferable NPR token;
- anonymous accounts or personal identity data on-chain;
- crypto or stablecoin collateral;
- foreign securities, foreign exchange, or offshore hedging;
- production KYC, a licensed benchmark feed, or regulatory approval; or
- a deployed custom clearing program controlling financial value.

Any live pilot would require written guidance and approvals from the relevant Nepalese securities, central-bank, foreign-exchange, AML, tax, and data-licensing authorities, plus independent legal review.

## Roadmap

1. **Economic simulation** — test one-sided demand, gaps, oracle failures, inventory caps, and mass exits.
2. **Devnet program** — migrate compliance, internal margin, markets, positions, and settlement into audited Anchor accounts and instructions.
3. **Closed demonstration** — invite regulators, banks, exchanges, institutional users, and market makers.
4. **Approved sandbox pilot** — one bank, one benchmark, institutional users, low open-interest caps, no freely transferable token.
5. **Authorised market-maker hedge** — only if approved, hedge the residual net exposure within a fixed quota and reporting regime.

## Why Solana

Solana provides low-cost signed transactions, deterministic program execution, composable account state, and a public audit trail. For NPRX, the value is supervisory transparency and programmable controls—not anonymity or regulatory avoidance.

## Disclaimer

NPRX Global is a hackathon prototype and educational simulation. It is not an exchange, brokerage, investment product, payment instrument, offer, solicitation, or legal opinion.

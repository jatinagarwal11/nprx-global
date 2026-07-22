# NPRX Global

> Live reference. Local hedge. Participant-to-participant proof.

NPRX Global is a Solana Devnet MVP for Nepali businesses that want to understand and hedge volatile input costs. It combines near-live WTI crude, Brent crude, and USD/NPR reference data with a shared, fully collateralised demo order book.

This release is a product and technical simulation. Its payment flow, balances, tNPR, positions, and settlement are test-only. No real money, bank account, commodity, currency, security, or derivative is held or transferred.

## Problem

Nepali importers and other businesses budget in NPR while many important costs—fuel, freight, equipment, and dollar invoices—move with global oil prices and USD/NPR. NPRX demonstrates a simple local workflow for making that risk visible and finding a business with the opposite exposure.

## What the MVP does

- Provides two prepared business personas with a clearly labelled demo login.
- Simulates a connectIPS funding hand-off and credits tNPR 1:1, without contacting a bank or payment network.
- Tracks WTI, Brent, and USD/NPR using server-side indicative/delayed quote requests.
- Shows the Nepal Rastra Bank official daily USD buy/sell reference separately.
- Stores accounts, deposits, orders, positions, and audit events in a shared D1 database.
- Lets participants post long or short requests that every other participant can see.
- Creates positions only when a different participant accepts the opposite side.
- Uses one identical live match price for both sides, so each new position starts at exactly `0.00 tNPR` unrealised P&L.
- Keeps platform inventory at zero; all matched open interest comes from equal participant long and short positions.
- Optionally lets a connected wallet publish a test-only match receipt through the Solana Memo Program on Devnet.

## Demo accounts

| Persona | Business | Email | Password | Scenario |
|---|---|---|---|---|
| Asha Shrestha | Himal Agro Imports | `asha@himalagro.demo` | `hedge123` | Long oil and USD/NPR to protect rising import costs |
| Bikash Karki | Surya Solar Nepal | `bikash@suryasolar.demo` | `hedge123` | Short oil exposure as the opposing solar-business view |

Both accounts start with earlier matched Brent and USD/NPR positions. Asha also has a seeded `10,000 tNPR` WTI long request waiting in the shared order book.

## Three-minute demo path

1. Log in as **Asha** and introduce Himal Agro’s exposure to rising oil and dollar costs.
2. Walk through the clearly labelled **connectIPS Sandbox Simulation** and show that a test NPR amount becomes the same amount of tNPR.
3. Open **Markets** and compare live WTI, Brent, and USD/NPR references. On USD/NPR, point out the separate NRB official daily rate.
4. Open the **Order book** and show Asha’s existing `10,000 tNPR` WTI long request. Explain that it is not yet open interest.
5. Switch accounts, log in as **Bikash**, and accept the short side. The two positions are created at one current match price and initial P&L is `0.00 tNPR`.
6. Open **Portfolio** to show Bikash’s existing hedges and the new WTI position. Optionally connect Phantom or Solflare and publish a Devnet receipt.
7. Open **Oversight** to show equal long/short open interest and `0 tNPR` platform exposure.

## Architecture

```text
Browser
  ├── demo persona session (sessionStorage; not production authentication)
  ├── live market UI and P&L calculation
  └── optional wallet signing
          │
          ├── /api/markets
          │     ├── indicative/delayed WTI, Brent and USD/NPR quotes
          │     └── NRB official daily USD/NPR reference
          │
          ├── /api/demo + Cloudflare D1
          │     ├── demo accounts and sandbox deposits
          │     ├── shared participant order book
          │     ├── equal-and-opposite positions
          │     └── audit events
          │
          └── Solana Devnet Memo Program
                └── optional signed match receipt
```

The MVP deliberately uses a hybrid architecture. Durable shared financial-demo state lives in D1, price references are fetched server-side, and Solana provides an optional public receipt. It does **not** claim that a deployed clearing program controls money or settlement.

## P&L and open interest

For notional `N`, match price `I0`, current mark `It`, and direction `d` (`+1` long, `-1` short):

```text
Unrealised P&L = d × N × (It / I0 − 1)
```

At the moment of matching, `It = I0`, so P&L is zero for both sides. Later market refreshes move the mark. Open interest is counted once per matched pair; open requests are excluded.

## Solana integration

The frontend uses `@coral-xyz/anchor` and `@solana/web3.js` to discover an injected wallet, create an `AnchorProvider` for Devnet, encode a concise test match receipt, request a signature, and submit it to the Memo Program. The main demo works without a wallet.

## Run locally

Prerequisites: Node.js 22.13+ and pnpm 11.

```bash
pnpm install
pnpm dev
```

Generate a migration after database-schema changes:

```bash
pnpm db:generate
```

Validate a production build:

```bash
pnpm test
```

## Safety boundary

This MVP does **not** include real authentication, KYC, NPR deposits, withdrawals, redemption, custody, official exchange execution, licensed market data, production settlement, or regulatory approval. Quote feeds can be delayed or unavailable and are not valid settlement prices. The connectIPS-style screen is an explicitly labelled sandbox simulation and does not use the real payment service.

Any real pilot would require data licences, audited market and clearing logic, production identity and access controls, independent security review, and written guidance from the relevant Nepalese financial, securities, foreign-exchange, AML, tax, and privacy authorities.

## Roadmap

1. Test the business scenarios and demand with importers, exporters, logistics firms, energy companies, and banks.
2. Replace demo persona login with production-grade identity and verified organisation roles.
3. Move collateral, matching, and settlement rules into an audited Anchor program or an approved hybrid market architecture.
4. Add licensed oracle adapters, circuit breakers, maturities, close/settle flows, and regulator reporting.
5. Run a closed, legally approved sandbox before handling any real financial value.

## Disclaimer

NPRX Global is a hackathon prototype and educational simulation. It is not an exchange, brokerage, payment instrument, investment product, offer, solicitation, or legal opinion.

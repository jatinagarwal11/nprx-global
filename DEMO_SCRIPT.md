# NPRX Global - 3-minute demo script

Target length: **2 minutes 50 seconds**.

## 0:00-0:30 - Problem and regulatory context

"Nepali businesses budget in NPR, but import invoices, export receipts and fuel costs move with USD and global oil. NRB permits bank-mediated FX forwards, yet its own study describes a bank-dominated market with limited firm participation, legal and administrative hurdles, and no exit policy. NPRX asks whether opposite business exposures could be matched and settled domestically."

Show **Sign in with ChatGPT**, then create a participant. Explain that the participant can now be restored across browsers without an NPRX password; older device-only accounts have a one-time recovery flow. State clearly that this is a paper simulation.

## 0:30-0:55 - Capped paper funding

Claim 250,000 tNPR from the paper faucet.

"Every participant has a strict lifetime allowance of one million test tNPR. No NPR enters the app and tNPR has no monetary value."

Show the funding meter and return to Trade.

## 0:55-1:25 - Live markets and order creation

Switch between WTI and USD/NPR, then hover over the line chart.

"NPRX follows near-live reference data and shows the NRB daily USD/NPR rate separately. An importer expecting a USD invoice can post a long USD/NPR hedge; a fuel-intensive company can post a long oil hedge."

Post a 50,000 tNPR long request.

## 1:25-1:55 - Participant matching

Open Orders and take one existing participant's opposite request.

"The platform cannot trade. A match creates one long and one short at the same price, both fully paper-collateralised and both starting at zero unrealised P&L."

Mention the limitation: there is no unilateral exit; closing would require counterparty consent.

## 1:55-2:20 - Portfolio and market activity

Open Portfolio, then Transactions.

"The portfolio shows equity, available and locked margin, mark-to-market P&L, exposure by index and the bilateral counterparty. The shared tape contains 100 simulated transactions across oil and USD/NPR."

## 2:20-2:50 - Solana and long-term model

Open **Solana**, connect a Devnet wallet and optionally publish one matched trade receipt. Show the on-chain/off-chain boundary and the Solana Explorer link.

"Today Solana is the proof layer: a participant signs the matched trade facts, NPRX verifies the confirmed Memo transaction, and anyone can inspect the signature. Prices, balances, matching and P&L remain off-chain. In a regulated production model, domestic NPR would be held by a licensed operator, 1:1 reserve-backed tNPR would be locked as on-chain margin, matches would settle deterministically, and tNPR could be redeemed back to NPR."

End on the no-real-money disclaimer and live URL.

## Recording checklist

- Keep the final video under 3:00.
- State that tNPR is unbacked play money and no real derivative exists.
- Do not claim that counterparty risk is eliminated; say collateral can reduce it.
- Use a Solana Devnet wallet only if publishing a receipt.
- Show the Guide or application audit log if time permits.
- Upload to Loom or YouTube and add the link to `README.md`.

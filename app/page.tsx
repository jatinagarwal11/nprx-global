"use client";

import {
  Activity,
  ArrowUpRight,
  BarChart3,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Database,
  Droplets,
  ExternalLink,
  Eye,
  Gauge,
  Landmark,
  Link2,
  LockKeyhole,
  PlayCircle,
  RotateCcw,
  Scale,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
  Wallet,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const REFERENCE_PRICE = 1_000;
const MARK_PRICE = 1_003.2;
const LOWER_BAND = 995;
const UPPER_BAND = 1_005;
const MEMO_PROGRAM_ID = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr";

type View = "trade" | "oversight" | "architecture";
type Side = "long" | "short";
type PositionStatus = "open" | "settled";

type Position = {
  id: string;
  side: Side;
  notional: number;
  entry: number;
  locked: number;
  status: PositionStatus;
  settlementPrice?: number;
  realisedPnl?: number;
  signature?: string;
};

type AuditEvent = {
  id: string;
  time: string;
  kind: "compliance" | "oracle" | "order" | "settlement" | "faucet" | "chain";
  title: string;
  detail: string;
  signature?: string;
};

type BrowserWallet = {
  publicKey?: { toString: () => string };
  isConnected?: boolean;
  connect: () => Promise<{ publicKey: { toString: () => string } }>;
  disconnect?: () => Promise<void>;
  signTransaction: <T>(transaction: T) => Promise<T>;
  signAllTransactions?: <T>(transactions: T[]) => Promise<T[]>;
};

declare global {
  interface Window {
    solana?: BrowserWallet;
    phantom?: { solana?: BrowserWallet };
    solflare?: BrowserWallet;
  }
}

const initialAudit: AuditEvent[] = [
  {
    id: "evt-oracle",
    time: "10:00:00",
    kind: "oracle",
    title: "Opening reference published",
    detail: "GEF-1D opened at 1,000.00 · Mock oracle · fresh",
  },
  {
    id: "evt-kyc",
    time: "09:58:12",
    kind: "compliance",
    title: "Demo participant verified",
    detail: "KYC-DEMO-7A91 · Nepal · retail limit applied",
  },
];

const formatNpr = (amount: number, digits = 0) =>
  new Intl.NumberFormat("en-NP", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(amount);

const shortAddress = (address: string) =>
  `${address.slice(0, 4)}…${address.slice(-4)}`;

const eventIcon = (kind: AuditEvent["kind"]) => {
  if (kind === "oracle") return <Activity size={15} />;
  if (kind === "compliance") return <ShieldCheck size={15} />;
  if (kind === "settlement") return <Scale size={15} />;
  if (kind === "faucet") return <Droplets size={15} />;
  if (kind === "chain") return <Link2 size={15} />;
  return <BarChart3 size={15} />;
};

export default function Home() {
  const [view, setView] = useState<View>("trade");
  const [side, setSide] = useState<Side>("long");
  const [notional, setNotional] = useState(100_000);
  const [limitPrice, setLimitPrice] = useState(1_000);
  const [availableBalance, setAvailableBalance] = useState(250_000);
  const [positions, setPositions] = useState<Position[]>([]);
  const [audit, setAudit] = useState<AuditEvent[]>(initialAudit);
  const [walletAddress, setWalletAddress] = useState("");
  const [walletProvider, setWalletProvider] = useState<BrowserWallet | null>(null);
  const [orderMessage, setOrderMessage] = useState("");
  const [orderError, setOrderError] = useState("");
  const [walletMessage, setWalletMessage] = useState("");
  const [isAnchoring, setIsAnchoring] = useState(false);
  const [faucetUsed, setFaucetUsed] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(6 * 60 * 60 + 42 * 60 + 18);

  useEffect(() => {
    const timer = window.setInterval(
      () => setSecondsLeft((value) => Math.max(value - 1, 0)),
      1_000,
    );
    return () => window.clearInterval(timer);
  }, []);

  const openPositions = positions.filter((position) => position.status === "open");
  const lockedCollateral = openPositions.reduce(
    (total, position) => total + position.locked,
    0,
  );
  const totalBalance = availableBalance + lockedCollateral;
  const unrealisedPnl = openPositions.reduce((total, position) => {
    const direction = position.side === "long" ? 1 : -1;
    return (
      total +
      direction * position.notional * (MARK_PRICE / position.entry - 1)
    );
  }, 0);
  const userOpenNotional = openPositions.reduce(
    (total, position) => total + position.notional,
    0,
  );
  const userLongNotional = openPositions
    .filter((position) => position.side === "long")
    .reduce((total, position) => total + position.notional, 0);
  const userShortNotional = openPositions
    .filter((position) => position.side === "short")
    .reduce((total, position) => total + position.notional, 0);
  const balancedOpenInterest = 6_200_000 + userOpenNotional;
  const makerInventory = 820_000 + Math.abs(userLongNotional - userShortNotional);
  const demoStep = positions.length === 0 ? 2 : openPositions.length > 0 ? 3 : 4;

  const formattedCountdown = useMemo(() => {
    const hours = Math.floor(secondsLeft / 3_600);
    const minutes = Math.floor((secondsLeft % 3_600) / 60);
    const seconds = secondsLeft % 60;
    return [hours, minutes, seconds]
      .map((part) => part.toString().padStart(2, "0"))
      .join(":");
  }, [secondsLeft]);

  const addAuditEvent = (event: Omit<AuditEvent, "id" | "time">) => {
    setAudit((events) => [
      {
        ...event,
        id: `evt-${Date.now()}`,
        time: new Date().toLocaleTimeString("en-GB", { hour12: false }),
      },
      ...events,
    ]);
  };

  const claimTestCollateral = () => {
    if (faucetUsed) return;
    setAvailableBalance((balance) => balance + 500_000);
    setFaucetUsed(true);
    setOrderMessage("500,000 tNPR issued to your simulated margin account.");
    setOrderError("");
    addAuditEvent({
      kind: "faucet",
      title: "Test collateral issued",
      detail: "500,000 tNPR · no monetary value · demo faucet",
    });
  };

  const placeOrder = () => {
    setOrderMessage("");
    setOrderError("");

    if (limitPrice < LOWER_BAND || limitPrice > UPPER_BAND) {
      setOrderError(
        `Rejected: limit price must remain inside ${formatNpr(LOWER_BAND, 2)}–${formatNpr(UPPER_BAND, 2)}.`,
      );
      return;
    }
    if (notional < 10_000) {
      setOrderError("Minimum demo notional is 10,000 tNPR.");
      return;
    }
    if (notional > availableBalance) {
      setOrderError("Insufficient available tNPR for 100% prefunded margin.");
      return;
    }
    if (notional > 180_000) {
      setOrderError(
        "Only 180,000 tNPR of opposing liquidity is available. Unmatched exposure is never created.",
      );
      return;
    }

    const position: Position = {
      id: `NPRX-${284 + positions.length}`,
      side,
      notional,
      entry: limitPrice,
      locked: notional,
      status: "open",
    };
    setPositions((items) => [position, ...items]);
    setAvailableBalance((balance) => balance - notional);
    setOrderMessage(
      `${side === "long" ? "Long" : "Short"} order matched in batch #${284 + positions.length}.`,
    );
    addAuditEvent({
      kind: "order",
      title: `${side === "long" ? "Long" : "Short"} position matched`,
      detail: `${formatNpr(notional)} tNPR · ${formatNpr(limitPrice, 2)} · fully collateralised`,
    });
  };

  const settlePosition = (positionId: string) => {
    const position = positions.find((item) => item.id === positionId);
    if (!position || position.status === "settled") return;

    const settlementPrice = 1_030;
    const direction = position.side === "long" ? 1 : -1;
    const realisedPnl =
      direction * position.notional * (settlementPrice / position.entry - 1);

    setPositions((items) =>
      items.map((item) =>
        item.id === positionId
          ? { ...item, status: "settled", settlementPrice, realisedPnl }
          : item,
      ),
    );
    setAvailableBalance(
      (balance) => balance + position.locked + realisedPnl,
    );
    setOrderMessage(
      `${position.id} settled at 1,030.00. ${realisedPnl >= 0 ? "+" : ""}${formatNpr(realisedPnl, 2)} tNPR realised.`,
    );
    addAuditEvent({
      kind: "settlement",
      title: `${position.id} settled atomically`,
      detail: `Close 1,030.00 · P&L ${realisedPnl >= 0 ? "+" : ""}${formatNpr(realisedPnl, 2)} tNPR`,
    });
  };

  const resetDemo = () => {
    setAvailableBalance(250_000);
    setPositions([]);
    setAudit(initialAudit);
    setFaucetUsed(false);
    setSide("long");
    setNotional(100_000);
    setLimitPrice(1_000);
    setOrderMessage("Demo reset. Start with the prefunded margin account.");
    setOrderError("");
  };

  const connectWallet = async () => {
    setWalletMessage("");
    const provider =
      window.phantom?.solana ?? window.solana ?? window.solflare ?? null;
    if (!provider) {
      setWalletMessage(
        "No compatible Solana wallet was found. The simulation still works; install Phantom or Solflare to create a Devnet receipt.",
      );
      return;
    }

    try {
      const response = await provider.connect();
      const address = response.publicKey.toString();
      setWalletProvider(provider);
      setWalletAddress(address);
      setWalletMessage("Wallet connected to the Devnet receipt flow.");
    } catch {
      setWalletMessage("Wallet connection was cancelled.");
    }
  };

  const anchorReceipt = async (positionId: string) => {
    const position = positions.find((item) => item.id === positionId);
    if (!position) return;
    if (!walletProvider || !walletAddress) {
      setWalletMessage("Connect a Solana wallet before creating a Devnet receipt.");
      return;
    }

    setIsAnchoring(true);
    setWalletMessage("Preparing a signed Solana Devnet commitment…");
    try {
      const [{ AnchorProvider, web3 }, { Buffer }] = await Promise.all([
        import("@coral-xyz/anchor/dist/browser/index.js"),
        import("buffer"),
      ]);
      (globalThis as unknown as { Buffer: typeof Buffer }).Buffer = Buffer;

      const publicKey = new web3.PublicKey(walletAddress);
      const anchorWallet = {
        publicKey,
        signTransaction: walletProvider.signTransaction.bind(walletProvider),
        signAllTransactions:
          walletProvider.signAllTransactions?.bind(walletProvider) ??
          (async <T,>(transactions: T[]) =>
            Promise.all(
              transactions.map((transaction) =>
                walletProvider.signTransaction(transaction),
              ),
            )),
      };
      const connection = new web3.Connection(
        web3.clusterApiUrl("devnet"),
        "confirmed",
      );
      const provider = new AnchorProvider(
        connection,
        anchorWallet as never,
        { commitment: "confirmed", preflightCommitment: "confirmed" },
      );
      const memo = Buffer.from(
        JSON.stringify({
          app: "NPRX Global",
          version: "MVP-0.1",
          action: "POSITION_COMMITMENT",
          market: "GEF-1D",
          position: position.id,
          side: position.side,
          notional_tnpr: position.notional,
          entry: position.entry,
          status: position.status,
          disclaimer: "TEST ONLY · NO MONETARY VALUE",
        }),
        "utf8",
      );
      const transaction = new web3.Transaction().add(
        new web3.TransactionInstruction({
          programId: new web3.PublicKey(MEMO_PROGRAM_ID),
          keys: [{ pubkey: publicKey, isSigner: true, isWritable: false }],
          data: memo,
        }),
      );
      const signature = await provider.sendAndConfirm(transaction, []);

      setPositions((items) =>
        items.map((item) =>
          item.id === positionId ? { ...item, signature } : item,
        ),
      );
      addAuditEvent({
        kind: "chain",
        title: "Devnet receipt confirmed",
        detail: `${position.id} · ${shortAddress(signature)} · Solana Memo Program`,
        signature,
      });
      setWalletMessage("Commitment confirmed on Solana Devnet.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown wallet error";
      setWalletMessage(
        message.toLowerCase().includes("insufficient")
          ? "The wallet needs a small amount of Devnet SOL to pay the network fee."
          : "The Devnet receipt was not completed. Your simulated position is unchanged.",
      );
    } finally {
      setIsAnchoring(false);
    }
  };

  return (
    <main className="app-shell">
      <div className="simulation-banner">
        <span className="live-dot" />
        Solana Devnet simulation
        <span className="banner-divider" />
        tNPR has no monetary value
        <span className="banner-divider" />
        No real deposits or foreign assets
      </div>

      <header className="topbar">
        <button className="brand" onClick={() => setView("trade")}>
          <span className="brand-mark">N</span>
          <span>
            <strong>NPRX</strong>
            <small>GLOBAL</small>
          </span>
        </button>

        <nav className="main-nav" aria-label="Primary navigation">
          <button
            className={view === "trade" ? "active" : ""}
            onClick={() => setView("trade")}
          >
            Trade
          </button>
          <button
            className={view === "oversight" ? "active" : ""}
            onClick={() => setView("oversight")}
          >
            Oversight
          </button>
          <button
            className={view === "architecture" ? "active" : ""}
            onClick={() => setView("architecture")}
          >
            How it works
          </button>
        </nav>

        <div className="header-actions">
          <span className="network-pill">
            <span className="network-dot" /> Devnet
          </span>
          <button className="wallet-button" onClick={connectWallet}>
            <Wallet size={16} />
            {walletAddress ? shortAddress(walletAddress) : "Connect wallet"}
          </button>
        </div>
      </header>

      {walletMessage && (
        <div className="wallet-message" role="status">
          <span>{walletMessage}</span>
          {!walletAddress && (
            <a
              href="https://faucet.solana.com/"
              target="_blank"
              rel="noreferrer"
            >
              Devnet faucet <ExternalLink size={13} />
            </a>
          )}
          <button onClick={() => setWalletMessage("")} aria-label="Dismiss message">
            <X size={15} />
          </button>
        </div>
      )}

      {view === "trade" && (
        <>
          <section className="intro-row">
            <div>
              <div className="eyebrow">
                <span>MARKET 01</span>
                <span className="status-badge">OPEN</span>
              </div>
              <h1>Global Equity Daily Future</h1>
              <p>
                Take a fully collateralised long or short view on a broad global
                equity benchmark—simulated and settled entirely in tNPR.
              </p>
            </div>
            <div className="guided-demo">
              <div className="guided-heading">
                <PlayCircle size={17} />
                <strong>Guided demo</strong>
                <span>{demoStep}/4</span>
              </div>
              <div className="step-track">
                {[1, 2, 3, 4].map((step) => (
                  <span
                    key={step}
                    className={step <= demoStep ? "complete" : ""}
                  />
                ))}
              </div>
              <p>
                {demoStep === 2 && "Place the prefilled 100,000 tNPR long order."}
                {demoStep === 3 && "Settle the open position at the +3% demo close."}
                {demoStep === 4 && "Connect a wallet and anchor the receipt on Devnet."}
              </p>
            </div>
          </section>

          <section className="dashboard-grid">
            <div className="left-column">
              <article className="market-card card">
                <div className="market-topline">
                  <div>
                    <div className="instrument-label">
                      <span className="instrument-mark">GX</span>
                      <div>
                        <strong>GEF-1D</strong>
                        <span>JUL 22 · DAILY</span>
                      </div>
                    </div>
                  </div>
                  <div className="market-price">
                    <span>INDICATIVE MARK</span>
                    <strong>{formatNpr(MARK_PRICE, 2)}</strong>
                    <em>+0.32%</em>
                  </div>
                </div>

                <div className="chart-wrap" aria-label="Intraday reference price chart">
                  <div className="chart-grid-lines" />
                  <div className="chart-fill" />
                  <div className="chart-line" />
                  <span className="opening-line">
                    <small>OPEN 1,000.00</small>
                  </span>
                  <span className="mark-label">1,003.20</span>
                  <div className="chart-axis">
                    <span>10:00</span><span>12:00</span><span>14:00</span><span>16:00</span>
                  </div>
                </div>

                <div className="market-stats">
                  <div>
                    <span>Opening reference</span>
                    <strong>1,000.00</strong>
                  </div>
                  <div>
                    <span>Execution band</span>
                    <strong>995.00–1,005.00</strong>
                  </div>
                  <div>
                    <span>Opposing liquidity</span>
                    <strong>180,000 tNPR</strong>
                  </div>
                  <div>
                    <span>Settlement in</span>
                    <strong className="mono"><Clock3 size={14} /> {formattedCountdown}</strong>
                  </div>
                </div>
              </article>

              <article className="positions-card card">
                <div className="card-heading">
                  <div>
                    <span className="section-kicker">YOUR BOOK</span>
                    <h2>Positions</h2>
                  </div>
                  <button className="quiet-button" onClick={resetDemo}>
                    <RotateCcw size={14} /> Reset demo
                  </button>
                </div>

                {positions.length === 0 ? (
                  <div className="empty-state">
                    <span><BarChart3 size={22} /></span>
                    <div>
                      <strong>No positions yet</strong>
                      <p>Your matched orders will appear here with settlement controls.</p>
                    </div>
                    <ChevronRight size={18} />
                  </div>
                ) : (
                  <div className="position-list">
                    {positions.map((position) => {
                      const direction = position.side === "long" ? 1 : -1;
                      const currentPnl =
                        position.status === "settled"
                          ? position.realisedPnl ?? 0
                          : direction *
                            position.notional *
                            (MARK_PRICE / position.entry - 1);
                      return (
                        <div className="position-row" key={position.id}>
                          <div className={`side-icon ${position.side}`}>
                            {position.side === "long" ? (
                              <TrendingUp size={18} />
                            ) : (
                              <TrendingDown size={18} />
                            )}
                          </div>
                          <div className="position-name">
                            <strong>{position.id}</strong>
                            <span>{position.side.toUpperCase()} · GEF-1D</span>
                          </div>
                          <div>
                            <span>Notional</span>
                            <strong>{formatNpr(position.notional)} tNPR</strong>
                          </div>
                          <div>
                            <span>{position.status === "settled" ? "Realised" : "Unrealised"}</span>
                            <strong className={currentPnl >= 0 ? "positive" : "negative"}>
                              {currentPnl >= 0 ? "+" : ""}{formatNpr(currentPnl, 2)}
                            </strong>
                          </div>
                          <div className="position-actions">
                            {position.status === "open" ? (
                              <button
                                className="settle-button"
                                onClick={() => settlePosition(position.id)}
                              >
                                Settle at +3%
                              </button>
                            ) : (
                              <span className="settled-pill"><Check size={13} /> Settled</span>
                            )}
                            {position.signature ? (
                              <a
                                className="receipt-link"
                                href={`https://explorer.solana.com/tx/${position.signature}?cluster=devnet`}
                                target="_blank"
                                rel="noreferrer"
                              >
                                View receipt <ExternalLink size={13} />
                              </a>
                            ) : (
                              <button
                                className="receipt-link"
                                onClick={() => anchorReceipt(position.id)}
                                disabled={isAnchoring}
                              >
                                <Link2 size={13} />
                                {isAnchoring ? "Anchoring…" : "Anchor receipt"}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </article>
            </div>

            <aside className="right-column">
              <article className="balance-card card">
                <div className="balance-heading">
                  <div>
                    <span>SIMULATED MARGIN</span>
                    <strong>{formatNpr(totalBalance, 2)} <small>tNPR</small></strong>
                  </div>
                  <span className="verified-chip"><ShieldCheck size={14} /> Verified demo</span>
                </div>
                <div className="balance-breakdown">
                  <div><span>Available</span><strong>{formatNpr(availableBalance)}</strong></div>
                  <div><span>Locked</span><strong>{formatNpr(lockedCollateral)}</strong></div>
                  <div><span>Unrealised P&L</span><strong className={unrealisedPnl >= 0 ? "positive" : "negative"}>{unrealisedPnl >= 0 ? "+" : ""}{formatNpr(unrealisedPnl, 2)}</strong></div>
                </div>
                <button
                  className="faucet-button"
                  onClick={claimTestCollateral}
                  disabled={faucetUsed}
                >
                  <Droplets size={15} />
                  {faucetUsed ? "Test allowance claimed" : "Claim 500,000 test tNPR"}
                </button>
              </article>

              <article className="order-card card">
                <div className="card-heading compact">
                  <div>
                    <span className="section-kicker">BATCH #284</span>
                    <h2>Order ticket</h2>
                  </div>
                  <span className="auction-time"><Clock3 size={13} /> 02:18</span>
                </div>

                <div className="side-toggle">
                  <button
                    className={side === "long" ? "active long" : ""}
                    onClick={() => setSide("long")}
                  >
                    <TrendingUp size={16} /> Long
                  </button>
                  <button
                    className={side === "short" ? "active short" : ""}
                    onClick={() => setSide("short")}
                  >
                    <TrendingDown size={16} /> Short
                  </button>
                </div>

                <label className="field-label" htmlFor="notional">
                  <span>Notional</span><small>tNPR</small>
                </label>
                <div className="amount-input">
                  <input
                    id="notional"
                    type="number"
                    min={10_000}
                    step={10_000}
                    value={notional}
                    onChange={(event) => setNotional(Number(event.target.value))}
                  />
                  <span>tNPR</span>
                </div>
                <div className="amount-presets">
                  {[50_000, 100_000, 180_000].map((amount) => (
                    <button key={amount} onClick={() => setNotional(amount)}>
                      {amount / 1_000}k
                    </button>
                  ))}
                </div>

                <label className="field-label" htmlFor="limit-price">
                  <span>Limit price</span><small>band 995–1,005</small>
                </label>
                <div className="amount-input">
                  <input
                    id="limit-price"
                    type="number"
                    min={LOWER_BAND}
                    max={UPPER_BAND}
                    step={0.1}
                    value={limitPrice}
                    onChange={(event) => setLimitPrice(Number(event.target.value))}
                  />
                  <span>INDEX</span>
                </div>

                <div className="order-summary">
                  <div><span>Required margin</span><strong>{formatNpr(notional)} tNPR</strong></div>
                  <div><span>Leverage</span><strong>1.00×</strong></div>
                  <div><span>Estimated fee</span><strong>{formatNpr(notional * 0.0015)} tNPR</strong></div>
                </div>

                {orderError && <div className="inline-alert error"><TriangleAlert size={15} />{orderError}</div>}
                {orderMessage && <div className="inline-alert success"><CheckCircle2 size={15} />{orderMessage}</div>}

                <button className={`submit-order ${side}`} onClick={placeOrder}>
                  Place {side} order <ArrowUpRight size={17} />
                </button>
                <p className="order-note">
                  Orders are matched in five-minute batches. No match means no position.
                </p>
              </article>
            </aside>
          </section>

          <section className="safety-strip">
            <div><ShieldCheck size={19} /><span><strong>Verified access</strong>KYC hash only, no identity data on-chain</span></div>
            <div><Scale size={19} /><span><strong>Balanced exposure</strong>Every long has a funded short</span></div>
            <div><Gauge size={19} /><span><strong>Hard risk limits</strong>1× leverage and ±0.5% execution band</span></div>
            <div><Database size={19} /><span><strong>Auditable receipts</strong>Optional commitments on Solana Devnet</span></div>
          </section>
        </>
      )}

      {view === "oversight" && (
        <section className="oversight-view">
          <div className="oversight-hero">
            <div>
              <div className="eyebrow"><span>SUPERVISORY CONSOLE</span><span className="status-badge">LIVE DEMO</span></div>
              <h1>Market oversight in real time.</h1>
              <p>One shared view of collateral, exposure, pricing, and every administrative action.</p>
            </div>
            <div className="oversight-actions">
              <span><Eye size={15} /> Read-only regulator view</span>
              <button onClick={() => setView("trade")}>Return to market</button>
            </div>
          </div>

          <div className="metric-grid">
            <article className="metric-card"><span>Total test supply</span><strong>10.75m</strong><small>tNPR · faucet controlled</small><Droplets size={18} /></article>
            <article className="metric-card"><span>Matched open interest</span><strong>{formatNpr(balancedOpenInterest / 1_000_000, 2)}m</strong><small>long = short</small><Scale size={18} /></article>
            <article className="metric-card"><span>Collateral coverage</span><strong>100.0%</strong><small>fully prefunded</small><ShieldCheck size={18} /></article>
            <article className="metric-card"><span>Oracle status</span><strong className="healthy">Healthy</strong><small>age 8s · mock source</small><Activity size={18} /></article>
          </div>

          <div className="oversight-grid">
            <article className="exposure-panel card">
              <div className="card-heading">
                <div><span className="section-kicker">SYSTEM EXPOSURE</span><h2>Balanced by construction</h2></div>
                <span className="verified-chip"><CheckCircle2 size={14} /> Invariant holds</span>
              </div>
              <div className="exposure-total">
                <div><span>Long open interest</span><strong>{formatNpr(balancedOpenInterest)} tNPR</strong></div>
                <div className="equals-mark">=</div>
                <div className="align-right"><span>Short open interest</span><strong>{formatNpr(balancedOpenInterest)} tNPR</strong></div>
              </div>
              <div className="exposure-bar"><span style={{ width: "50%" }} /><span style={{ width: "50%" }} /></div>
              <div className="exposure-legend"><span><i className="long-color" />Customer longs 81.3%</span><span><i className="short-color" />Customer shorts 12.2%</span><span><i className="maker-color" />Market maker 6.5%</span></div>
              <div className="risk-table">
                <div><span>Market-maker inventory</span><strong>{formatNpr(makerInventory)} / 1,500,000 tNPR</strong><em>{Math.round((makerInventory / 1_500_000) * 100)}%</em></div>
                <div><span>Market open-interest cap</span><strong>{formatNpr(balancedOpenInterest)} / 10,000,000 tNPR</strong><em>{Math.round((balancedOpenInterest / 10_000_000) * 100)}%</em></div>
                <div><span>Largest participant</span><strong>620,000 / 750,000 tNPR</strong><em>83%</em></div>
              </div>
            </article>

            <article className="controls-panel card">
              <div className="card-heading"><div><span className="section-kicker">CONTROL STATUS</span><h2>Safeguards</h2></div></div>
              <div className="control-list">
                <div><span className="control-icon"><LockKeyhole size={16} /></span><span><strong>Compliance gating</strong><small>Verified wallets only</small></span><em>ON</em></div>
                <div><span className="control-icon"><Gauge size={16} /></span><span><strong>Price band</strong><small>±0.50% from reference</small></span><em>ON</em></div>
                <div><span className="control-icon"><Activity size={16} /></span><span><strong>Oracle staleness</strong><small>Reject after 60 seconds</small></span><em>ON</em></div>
                <div><span className="control-icon"><Scale size={16} /></span><span><strong>Exposure invariant</strong><small>Matched positions only</small></span><em>ON</em></div>
              </div>
              <button className="pause-button" disabled><TriangleAlert size={15} /> Emergency pause · regulator multisig</button>
            </article>

            <article className="audit-panel card">
              <div className="card-heading">
                <div><span className="section-kicker">AUDIT STREAM</span><h2>Latest activity</h2></div>
                <span className="audit-live"><span /> streaming</span>
              </div>
              <div className="audit-list">
                {audit.map((event) => (
                  <div className="audit-row" key={event.id}>
                    <span className={`audit-icon ${event.kind}`}>{eventIcon(event.kind)}</span>
                    <div><strong>{event.title}</strong><span>{event.detail}</span></div>
                    <time>{event.time}</time>
                    {event.signature && <a href={`https://explorer.solana.com/tx/${event.signature}?cluster=devnet`} target="_blank" rel="noreferrer" aria-label="Open receipt in Solana Explorer"><ExternalLink size={14} /></a>}
                  </div>
                ))}
              </div>
            </article>
          </div>
        </section>
      )}

      {view === "architecture" && (
        <section className="architecture-view">
          <div className="architecture-hero">
            <span className="section-kicker">WHY NPRX GLOBAL</span>
            <h1>Global reference. Local risk. Public proof.</h1>
            <p>
              A regulatory-first market design that gives approved Nepali participants a
              transparent way to simulate global benchmark exposure without receiving foreign
              currency or owning a foreign security.
            </p>
          </div>

          <div className="flow-card card">
            <div className="flow-node"><span><ShieldCheck size={21} /></span><strong>1. Verify</strong><small>Signed compliance attestation; no personal data on-chain</small></div>
            <ChevronRight size={20} />
            <div className="flow-node"><span><CircleDollarSign size={21} /></span><strong>2. Prefund</strong><small>Test tNPR in a closed-loop simulated margin account</small></div>
            <ChevronRight size={20} />
            <div className="flow-node"><span><Scale size={21} /></span><strong>3. Match</strong><small>Five-minute batch auction; long exposure equals short</small></div>
            <ChevronRight size={20} />
            <div className="flow-node"><span><Zap size={21} /></span><strong>4. Settle</strong><small>Deterministic tNPR P&L with optional Devnet receipt</small></div>
          </div>

          <div className="principle-grid">
            <article><span>01</span><h2>No hidden counterparty</h2><p>Orders execute only when an opposing participant or capped market maker can fund the other side.</p></article>
            <article><span>02</span><h2>No private currency claim</h2><p>tNPR is a non-redeemable test unit. A regulated pilot would prefer internal margin balances.</p></article>
            <article><span>03</span><h2>No black-box pricing</h2><p>The external reference sets the mark. A hard execution band and daily expiry limit local distortion.</p></article>
          </div>

          <div className="scope-panel">
            <div>
              <span className="section-kicker">WHAT THIS MVP PROVES</span>
              <h2>A credible technical and economic demonstration.</h2>
            </div>
            <div className="scope-columns">
              <div><strong><CheckCircle2 size={17} />Included now</strong><ul><li>One daily quanto-style market</li><li>Prefunded test collateral</li><li>Batch matching and position limits</li><li>Deterministic settlement</li><li>Regulator audit dashboard</li><li>Solana Devnet commitments</li></ul></div>
              <div className="future"><strong><Clock3 size={17} />Requires a regulated pilot</strong><ul><li>Real NPR or bank integrations</li><li>Production KYC operations</li><li>Licensed benchmark data</li><li>Live market-making</li><li>Withdrawals or redemption</li><li>Offshore risk hedging</li></ul></div>
            </div>
          </div>
        </section>
      )}

      <footer>
        <div className="footer-brand"><span className="brand-mark small">N</span><span><strong>NPRX Global</strong><small>Infrastructure for transparent local markets</small></span></div>
        <p>Technical simulation only. Not an offer, exchange, investment product, or legal opinion.</p>
        <span>Built on Solana Devnet · MVP 0.1</span>
      </footer>
    </main>
  );
}

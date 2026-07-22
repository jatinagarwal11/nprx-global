"use client";

import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  BarChart3,
  BriefcaseBusiness,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  CircleDollarSign,
  Clock3,
  Database,
  ExternalLink,
  Fuel,
  Globe2,
  Landmark,
  Link2,
  LockKeyhole,
  LogIn,
  LogOut,
  Plus,
  Radio,
  RefreshCw,
  Scale,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
  X,
  Zap,
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

const MEMO_PROGRAM_ID = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr";
const DEMO_PASSWORD = "hedge123";

type View = "markets" | "orders" | "portfolio" | "oversight";
type Side = "long" | "short";
type MarketId = "wti" | "brent" | "usdnpr";

type MarketPoint = { value: number; time: number };
type Market = {
  id: MarketId;
  symbol: string;
  name: string;
  shortName: string;
  unit: string;
  hedgeUse: string;
  price: number;
  previousClose: number;
  change: number;
  changePct: number;
  updatedAt: string;
  marketState: string;
  points: MarketPoint[];
  provider: string;
  isFallback: boolean;
};

type NrbReference = {
  date?: string;
  buy: number;
  sell: number;
  mid: number;
  provider: string;
};

type DemoAccount = {
  id: string;
  email: string;
  display_name: string;
  company: string;
  role: string;
  hedge_story: string;
  available_balance: number;
};

type DemoOrder = {
  id: string;
  user_id: string;
  market_id: MarketId;
  side: Side;
  notional: number;
  posted_price: number;
  status: string;
  counterparty_id?: string | null;
  match_price?: number | null;
  created_at: string;
  matched_at?: string | null;
};

type DemoPosition = {
  id: string;
  match_id: string;
  user_id: string;
  counterparty_id: string;
  market_id: MarketId;
  side: Side;
  notional: number;
  entry_price: number;
  status: string;
  created_at: string;
  signature?: string | null;
};

type DemoDeposit = {
  id: string;
  user_id: string;
  amount: number;
  reference: string;
  rail: string;
  created_at: string;
};

type DemoAudit = {
  id: string;
  kind: string;
  actor_id?: string | null;
  title: string;
  detail: string;
  created_at: string;
};

type DemoState = {
  accounts: DemoAccount[];
  orders: DemoOrder[];
  positions: DemoPosition[];
  deposits: DemoDeposit[];
  audit: DemoAudit[];
};

type BrowserWallet = {
  publicKey?: { toString: () => string };
  isConnected?: boolean;
  connect: () => Promise<{ publicKey: { toString: () => string } }>;
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

const fallbackMarkets: Market[] = [
  {
    id: "wti",
    symbol: "CL=F",
    name: "WTI Crude Oil",
    shortName: "WTI",
    unit: "USD / barrel",
    hedgeUse: "Fuel, transport and energy-input costs",
    price: 87.5,
    previousClose: 84.34,
    change: 3.16,
    changePct: 3.75,
    updatedAt: new Date().toISOString(),
    marketState: "LOADING",
    points: [84.34, 85.2, 86.4, 85.9, 87.5].map((value, index) => ({
      value,
      time: Date.now() / 1000 - (4 - index) * 300,
    })),
    provider: "Loading indicative quote",
    isFallback: true,
  },
  {
    id: "brent",
    symbol: "BZ=F",
    name: "Brent Crude Oil",
    shortName: "BRENT",
    unit: "USD / barrel",
    hedgeUse: "Imported petroleum and global freight exposure",
    price: 94.18,
    previousClose: 91.01,
    change: 3.17,
    changePct: 3.48,
    updatedAt: new Date().toISOString(),
    marketState: "LOADING",
    points: [91.01, 91.7, 92.9, 93.5, 94.18].map((value, index) => ({
      value,
      time: Date.now() / 1000 - (4 - index) * 300,
    })),
    provider: "Loading indicative quote",
    isFallback: true,
  },
  {
    id: "usdnpr",
    symbol: "NPR=X",
    name: "USD / NPR",
    shortName: "USD/NPR",
    unit: "NPR per USD",
    hedgeUse: "Dollar invoices, imports and currency budgets",
    price: 154.242,
    previousClose: 153.983,
    change: 0.259,
    changePct: 0.17,
    updatedAt: new Date().toISOString(),
    marketState: "LOADING",
    points: [153.98, 154.04, 154.11, 154.08, 154.242].map((value, index) => ({
      value,
      time: Date.now() / 1000 - (4 - index) * 300,
    })),
    provider: "Loading indicative quote",
    isFallback: true,
  },
];

const emptyDemo: DemoState = {
  accounts: [],
  orders: [],
  positions: [],
  deposits: [],
  audit: [],
};

const fmt = (amount: number, digits = 0) =>
  new Intl.NumberFormat("en-NP", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(amount);

const shortAddress = (address: string) => `${address.slice(0, 4)}...${address.slice(-4)}`;

const timeAgo = (timestamp: string) => {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
};

const marketIcon = (id: MarketId) =>
  id === "usdnpr" ? <Globe2 size={19} /> : <Fuel size={19} />;

const opposite = (side: Side): Side => (side === "long" ? "short" : "long");

function SparkBars({ points, positive }: { points: MarketPoint[]; positive: boolean }) {
  const values = points.length ? points.map((point) => point.value) : [0];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, 0.0001);
  return (
    <div className={`spark-bars ${positive ? "up" : "down"}`} aria-hidden="true">
      {values.slice(-18).map((value, index) => (
        <span key={index} style={{ height: `${24 + ((value - min) / range) * 70}%` }} />
      ))}
    </div>
  );
}

function LoginScreen({ onLogin }: { onLogin: (id: string) => void }) {
  const [email, setEmail] = useState("asha@himalagro.demo");
  const [password, setPassword] = useState(DEMO_PASSWORD);
  const [error, setError] = useState("");

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const normalized = email.trim().toLowerCase();
    const id = normalized === "asha@himalagro.demo" ? "person1" : normalized === "bikash@suryasolar.demo" ? "person2" : null;
    if (!id || password !== DEMO_PASSWORD) {
      setError("Use one of the demo emails and the password hedge123.");
      return;
    }
    onLogin(id);
  };

  return (
    <main className="login-shell">
      <section className="login-story">
        <div className="login-brand"><span className="brand-mark">N</span><span><strong>NPRX</strong><small>GLOBAL</small></span></div>
        <div className="story-copy">
          <span className="eyebrow">PARTICIPANT-TO-PARTICIPANT HEDGING</span>
          <h1>Hedge the costs your business cannot control.</h1>
          <p>Track oil and USD/NPR, post a hedge request, and match directly with another Nepali business in a fully collateralised sandbox.</p>
        </div>
        <div className="story-points">
          <span><Radio size={17} /><strong>Live references</strong><small>WTI, Brent and USD/NPR</small></span>
          <span><Users size={17} /><strong>Real counterparties</strong><small>No platform inventory</small></span>
          <span><Link2 size={17} /><strong>Public proof</strong><small>Optional Solana Devnet receipts</small></span>
        </div>
      </section>

      <section className="login-panel">
        <form className="login-card" onSubmit={submit}>
          <span className="secure-chip"><LockKeyhole size={13} /> DEMO AUTHENTICATION</span>
          <h2>Welcome back</h2>
          <p>Choose a prepared business persona or enter its demo credentials.</p>

          <button type="button" className="persona-button" onClick={() => onLogin("person1")}>
            <span className="avatar">AS</span><span><strong>Asha Shrestha</strong><small>Himal Agro Imports · oil importer</small></span><ArrowRight size={17} />
          </button>
          <button type="button" className="persona-button" onClick={() => onLogin("person2")}>
            <span className="avatar solar">BK</span><span><strong>Bikash Karki</strong><small>Surya Solar Nepal · solar operator</small></span><ArrowRight size={17} />
          </button>

          <div className="or-divider"><span>or sign in manually</span></div>
          <label className="login-label">Email<input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="username" /></label>
          <label className="login-label">Password<input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" /></label>
          {error && <div className="form-error"><CircleAlert size={15} />{error}</div>}
          <button className="primary-button login-submit" type="submit"><LogIn size={17} /> Log in to demo</button>
          <div className="credentials"><span>Person 1: <strong>asha@himalagro.demo</strong></span><span>Person 2: <strong>bikash@suryasolar.demo</strong></span><span>Password: <strong>hedge123</strong></span></div>
          <p className="demo-note"><ShieldCheck size={14} /> This is a demo persona selector, not production authentication. No real personal data is collected.</p>
        </form>
      </section>
    </main>
  );
}

export default function Home() {
  const [view, setView] = useState<View>("markets");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [demo, setDemo] = useState<DemoState>(emptyDemo);
  const [markets, setMarkets] = useState<Market[]>(fallbackMarkets);
  const [nrbReference, setNrbReference] = useState<NrbReference | null>(null);
  const [activeMarketId, setActiveMarketId] = useState<MarketId>("wti");
  const [side, setSide] = useState<Side>("long");
  const [notional, setNotional] = useState(10_000);
  const [loadingState, setLoadingState] = useState(true);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [depositOpen, setDepositOpen] = useState(false);
  const [depositStep, setDepositStep] = useState<"form" | "confirm" | "success">("form");
  const [depositAmount, setDepositAmount] = useState(100_000);
  const [depositReference, setDepositReference] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [walletProvider, setWalletProvider] = useState<BrowserWallet | null>(null);
  const [walletMessage, setWalletMessage] = useState("");
  const [receipts, setReceipts] = useState<Record<string, string>>({});

  const fetchDemo = useCallback(async (quiet = false) => {
    try {
      const response = await fetch("/api/demo", { cache: "no-store" });
      const payload = (await response.json()) as DemoState & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Shared demo state is unavailable");
      setDemo(payload);
      setError("");
    } catch (cause) {
      if (!quiet) setError(cause instanceof Error ? cause.message : "Could not load the shared demo");
    } finally {
      if (!quiet) setLoadingState(false);
    }
  }, []);

  const fetchMarkets = useCallback(async () => {
    try {
      const response = await fetch("/api/markets", { cache: "no-store" });
      if (!response.ok) throw new Error("Market feed unavailable");
      const payload = (await response.json()) as { markets: Market[]; nrbReference: NrbReference | null };
      if (payload.markets?.length) setMarkets(payload.markets);
      setNrbReference(payload.nrbReference ?? null);
    } catch {
      // Clearly labelled fallbacks remain visible while the provider recovers.
    }
  }, []);

  useEffect(() => {
    const savedUser = window.sessionStorage.getItem("nprx-demo-user");
    if (savedUser === "person1" || savedUser === "person2") setCurrentUserId(savedUser);
    fetchDemo();
    fetchMarkets();
    const stateTimer = window.setInterval(() => fetchDemo(true), 8_000);
    const marketTimer = window.setInterval(fetchMarkets, 30_000);
    return () => {
      window.clearInterval(stateTimer);
      window.clearInterval(marketTimer);
    };
  }, [fetchDemo, fetchMarkets]);

  const currentAccount = demo.accounts.find((account) => account.id === currentUserId);
  const activeMarket = markets.find((market) => market.id === activeMarketId) ?? markets[0];
  const accountById = (id: string) => demo.accounts.find((account) => account.id === id);
  const userPositions = demo.positions.filter((position) => position.user_id === currentUserId);
  const userOrders = demo.orders.filter((order) => order.user_id === currentUserId);
  const lockedNotional = [...userPositions, ...userOrders].reduce((sum, item) => sum + item.notional, 0);

  const positionPnl = useCallback((position: DemoPosition) => {
    const mark = markets.find((market) => market.id === position.market_id)?.price ?? position.entry_price;
    const direction = position.side === "long" ? 1 : -1;
    return direction * position.notional * (mark / position.entry_price - 1);
  }, [markets]);

  const unrealisedPnl = userPositions.reduce((sum, position) => sum + positionPnl(position), 0);
  const equity = (currentAccount?.available_balance ?? 0) + lockedNotional + unrealisedPnl;
  const totalLong = demo.positions.filter((position) => position.side === "long").reduce((sum, position) => sum + position.notional, 0);
  const totalShort = demo.positions.filter((position) => position.side === "short").reduce((sum, position) => sum + position.notional, 0);
  const matchedOpenInterest = Math.min(totalLong, totalShort);

  const login = (id: string) => {
    window.sessionStorage.setItem("nprx-demo-user", id);
    setCurrentUserId(id);
    setSide(id === "person1" ? "long" : "short");
    setView("markets");
    setError("");
    if (!window.sessionStorage.getItem(`nprx-deposit-seen-${id}`)) {
      setDepositStep("form");
      setDepositOpen(true);
    }
  };

  const logout = () => {
    window.sessionStorage.removeItem("nprx-demo-user");
    setCurrentUserId(null);
    setDepositOpen(false);
    setNotice("");
  };

  const postAction = async (payload: Record<string, unknown>, label: string) => {
    if (!currentUserId) return null;
    setBusy(label);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, userId: currentUserId }),
      });
      const result = (await response.json()) as { error?: string; state?: DemoState; reference?: string };
      if (!response.ok) throw new Error(result.error ?? "Demo action failed");
      if (result.state) setDemo(result.state);
      return result;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Demo action failed");
      return null;
    } finally {
      setBusy("");
    }
  };

  const placeOrder = async () => {
    const result = await postAction({
      action: "place_order",
      marketId: activeMarket.id,
      side,
      notional,
      postedPrice: activeMarket.price,
    }, "place-order");
    if (result) {
      setNotice(`${side === "long" ? "Long" : "Short"} ${activeMarket.shortName} request posted. It is waiting for another participant.`);
      setView("orders");
    }
  };

  const takeOrder = async (order: DemoOrder) => {
    const market = markets.find((item) => item.id === order.market_id);
    const matchPrice = market?.price ?? order.posted_price;
    const result = await postAction({ action: "take_order", orderId: order.id, matchPrice }, `take-${order.id}`);
    if (result) {
      setNotice(`Matched at ${fmt(matchPrice, order.market_id === "usdnpr" ? 3 : 2)}. Your unrealised P&L starts at 0.00 tNPR.`);
      setView("portfolio");
    }
  };

  const cancelOrder = async (order: DemoOrder) => {
    const result = await postAction({ action: "cancel_order", orderId: order.id }, `cancel-${order.id}`);
    if (result) setNotice(`${fmt(order.notional)} tNPR margin released.`);
  };

  const submitDeposit = async () => {
    const result = await postAction({ action: "deposit", amount: depositAmount }, "deposit");
    if (result?.reference) {
      setDepositReference(result.reference);
      setDepositStep("success");
    }
  };

  const closeDeposit = () => {
    if (currentUserId) window.sessionStorage.setItem(`nprx-deposit-seen-${currentUserId}`, "yes");
    setDepositOpen(false);
    setDepositStep("form");
  };

  const connectWallet = async () => {
    setWalletMessage("");
    const provider = window.phantom?.solana ?? window.solana ?? window.solflare ?? null;
    if (!provider) {
      setWalletMessage("No compatible wallet found. Install Phantom or Solflare only if you want a Devnet receipt.");
      return;
    }
    try {
      const response = await provider.connect();
      setWalletProvider(provider);
      setWalletAddress(response.publicKey.toString());
      setWalletMessage("Wallet connected for optional Solana Devnet receipts.");
    } catch {
      setWalletMessage("Wallet connection was cancelled.");
    }
  };

  const anchorReceipt = async (position: DemoPosition) => {
    if (!walletProvider || !walletAddress) {
      setWalletMessage("Connect a Solana wallet before creating a Devnet receipt.");
      return;
    }
    setBusy(`anchor-${position.id}`);
    setWalletMessage("Preparing your Solana Devnet receipt...");
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
        signAllTransactions: walletProvider.signAllTransactions?.bind(walletProvider) ?? (async <T,>(transactions: T[]) => Promise.all(transactions.map((transaction) => walletProvider.signTransaction(transaction)))),
      };
      const provider = new AnchorProvider(new web3.Connection(web3.clusterApiUrl("devnet"), "confirmed"), anchorWallet as never, { commitment: "confirmed", preflightCommitment: "confirmed" });
      const memo = Buffer.from(JSON.stringify({
        app: "NPRX Global",
        action: "HEDGE_MATCH_RECEIPT",
        match: position.match_id,
        market: position.market_id,
        participant: currentUserId,
        side: position.side,
        notional_tnpr: position.notional,
        entry: position.entry_price,
        disclaimer: "TEST ONLY - NO MONETARY VALUE",
      }), "utf8");
      const transaction = new web3.Transaction().add(new web3.TransactionInstruction({
        programId: new web3.PublicKey(MEMO_PROGRAM_ID),
        keys: [{ pubkey: publicKey, isSigner: true, isWritable: false }],
        data: memo,
      }));
      const signature = await provider.sendAndConfirm(transaction, []);
      setReceipts((items) => ({ ...items, [position.id]: signature }));
      setWalletMessage("Receipt confirmed on Solana Devnet.");
    } catch {
      setWalletMessage("The receipt was not completed. The simulated hedge is unchanged.");
    } finally {
      setBusy("");
    }
  };

  if (!currentUserId) return <LoginScreen onLogin={login} />;

  const marketCards = (
    <section className="market-strip" aria-label="Available hedge markets">
      {markets.map((market) => {
        const positive = market.change >= 0;
        return (
          <button key={market.id} className={`market-tile ${activeMarketId === market.id ? "selected" : ""}`} onClick={() => { setActiveMarketId(market.id); setView("markets"); }}>
            <div className="tile-top"><span className="market-icon">{marketIcon(market.id)}</span><span className={`quote-state ${market.isFallback ? "fallback" : ""}`}><i />{market.isFallback ? "Fallback" : "Feed"}</span></div>
            <span className="ticker">{market.shortName}</span>
            <strong className="tile-price">{fmt(market.price, market.id === "usdnpr" ? 3 : 2)}</strong>
            <span className={`market-change ${positive ? "positive" : "negative"}`}>{positive ? "+" : ""}{fmt(market.change, 3)} · {positive ? "+" : ""}{fmt(market.changePct, 2)}%</span>
            <SparkBars points={market.points} positive={positive} />
            <small>{market.unit}</small>
          </button>
        );
      })}
    </section>
  );

  const orderBook = (
    <article className="card orderbook-card">
      <div className="card-heading">
        <div><span className="section-kicker">SHARED ORDER BOOK</span><h2>Waiting for a counterparty</h2></div>
        <span className="polling"><RefreshCw size={13} /> refreshes every 8s</span>
      </div>
      <p className="card-intro">Every open request is visible to both demo participants. A match creates equal and opposite positions—NPRX never takes a side.</p>
      <div className="order-list">
        {demo.orders.length === 0 && <div className="empty-state"><Users size={22} /><div><strong>No open requests</strong><p>Post a hedge request to invite the other participant.</p></div></div>}
        {demo.orders.map((order) => {
          const owner = accountById(order.user_id);
          const market = markets.find((item) => item.id === order.market_id);
          const own = order.user_id === currentUserId;
          return (
            <div className="order-row" key={order.id}>
              <div className={`order-side ${order.side}`}><span>{order.side === "long" ? <TrendingUp size={18} /> : <TrendingDown size={18} />}</span><strong>{order.side.toUpperCase()}</strong></div>
              <div className="order-main"><div><strong>{owner?.company ?? order.user_id}</strong>{own && <em>Your request</em>}</div><span>{owner?.display_name} wants {order.side} {market?.shortName} exposure</span><small><Clock3 size={12} /> {timeAgo(order.created_at)} · posted near {fmt(order.posted_price, order.market_id === "usdnpr" ? 3 : 2)}</small></div>
              <div className="order-value"><span>NOTIONAL</span><strong>{fmt(order.notional)} <small>tNPR</small></strong></div>
              <div className="order-action">
                {own ? (
                  <button className="secondary-button" disabled={busy === `cancel-${order.id}`} onClick={() => cancelOrder(order)}>{busy === `cancel-${order.id}` ? "Cancelling..." : "Cancel"}</button>
                ) : (
                  <button className={`take-button ${opposite(order.side)}`} disabled={busy === `take-${order.id}`} onClick={() => takeOrder(order)}>{busy === `take-${order.id}` ? "Matching..." : `Take ${opposite(order.side)}`}<ArrowRight size={15} /></button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </article>
  );

  return (
    <main className="app-shell">
      <div className="simulation-banner"><span className="live-dot" /> SANDBOX DEMO <span /> tNPR has no monetary value <span /> Indicative / delayed market quotes <span /> No real deposits</div>
      <header className="topbar">
        <button className="brand" onClick={() => setView("markets")}><span className="brand-mark">N</span><span><strong>NPRX</strong><small>GLOBAL</small></span></button>
        <nav className="main-nav" aria-label="Primary navigation">
          <button className={view === "markets" ? "active" : ""} onClick={() => setView("markets")}>Markets</button>
          <button className={view === "orders" ? "active" : ""} onClick={() => setView("orders")}>Order book {demo.orders.length > 0 && <b>{demo.orders.length}</b>}</button>
          <button className={view === "portfolio" ? "active" : ""} onClick={() => setView("portfolio")}>Portfolio</button>
          <button className={view === "oversight" ? "active" : ""} onClick={() => setView("oversight")}>Oversight</button>
        </nav>
        <div className="header-actions">
          <span className="feed-pill"><i /> INDICATIVE FEEDS</span>
          <button className="fund-button" onClick={() => { setDepositStep("form"); setDepositOpen(true); }}><Plus size={14} /> Add test funds</button>
          <div className="user-chip"><span className="avatar mini">{currentAccount?.display_name.split(" ").map((part) => part[0]).join("") ?? "D"}</span><span><strong>{currentAccount?.display_name ?? "Demo user"}</strong><small>{currentAccount?.company}</small></span><ChevronDown size={14} /></div>
          <button className="icon-button" onClick={logout} title="Switch demo account"><LogOut size={16} /></button>
        </div>
      </header>

      {(error || notice || walletMessage) && (
        <div className={`status-message ${error ? "error" : "success"}`} role="status">
          {error ? <CircleAlert size={16} /> : <CheckCircle2 size={16} />}<span>{error || notice || walletMessage}</span>
          {walletMessage && !walletAddress && <a href="https://phantom.app/" target="_blank" rel="noreferrer">Wallet info <ExternalLink size={12} /></a>}
          <button onClick={() => { setError(""); setNotice(""); setWalletMessage(""); }} aria-label="Dismiss"><X size={15} /></button>
        </div>
      )}

      <div className="workspace">
        {loadingState && demo.accounts.length === 0 ? <div className="loading-card"><RefreshCw size={22} className="spin" /> Loading shared demo accounts...</div> : (
          <>
            {view === "markets" && (
              <>
                <section className="page-heading">
                  <div><span className="eyebrow">LIVE HEDGE REFERENCES</span><h1>Turn volatile costs into a budget.</h1><p>Choose the exposure your business faces, then request a fully collateralised hedge from another participant.</p></div>
                  <div className="persona-story"><span className="avatar large">{currentAccount?.display_name.split(" ").map((part) => part[0]).join("")}</span><div><small>YOUR DEMO SCENARIO</small><strong>{currentAccount?.company}</strong><p>{currentAccount?.hedge_story}</p></div></div>
                </section>
                {marketCards}

                <section className="trade-grid">
                  <article className="card market-detail">
                    <div className="detail-heading"><div className="instrument-title"><span className="market-icon large">{marketIcon(activeMarket.id)}</span><div><span>{activeMarket.symbol}</span><h2>{activeMarket.name}</h2><p>{activeMarket.hedgeUse}</p></div></div><div className="big-quote"><span>INDICATIVE MARK</span><strong>{fmt(activeMarket.price, activeMarket.id === "usdnpr" ? 3 : 2)}</strong><small>{activeMarket.unit}</small></div></div>
                    <div className="large-chart"><SparkBars points={activeMarket.points} positive={activeMarket.change >= 0} /><div className="chart-baseline" /></div>
                    <div className="source-row"><span><Radio size={14} /> {activeMarket.provider}</span><span>Updated {timeAgo(activeMarket.updatedAt)}</span><span>State: {activeMarket.marketState}</span></div>
                    {activeMarket.id === "usdnpr" && nrbReference && <div className="nrb-reference"><Landmark size={18} /><div><strong>NRB official daily reference · {nrbReference.date}</strong><span>Buy {fmt(nrbReference.buy, 2)} · Sell {fmt(nrbReference.sell, 2)} · Mid {fmt(nrbReference.mid, 2)}</span></div></div>}
                    <div className="hedge-example"><BriefcaseBusiness size={18} /><div><strong>How a business uses this</strong><p>{activeMarket.id === "usdnpr" ? "An importer can go long USD/NPR to offset a more expensive dollar invoice; an exporter can take the opposing short exposure." : "A fuel-dependent importer can go long oil to offset a price increase; an energy alternative business can take the opposing short view."}</p></div></div>
                  </article>

                  <aside className="card order-ticket">
                    <span className="section-kicker">CREATE HEDGE REQUEST</span><h2>{activeMarket.shortName} exposure</h2><p>Post at the current indicative mark. Your position only begins when another participant accepts it.</p>
                    <div className="side-toggle"><button className={side === "long" ? "active long" : ""} onClick={() => setSide("long")}><TrendingUp size={16} /> Long / protect rise</button><button className={side === "short" ? "active short" : ""} onClick={() => setSide("short")}><TrendingDown size={16} /> Short / protect fall</button></div>
                    <label className="field-label">Notional value <small>tNPR</small></label>
                    <div className="amount-input"><input type="number" min="10000" max="250000" step="10000" value={notional} onChange={(event) => setNotional(Number(event.target.value))} /><span>tNPR</span></div>
                    <div className="amount-presets">{[10_000, 25_000, 50_000, 100_000].map((amount) => <button key={amount} onClick={() => setNotional(amount)}>{fmt(amount / 1000)}K</button>)}</div>
                    <div className="ticket-summary"><div><span>Reference mark</span><strong>{fmt(activeMarket.price, activeMarket.id === "usdnpr" ? 3 : 2)}</strong></div><div><span>Margin reserved</span><strong>{fmt(notional)} tNPR</strong></div><div><span>Platform position</span><strong className="positive">0 tNPR</strong></div><div><span>Initial P&L at match</span><strong>0.00 tNPR</strong></div></div>
                    <button className={`primary-button submit-order ${side}`} disabled={busy === "place-order" || notional > (currentAccount?.available_balance ?? 0)} onClick={placeOrder}>{busy === "place-order" ? "Posting..." : `Post ${side} request`}<ArrowRight size={16} /></button>
                    <p className="fine-print"><LockKeyhole size={13} /> 100% test margin is reserved. No automatic market maker or platform counterparty.</p>
                  </aside>
                </section>

                <section className="dashboard-split">
                  {orderBook}
                  <article className="card account-card"><div className="card-heading"><div><span className="section-kicker">MARGIN ACCOUNT</span><h2>{fmt(equity, 2)} <small>tNPR</small></h2></div><span className="verified"><ShieldCheck size={14} /> DEMO</span></div><div className="account-breakdown"><div><span>Available</span><strong>{fmt(currentAccount?.available_balance ?? 0)}</strong></div><div><span>Locked</span><strong>{fmt(lockedNotional)}</strong></div><div><span>Unrealised P&L</span><strong className={unrealisedPnl >= 0 ? "positive" : "negative"}>{unrealisedPnl >= 0 ? "+" : ""}{fmt(unrealisedPnl, 2)}</strong></div></div><button className="secondary-button full" onClick={() => { setDepositStep("form"); setDepositOpen(true); }}><ArrowDownToLine size={15} /> Deposit via connectIPS Sandbox</button></article>
                </section>
              </>
            )}

            {view === "orders" && (
              <section className="standard-view"><div className="page-heading compact"><div><span className="eyebrow">PARTICIPANT LIQUIDITY</span><h1>Shared order book</h1><p>See the request Asha posted, switch to Bikash, and accept the opposite side.</p></div><div className="principle-pill"><Users size={20} /><span><strong>Participants create 100% of open interest</strong><small>The platform never takes a position.</small></span></div></div>{marketCards}{orderBook}</section>
            )}

            {view === "portfolio" && (
              <section className="standard-view">
                <div className="page-heading compact"><div><span className="eyebrow">YOUR HEDGES</span><h1>Portfolio</h1><p>Every position has a named demo counterparty, the same match price, and live mark-to-market P&L.</p></div><div className="equity-hero"><small>TOTAL TEST EQUITY</small><strong>{fmt(equity, 2)} tNPR</strong><span className={unrealisedPnl >= 0 ? "positive" : "negative"}>{unrealisedPnl >= 0 ? "+" : ""}{fmt(unrealisedPnl, 2)} unrealised</span></div></div>
                <div className="portfolio-grid">
                  <article className="card positions-card"><div className="card-heading"><div><span className="section-kicker">OPEN POSITIONS</span><h2>{userPositions.length} active hedges</h2></div><span className="balanced-chip"><Scale size={14} /> Equal opposite sides</span></div>
                    <div className="position-list">
                      {userPositions.map((position) => {
                        const market = markets.find((item) => item.id === position.market_id);
                        const counterparty = accountById(position.counterparty_id);
                        const pnl = positionPnl(position);
                        const receipt = receipts[position.id];
                        return <div className="position-row" key={position.id}>
                          <div className={`position-direction ${position.side}`}>{position.side === "long" ? <TrendingUp size={18} /> : <TrendingDown size={18} />}</div>
                          <div className="position-name"><strong>{market?.shortName} · {position.side.toUpperCase()}</strong><span>vs {counterparty?.company}</span><small>Match {position.match_id}</small></div>
                          <div><span>NOTIONAL</span><strong>{fmt(position.notional)} tNPR</strong></div>
                          <div><span>ENTRY / LIVE MARK</span><strong>{fmt(position.entry_price, position.market_id === "usdnpr" ? 3 : 2)} / {fmt(market?.price ?? position.entry_price, position.market_id === "usdnpr" ? 3 : 2)}</strong></div>
                          <div><span>UNREALISED P&L</span><strong className={pnl >= 0 ? "positive" : "negative"}>{pnl >= 0 ? "+" : ""}{fmt(pnl, 2)} tNPR</strong></div>
                          <div className="receipt-action">{receipt ? <a href={`https://explorer.solana.com/tx/${receipt}?cluster=devnet`} target="_blank" rel="noreferrer">View receipt <ExternalLink size={12} /></a> : <button onClick={() => anchorReceipt(position)} disabled={busy === `anchor-${position.id}`}>{busy === `anchor-${position.id}` ? "Signing..." : "Devnet receipt"}</button>}</div>
                        </div>;
                      })}
                    </div>
                  </article>
                  <aside className="card wallet-card"><span className="wallet-art"><Wallet size={25} /></span><span className="section-kicker">OPTIONAL PUBLIC PROOF</span><h2>Anchor a match receipt</h2><p>The shared matching demo works without a wallet. Connect one only to write an optional Memo Program receipt to Solana Devnet.</p><button className="secondary-button full" onClick={connectWallet}><Wallet size={15} />{walletAddress ? shortAddress(walletAddress) : "Connect wallet"}</button><div className="scope-note"><CircleAlert size={14} /><span><strong>What is on-chain?</strong> A test-only match memo. Money, custody, price feeds and settlement are not on-chain in this MVP.</span></div></aside>
                </div>
              </section>
            )}

            {view === "oversight" && (
              <section className="standard-view">
                <div className="page-heading compact"><div><span className="eyebrow">TRANSPARENT MARKET STRUCTURE</span><h1>Participant-only oversight</h1><p>Matched exposure is balanced by construction. Unmatched orders remain requests and never become positions.</p></div><span className="zero-exposure"><ShieldCheck size={22} /><span><small>PLATFORM EXPOSURE</small><strong>0 tNPR</strong></span></span></div>
                <div className="metric-grid"><article><Users size={20} /><span>DEMO PARTICIPANTS</span><strong>{demo.accounts.length}</strong><small>Businesses with distinct hedge needs</small></article><article><Scale size={20} /><span>MATCHED OPEN INTEREST</span><strong>{fmt(matchedOpenInterest)}</strong><small>tNPR, counted once per matched pair</small></article><article><Activity size={20} /><span>LONG / SHORT</span><strong>{fmt(totalLong)} / {fmt(totalShort)}</strong><small>Equal participant exposure</small></article><article><Clock3 size={20} /><span>WAITING REQUESTS</span><strong>{demo.orders.length}</strong><small>Not yet part of open interest</small></article></div>
                <div className="oversight-grid"><article className="card exposure-card"><div className="card-heading"><div><span className="section-kicker">BALANCE CHECK</span><h2>Open interest is participant-created</h2></div><span className="balanced-chip"><Check size={14} /> BALANCED</span></div><div className="exposure-figures"><span><small>PARTICIPANT LONGS</small><strong>{fmt(totalLong)} tNPR</strong></span><i>=</i><span><small>PARTICIPANT SHORTS</small><strong>{fmt(totalShort)} tNPR</strong></span></div><div className="exposure-bar"><span style={{ width: "50%" }} /><span style={{ width: "50%" }} /></div><div className="exposure-legend"><span><i className="long-color" /> Participant long</span><span><i className="short-color" /> Participant short</span><span><i className="platform-color" /> Platform inventory: zero</span></div><div className="market-exposure">{markets.map((market) => { const value = demo.positions.filter((position) => position.market_id === market.id && position.side === "long").reduce((sum, position) => sum + position.notional, 0); return <div key={market.id}><span>{market.shortName}</span><strong>{fmt(value)} tNPR</strong><em>{demo.positions.filter((position) => position.market_id === market.id).length / 2} matches</em></div>; })}</div></article>
                <article className="card control-card"><div className="card-heading"><div><span className="section-kicker">MVP CONTROLS</span><h2>Safety rails</h2></div></div><div className="control-list"><span><LockKeyhole size={17} /><div><strong>100% prefunded</strong><small>Notional reserved before matching</small></div><em>ACTIVE</em></span><span><Users size={17} /><div><strong>No house account</strong><small>Self-matching is blocked</small></div><em>ACTIVE</em></span><span><Database size={17} /><div><strong>Shared state</strong><small>D1-backed orders and positions</small></div><em>ACTIVE</em></span><span><Radio size={17} /><div><strong>Feed labels</strong><small>Indicative/delayed status visible</small></div><em>ACTIVE</em></span></div></article>
                <article className="card audit-card"><div className="card-heading"><div><span className="section-kicker">MARKET AUDIT</span><h2>Recent demo activity</h2></div><span className="polling"><i /> shared live state</span></div><div className="audit-list">{demo.audit.slice(0, 12).map((event) => <div className="audit-row" key={event.id}><span className="audit-icon">{event.kind === "deposit" ? <Landmark size={15} /> : event.kind === "match" ? <Scale size={15} /> : <BarChart3 size={15} />}</span><div><strong>{event.title}</strong><span>{event.detail}</span></div><em>{accountById(event.actor_id ?? "")?.company ?? "System"}</em><time>{timeAgo(event.created_at)}</time></div>)}</div></article></div>
              </section>
            )}
          </>
        )}
      </div>

      <footer><div className="footer-brand"><span className="brand-mark small">N</span><span><strong>NPRX Global</strong><small>BUSINESS HEDGING SANDBOX</small></span></div><p>Demo only. No real money, deposits, custody, securities, derivatives, settlement, or investment service. Quotes may be delayed and are not official settlement prices.</p><span>Solana Devnet · v0.2</span></footer>

      {depositOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Fund sandbox account">
          <div className="deposit-modal">
            <button className="modal-close" onClick={closeDeposit} aria-label="Close"><X size={18} /></button>
            {depositStep === "form" && <><span className="payment-logo"><Landmark size={20} /></span><span className="section-kicker">STEP 1 OF 2</span><h2>Fund your sandbox account</h2><p>Choose an amount to simulate through connectIPS. NPRX will credit the same amount in test-only tNPR.</p><label className="field-label">Deposit amount <small>NPR</small></label><div className="amount-input modal-amount"><input type="number" min="10000" max="1000000" step="10000" value={depositAmount} onChange={(event) => setDepositAmount(Number(event.target.value))} /><span>NPR</span></div><div className="amount-presets">{[50_000, 100_000, 250_000, 500_000].map((amount) => <button key={amount} onClick={() => setDepositAmount(amount)}>{fmt(amount / 1000)}K</button>)}</div><div className="bank-account"><span className="bank-symbol">DB</span><span><strong>Demo Bank account</strong><small>Primary account ···· {currentUserId === "person1" ? "2408" : "7712"}</small></span><CheckCircle2 size={17} /></div><button className="primary-button full" onClick={() => setDepositStep("confirm")} disabled={depositAmount < 10_000 || depositAmount > 1_000_000}>Continue with connectIPS Sandbox <ArrowRight size={16} /></button><button className="text-button" onClick={closeDeposit}>Use existing demo balance</button></>}
            {depositStep === "confirm" && <><span className="connectips-wordmark">connect<span>IPS</span></span><span className="sandbox-label">SANDBOX SIMULATION</span><h2>Approve demo payment</h2><p>This screen resembles a payment hand-off for the product story. It will not contact connectIPS, a bank, or any external payment system.</p><div className="payment-summary"><div><span>Merchant</span><strong>NPRX Global Sandbox</strong></div><div><span>From</span><strong>Demo Bank ···· {currentUserId === "person1" ? "2408" : "7712"}</strong></div><div><span>Amount</span><strong>NPR {fmt(depositAmount, 2)}</strong></div><div><span>You receive</span><strong>{fmt(depositAmount, 2)} tNPR</strong></div></div><div className="simulation-warning"><CircleAlert size={18} /><span><strong>Simulation only</strong>No real credentials, bank account or money will be used.</span></div><button className="primary-button full" disabled={busy === "deposit"} onClick={submitDeposit}>{busy === "deposit" ? "Crediting test funds..." : "Approve sandbox payment"}</button><button className="text-button" onClick={() => setDepositStep("form")}>Back</button></>}
            {depositStep === "success" && <div className="deposit-success"><span><Check size={32} /></span><small>PAYMENT SIMULATED</small><h2>{fmt(depositAmount)} tNPR credited</h2><p>Your test account received a 1:1 credit. No real funds moved.</p><div className="reference-box"><span>Sandbox reference</span><strong>{depositReference}</strong></div><button className="primary-button full" onClick={closeDeposit}>Enter dashboard <ArrowRight size={16} /></button></div>}
          </div>
        </div>
      )}
    </main>
  );
}

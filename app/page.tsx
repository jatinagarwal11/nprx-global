"use client";

import { Buffer } from "buffer";
import {
  Activity, ArrowDownToLine, ArrowRight, ArrowUpFromLine, BarChart3, BriefcaseBusiness,
  Building2, Check, CheckCircle2, CircleAlert, Database, ExternalLink, Fuel, Globe2,
  Landmark, Link2, ListFilter, LockKeyhole, LogOut, PieChart, Radio, RefreshCw,
  Scale, ShieldCheck, Sparkles, TrendingDown, TrendingUp, Users, Wallet, X, Zap,
} from "lucide-react";
import { FormEvent, MouseEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

declare global {
  interface Window {
    solana?: BrowserWallet;
    solflare?: BrowserWallet;
    phantom?: { solana?: BrowserWallet };
  }
}

const MEMO_PROGRAM_ID = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr";
const MAX_FUNDING = 1_000_000;

type View = "trade" | "orders" | "portfolio" | "history" | "model";
type Side = "long" | "short";
type MarketId = "wti" | "brent" | "usdnpr";
type MarketPoint = { value: number; time: number };
type Market = {
  id: MarketId; symbol: string; shortName: string; name: string; unit: string; price: number;
  previousClose: number; change: number; changePct: number; updatedAt: string; provider: string;
  hedgeUse: string; points: MarketPoint[];
};
type NrbReference = { date?: string; buy: number; sell: number; mid: number; provider: string };
type DemoAccount = {
  id: string; email: string; display_name: string; company: string; role: string; hedge_story: string;
  available_balance: number; funding_total: number; withdrawn_total: number; created_at: string;
};
type DemoOrder = { id: string; user_id: string; market_id: MarketId; side: Side; notional: number; posted_price: number; status: string; created_at: string };
type DemoPosition = { id: string; match_id: string; user_id: string; counterparty_id: string; market_id: MarketId; side: Side; notional: number; entry_price: number; status: string; created_at: string; signature?: string | null };
type DemoTrade = { id: string; match_id: string; market_id: MarketId; long_user_id: string; short_user_id: string; notional: number; price: number; status: "matched" | "settled"; chain_signature?: string | null; created_at: string };
type DemoDeposit = { id: string; user_id: string; amount: number; reference: string; rail: string; created_at: string };
type DemoWithdrawal = { id: string; user_id: string; amount: number; reference: string; status: string; created_at: string };
type DemoAudit = { id: string; kind: string; actor_id?: string | null; title: string; detail: string; created_at: string };
type DemoState = {
  accounts: DemoAccount[]; orders: DemoOrder[]; positions: DemoPosition[]; trades: DemoTrade[];
  deposits: DemoDeposit[]; withdrawals: DemoWithdrawal[]; audit: DemoAudit[];
  limits: { lifetimeFunding: number };
};
type BrowserWallet = {
  publicKey?: { toString: () => string };
  connect: () => Promise<{ publicKey: { toString: () => string } }>;
  signTransaction: <T>(transaction: T) => Promise<T>;
  signAllTransactions?: <T>(transactions: T[]) => Promise<T[]>;
};

const fallbackMarkets: Market[] = [
  { id: "wti", symbol: "CL", shortName: "WTI", name: "WTI Crude Oil", unit: "USD / bbl", price: 86.4, previousClose: 85.9, change: .5, changePct: .58, updatedAt: new Date().toISOString(), provider: "Indicative reference feed", hedgeUse: "Fuel, freight and input-cost hedge", points: [] },
  { id: "brent", symbol: "BZ", shortName: "BRENT", name: "Brent Crude Oil", unit: "USD / bbl", price: 89.7, previousClose: 89.2, change: .5, changePct: .56, updatedAt: new Date().toISOString(), provider: "Indicative reference feed", hedgeUse: "Global oil-cost benchmark", points: [] },
  { id: "usdnpr", symbol: "USDNPR", shortName: "USD/NPR", name: "US Dollar / Nepalese Rupee", unit: "NPR per USD", price: 154.28, previousClose: 153.96, change: .32, changePct: .21, updatedAt: new Date().toISOString(), provider: "Indicative FX feed", hedgeUse: "Import invoices and export receipts", points: [] },
];

const emptyDemo: DemoState = { accounts: [], orders: [], positions: [], trades: [], deposits: [], withdrawals: [], audit: [], limits: { lifetimeFunding: MAX_FUNDING } };
const fmt = (amount: number, digits = 0) => new Intl.NumberFormat("en-NP", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(amount);
const shortAddress = (value: string) => `${value.slice(0, 4)}...${value.slice(-4)}`;
const opposite = (side: Side): Side => side === "long" ? "short" : "long";
const initials = (name = "Participant") => name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
const marketIcon = (id: MarketId) => id === "usdnpr" ? <Globe2 size={17} /> : <Fuel size={17} />;
const timeAgo = (timestamp: string) => {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
};
const dateTime = (timestamp: string) => new Intl.DateTimeFormat("en-NP", { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(timestamp));

function MarketLineChart({ market }: { market: Market }) {
  const [hover, setHover] = useState<number | null>(null);
  const width = 920;
  const height = 330;
  const pad = { left: 62, right: 24, top: 22, bottom: 40 };
  const points = market.points.length > 1 ? market.points : [
    { value: market.previousClose, time: Date.now() / 1000 - 3600 },
    { value: market.price, time: Date.now() / 1000 },
  ];
  const values = points.map((point) => point.value);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const buffer = Math.max((rawMax - rawMin) * .14, market.price * .001);
  const min = rawMin - buffer;
  const max = rawMax + buffer;
  const chartW = width - pad.left - pad.right;
  const chartH = height - pad.top - pad.bottom;
  const coords = points.map((point, index) => ({
    x: pad.left + (index / Math.max(1, points.length - 1)) * chartW,
    y: pad.top + ((max - point.value) / Math.max(.0001, max - min)) * chartH,
    value: point.value,
    time: point.time,
  }));
  const line = coords.map((point, index) => `${index ? "L" : "M"}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
  const area = `${line} L${coords.at(-1)?.x},${height - pad.bottom} L${coords[0].x},${height - pad.bottom} Z`;
  const positive = market.change >= 0;
  const active = coords[hover ?? coords.length - 1];
  const xLabels = [...new Set([0, Math.floor((points.length - 1) / 3), Math.floor((points.length - 1) * 2 / 3), points.length - 1])];
  const move = (event: MouseEvent<SVGSVGElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const localX = ((event.clientX - box.left) / box.width) * width;
    setHover(Math.max(0, Math.min(points.length - 1, Math.round(((localX - pad.left) / chartW) * (points.length - 1)))));
  };
  return <div className="line-chart">
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${market.name} live reference line chart`} onMouseMove={move} onMouseLeave={() => setHover(null)}>
      <defs><linearGradient id={`area-${market.id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={positive ? "#15966d" : "#d5525f"} stopOpacity=".28"/><stop offset="1" stopColor={positive ? "#15966d" : "#d5525f"} stopOpacity="0"/></linearGradient></defs>
      {[0, .25, .5, .75, 1].map((step) => { const y = pad.top + step * chartH; const label = max - step * (max - min); return <g key={step}><line x1={pad.left} x2={width - pad.right} y1={y} y2={y} className="chart-grid"/><text x={pad.left - 9} y={y + 4} textAnchor="end" className="axis-label">{fmt(label, market.id === "usdnpr" ? 2 : 1)}</text></g>; })}
      <path d={area} fill={`url(#area-${market.id})`}/><path d={line} className={positive ? "chart-line up" : "chart-line down"}/>
      {xLabels.map((index) => <text key={index} x={coords[index].x} y={height - 12} textAnchor={index === 0 ? "start" : index === points.length - 1 ? "end" : "middle"} className="axis-label">{new Date(points[index].time * 1000).toLocaleTimeString("en-NP", { hour: "2-digit", minute: "2-digit" })}</text>)}
      {active && <g><line x1={active.x} x2={active.x} y1={pad.top} y2={height - pad.bottom} className="crosshair"/><circle cx={active.x} cy={active.y} r="5" className={positive ? "point up" : "point down"}/><g transform={`translate(${Math.min(width - 158, Math.max(70, active.x - 68))},${Math.max(8, active.y - 58)})`}><rect width="136" height="44" rx="5" className="chart-tooltip"/><text x="10" y="17" className="tooltip-price">{fmt(active.value, market.id === "usdnpr" ? 3 : 2)}</text><text x="10" y="33" className="tooltip-time">{new Date(active.time * 1000).toLocaleTimeString("en-NP", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</text></g></g>}
    </svg>
  </div>;
}

const exposureOptions = [
  { value: "importer", label: "Importer / USD buyer", story: "Future USD invoices create a natural short USD/NPR exposure. Long USD/NPR and oil hedges may stabilise landed cost." },
  { value: "exporter", label: "Exporter / USD receiver", story: "Expected USD receipts create a natural long USD/NPR exposure. A short USD/NPR hedge may stabilise future NPR revenue." },
  { value: "fuel", label: "Fuel-intensive business", story: "Fuel costs make the business naturally short oil. A long oil hedge may absorb price increases." },
  { value: "renewable", label: "Renewable / solar business", story: "The business may benefit when fossil-fuel prices rise. A short oil hedge can reduce that economic sensitivity." },
];

function JoinScreen({ onCreate, busy, error, participants, trades }: { onCreate: (payload: Record<string, unknown>) => Promise<void>; busy: boolean; error: string; participants: number; trades: number }) {
  const [displayName, setDisplayName] = useState("");
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("Finance / treasury");
  const [exposure, setExposure] = useState("importer");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const selected = exposureOptions.find((item) => item.value === exposure) ?? exposureOptions[0];
    await onCreate({ action: "create_account", displayName, company, role, hedgeStory: selected.story });
  };
  return <main className="join-shell">
    <section className="join-story">
      <div className="login-brand"><span className="brand-mark">N</span><span><strong>NPRX Global</strong><small>PARTICIPANT PAPER MARKET</small></span></div>
      <div className="story-copy"><span className="eyebrow">LIVE BUSINESS-HEDGING SIMULATION</span><h1>Test the hedge.<br/>Keep capital local.</h1><p>Join a shared paper market for WTI, Brent and USD/NPR. Match with businesses that hold the opposite economic exposure and learn what a domestic, NPR-settled hedge could feel like.</p></div>
      <div className="story-stats"><span><strong>{Math.max(12, participants)}</strong><small>market participants</small></span><span><strong>{Math.max(100, trades)}</strong><small>recorded matches</small></span><span><strong>0</strong><small>house positions</small></span></div>
    </section>
    <section className="join-panel"><form className="join-card" onSubmit={submit}>
      <span className="simulation-chip"><Sparkles size={13}/> OPEN PAPER SANDBOX</span>
      <h2>Create your participant</h2><p>No demo-account picker and no real money. Your sandbox identity stays on this device while shared market activity is stored publicly.</p>
      <label>Your name<input required minLength={2} maxLength={60} value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="e.g. Sita Sharma"/></label>
      <label>Business name<input required minLength={2} maxLength={80} value={company} onChange={(event) => setCompany(event.target.value)} placeholder="e.g. Kathmandu Food Imports"/></label>
      <div className="form-pair"><label>Your role<input maxLength={60} value={role} onChange={(event) => setRole(event.target.value)} /></label><label>Natural exposure<select value={exposure} onChange={(event) => setExposure(event.target.value)}>{exposureOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label></div>
      <div className="join-disclaimer"><CircleAlert size={16}/><span><strong>Simulation only</strong> tNPR is unbacked play money. Creating an account does not open a financial account or derivative contract.</span></div>
      {error && <div className="form-error"><CircleAlert size={14}/>{error}</div>}
      <button className="primary-button full" disabled={busy}>{busy ? "Creating participant..." : "Enter live simulation"}<ArrowRight size={16}/></button>
      <small className="device-note"><LockKeyhole size={12}/> No password or personal email is collected in this prototype.</small>
    </form></section>
  </main>;
}

function CashModal({ mode, account, busy, onClose, onSubmit }: { mode: "fund" | "withdraw"; account: DemoAccount; busy: boolean; onClose: () => void; onSubmit: (amount: number) => Promise<boolean> }) {
  const remaining = Math.max(0, MAX_FUNDING - account.funding_total);
  const maximum = mode === "fund" ? remaining : account.available_balance;
  const [amount, setAmount] = useState(Math.min(100000, maximum));
  const [complete, setComplete] = useState(false);
  const submit = async () => { if (await onSubmit(amount)) setComplete(true); };
  return <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={mode === "fund" ? "Claim paper funds" : "Simulate tNPR redemption"}><div className="cash-modal">
    <button className="modal-close" onClick={onClose} aria-label="Close"><X size={18}/></button>
    {complete ? <div className="cash-complete"><span><Check size={31}/></span><small>SIMULATION COMPLETE</small><h2>{fmt(amount)} tNPR</h2><p>{mode === "fund" ? "Paper funds were added. No real money entered NPRX." : "tNPR was removed. No real NPR was transferred."}</p><button className="primary-button full" onClick={onClose}>Return to market <ArrowRight size={15}/></button></div> : <>
      <span className="modal-icon">{mode === "fund" ? <ArrowDownToLine size={20}/> : <ArrowUpFromLine size={20}/>}</span>
      <span className="section-kicker">{mode === "fund" ? "CAPPED PAPER FUNDING" : "REDEMPTION SIMULATION"}</span>
      <h2>{mode === "fund" ? "Fund your test wallet" : "Withdraw tNPR"}</h2>
      <p>{mode === "fund" ? "Claim play money for collateral. The lifetime allowance cannot exceed 1,000,000 tNPR." : "This illustrates how a licensed production operator could burn tNPR and pay NPR from domestic reserves. This prototype pays nothing."}</p>
      {mode === "fund" && <div className="cap-meter"><span><small>LIFETIME ALLOCATED</small><strong>{fmt(account.funding_total)} / 1,000,000 tNPR</strong></span><i><b style={{ width: `${Math.min(100, account.funding_total / MAX_FUNDING * 100)}%` }}/></i><em>{fmt(remaining)} tNPR remaining</em></div>}
      {mode === "withdraw" && <div className="withdraw-flow"><span>tNPR balance</span><ArrowRight size={14}/><span>Burn instruction</span><ArrowRight size={14}/><span>Domestic NPR rail</span></div>}
      <label className="cash-amount">Amount <small>tNPR</small><div><input type="number" min="10000" max={maximum} step="10000" value={amount} onChange={(event) => setAmount(Number(event.target.value))}/><span>tNPR</span></div></label>
      <div className="amount-presets">{[50000, 100000, 250000, 500000].filter((value) => value <= maximum).map((value) => <button type="button" key={value} onClick={() => setAmount(value)}>{fmt(value / 1000)}K</button>)}</div>
      <div className="simulation-warning"><CircleAlert size={17}/><span><strong>No monetary value</strong>{mode === "fund" ? "This faucet does not accept NPR." : "This action does not pay NPR."}</span></div>
      <button className="primary-button full" disabled={busy || amount < 10000 || amount > maximum || maximum < 10000} onClick={submit}>{busy ? "Processing..." : mode === "fund" ? `Claim ${fmt(amount)} tNPR` : `Simulate withdrawal`}</button>
    </>}
  </div></div>;
}

export default function Home() {
  const [view, setView] = useState<View>("trade");
  const [demo, setDemo] = useState<DemoState>(emptyDemo);
  const [markets, setMarkets] = useState<Market[]>(fallbackMarkets);
  const [nrbReference, setNrbReference] = useState<NrbReference | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [activeMarketId, setActiveMarketId] = useState<MarketId>("wti");
  const [side, setSide] = useState<Side>("long");
  const [notional, setNotional] = useState(50000);
  const [historyScope, setHistoryScope] = useState<"all" | "mine">("all");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loadingState, setLoadingState] = useState(true);
  const [cashMode, setCashMode] = useState<"fund" | "withdraw" | null>(null);
  const [walletAddress, setWalletAddress] = useState("");
  const [walletProvider, setWalletProvider] = useState<BrowserWallet | null>(null);
  const restored = useRef(false);

  const fetchDemo = useCallback(async (quiet = false) => {
    try {
      const response = await fetch("/api/demo", { cache: "no-store" });
      const payload = await response.json() as DemoState & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Shared paper market unavailable");
      setDemo(payload);
      if (!quiet) setError("");
    } catch (cause) { if (!quiet) setError(cause instanceof Error ? cause.message : "Shared paper market unavailable"); }
    finally { if (!quiet) setLoadingState(false); }
  }, []);
  const fetchMarkets = useCallback(async () => {
    try {
      const response = await fetch("/api/markets", { cache: "no-store" });
      if (!response.ok) throw new Error();
      const payload = await response.json() as { markets: Market[]; nrbReference: NrbReference | null };
      if (payload.markets?.length) setMarkets(payload.markets);
      setNrbReference(payload.nrbReference ?? null);
    } catch { /* retain last good market marks */ }
  }, []);

  useEffect(() => {
    fetchDemo(); fetchMarkets();
    const stateTimer = window.setInterval(() => fetchDemo(true), 10000);
    const marketTimer = window.setInterval(fetchMarkets, 30000);
    return () => { window.clearInterval(stateTimer); window.clearInterval(marketTimer); };
  }, [fetchDemo, fetchMarkets]);
  useEffect(() => {
    if (restored.current || loadingState) return;
    restored.current = true;
    const saved = window.localStorage.getItem("nprx-participant-id");
    if (saved && demo.accounts.some((account) => account.id === saved)) setCurrentUserId(saved);
    else if (saved) window.localStorage.removeItem("nprx-participant-id");
  }, [demo.accounts, loadingState]);

  const currentAccount = demo.accounts.find((account) => account.id === currentUserId);
  const activeMarket = markets.find((market) => market.id === activeMarketId) ?? markets[0];
  const accountById = (id: string) => demo.accounts.find((account) => account.id === id);
  const userPositions = demo.positions.filter((position) => position.user_id === currentUserId);
  const userOrders = demo.orders.filter((order) => order.user_id === currentUserId);
  const userTrades = demo.trades.filter((trade) => trade.long_user_id === currentUserId || trade.short_user_id === currentUserId);
  const lockedNotional = [...userPositions, ...userOrders].reduce((sum, item) => sum + item.notional, 0);
  const positionPnl = useCallback((position: DemoPosition) => {
    const mark = markets.find((market) => market.id === position.market_id)?.price ?? position.entry_price;
    return (position.side === "long" ? 1 : -1) * position.notional * (mark / position.entry_price - 1);
  }, [markets]);
  const unrealisedPnl = userPositions.reduce((sum, position) => sum + positionPnl(position), 0);
  const equity = (currentAccount?.available_balance ?? 0) + lockedNotional + unrealisedPnl;
  const grossExposure = userPositions.reduce((sum, position) => sum + position.notional, 0);
  const marginUtilisation = equity > 0 ? Math.min(100, lockedNotional / equity * 100) : 0;
  const totalLong = demo.positions.filter((position) => position.side === "long").reduce((sum, position) => sum + position.notional, 0);
  const totalShort = demo.positions.filter((position) => position.side === "short").reduce((sum, position) => sum + position.notional, 0);
  const openInterest = Math.min(totalLong, totalShort);
  const activeValues = activeMarket.points.map((point) => point.value);
  const sessionOpen = activeValues[0] ?? activeMarket.previousClose;
  const sessionHigh = Math.max(...(activeValues.length ? activeValues : [activeMarket.price]));
  const sessionLow = Math.min(...(activeValues.length ? activeValues : [activeMarket.price]));
  const tradeRows = historyScope === "mine" ? userTrades : demo.trades;
  const marketExposure = useMemo(() => (["wti", "brent", "usdnpr"] as MarketId[]).map((marketId) => {
    const positions = userPositions.filter((position) => position.market_id === marketId);
    const gross = positions.reduce((sum, position) => sum + position.notional, 0);
    const net = positions.reduce((sum, position) => sum + (position.side === "long" ? position.notional : -position.notional), 0);
    return { marketId, gross, net };
  }), [userPositions]);
  const cashActivity = useMemo(() => [
    ...demo.deposits.filter((item) => item.user_id === currentUserId).map((item) => ({ ...item, kind: "Funding", signed: item.amount })),
    ...demo.withdrawals.filter((item) => item.user_id === currentUserId).map((item) => ({ ...item, kind: "Redemption", signed: -item.amount })),
  ].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 8), [demo.deposits, demo.withdrawals, currentUserId]);

  const postAction = async (payload: Record<string, unknown>, label: string) => {
    if (!currentUserId) return null;
    setBusy(label); setError(""); setNotice("");
    try {
      const response = await fetch("/api/demo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, userId: currentUserId }) });
      const result = await response.json() as { error?: string; state?: DemoState; reference?: string; tradeId?: string };
      if (!response.ok) throw new Error(result.error ?? "Paper-market action failed");
      if (result.state) setDemo(result.state);
      return result;
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Paper-market action failed"); return null; }
    finally { setBusy(""); }
  };
  const createAccount = async (payload: Record<string, unknown>) => {
    setBusy("create-account"); setError("");
    try {
      const response = await fetch("/api/demo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json() as { error?: string; userId?: string; state?: DemoState };
      if (!response.ok || !result.userId) throw new Error(result.error ?? "Could not create participant");
      if (result.state) setDemo(result.state);
      window.localStorage.setItem("nprx-participant-id", result.userId);
      setCurrentUserId(result.userId);
      setNotice("Participant created. Claim capped tNPR to start matching hedges.");
      setCashMode("fund");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not create participant"); }
    finally { setBusy(""); }
  };
  const logout = () => { window.localStorage.removeItem("nprx-participant-id"); setCurrentUserId(null); setCashMode(null); setNotice(""); setError(""); };
  const placeOrder = async () => { const result = await postAction({ action: "place_order", marketId: activeMarket.id, side, notional, postedPrice: activeMarket.price }, "place-order"); if (result) { setNotice(`${side.toUpperCase()} ${activeMarket.shortName} request posted. It remains an order until another participant accepts.`); setView("orders"); } };
  const takeOrder = async (order: DemoOrder) => { const market = markets.find((item) => item.id === order.market_id); const matchPrice = market?.price ?? order.posted_price; const result = await postAction({ action: "take_order", orderId: order.id, matchPrice }, `take-${order.id}`); if (result) { setNotice(`Matched at ${fmt(matchPrice, order.market_id === "usdnpr" ? 3 : 2)}. Both participants start at 0.00 tNPR unrealised P&L.`); setView("portfolio"); } };
  const cancelOrder = async (order: DemoOrder) => { if (await postAction({ action: "cancel_order", orderId: order.id }, `cancel-${order.id}`)) setNotice(`${fmt(order.notional)} tNPR paper margin released.`); };
  const cashAction = async (amount: number) => { const result = await postAction({ action: cashMode === "fund" ? "claim_funds" : "withdraw", amount }, cashMode ?? "cash"); if (result) { setNotice(cashMode === "fund" ? `${fmt(amount)} tNPR claimed within your lifetime cap.` : `${fmt(amount)} tNPR redemption simulated. No NPR was paid.`); return true; } return false; };

  const connectWallet = async () => {
    setError("");
    const provider = window.phantom?.solana ?? window.solana ?? window.solflare ?? null;
    if (!provider) { setError("No compatible wallet found. Install Phantom or Solflare to publish a Devnet receipt."); return; }
    try { const response = await provider.connect(); setWalletProvider(provider); setWalletAddress(response.publicKey.toString()); setNotice("Wallet connected for optional Solana Devnet receipts."); }
    catch { setError("Wallet connection was cancelled."); }
  };
  const anchorTrade = async (trade: DemoTrade) => {
    if (!currentUserId) return;
    if (!walletProvider || !walletAddress) { await connectWallet(); setError("Connect a wallet, then select Publish again."); return; }
    setBusy(`anchor-${trade.id}`); setError("");
    try {
      const { AnchorProvider, web3 } = await import("@coral-xyz/anchor/dist/browser/index.js");
      const publicKey = new web3.PublicKey(walletAddress);
      const anchorWallet = { publicKey, signTransaction: walletProvider.signTransaction.bind(walletProvider), signAllTransactions: walletProvider.signAllTransactions?.bind(walletProvider) ?? (async <T,>(transactions: T[]) => Promise.all(transactions.map((transaction) => walletProvider.signTransaction(transaction)))) };
      const provider = new AnchorProvider(new web3.Connection(web3.clusterApiUrl("devnet"), "confirmed"), anchorWallet as never, { commitment: "confirmed", preflightCommitment: "confirmed" });
      const memo = Buffer.from(JSON.stringify({ app: "NPRX Global", version: "paper-v0.4", action: "PAPER_TRADE_RECEIPT", trade: trade.id, match: trade.match_id, market: trade.market_id, long: trade.long_user_id, short: trade.short_user_id, notional_tnpr: trade.notional, price: trade.price, disclaimer: "PAPER TRADE - NO MONETARY VALUE" }), "utf8");
      const transaction = new web3.Transaction().add(new web3.TransactionInstruction({ programId: new web3.PublicKey(MEMO_PROGRAM_ID), keys: [{ pubkey: publicKey, isSigner: true, isWritable: false }], data: memo }));
      const signature = await provider.sendAndConfirm(transaction, []);
      const response = await fetch("/api/demo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "attach_signature", userId: currentUserId, tradeId: trade.id, signature }) });
      const result = await response.json() as { error?: string; state?: DemoState };
      if (!response.ok) throw new Error(result.error ?? "Receipt could not be attached");
      if (result.state) setDemo(result.state);
      setNotice("Solana Devnet receipt confirmed and attached to this paper trade.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Solana receipt failed"); }
    finally { setBusy(""); }
  };

  if (!currentUserId || !currentAccount) return <JoinScreen onCreate={createAccount} busy={busy === "create-account"} error={error} participants={demo.accounts.length} trades={demo.trades.length}/>;

  const tickerTape = <section className="ticker-tape" aria-label="Live market ticker">{markets.map((market) => <button className={activeMarket.id === market.id ? "active" : ""} key={market.id} onClick={() => { setActiveMarketId(market.id); setView("trade"); }}><span className="ticker-icon">{marketIcon(market.id)}</span><span><strong>{market.shortName}</strong><small>{market.unit}</small></span><b>{fmt(market.price, market.id === "usdnpr" ? 3 : 2)}</b><em className={market.change >= 0 ? "positive" : "negative"}>{market.change >= 0 ? "+" : ""}{fmt(market.changePct, 2)}%</em></button>)}</section>;
  const orderBook = <article className="panel orderbook-panel"><div className="panel-heading"><div><span className="section-kicker">PARTICIPANT-CREATED LIQUIDITY</span><h2>Open hedge requests</h2></div><span className="sync-label"><RefreshCw size={12}/> 10s shared sync</span></div><div className="order-list">{demo.orders.length === 0 && <div className="empty-state">No open requests. Post the first participant hedge.</div>}{demo.orders.map((order) => { const owner = accountById(order.user_id); const market = markets.find((item) => item.id === order.market_id); const own = order.user_id === currentUserId; return <div className="order-row" key={order.id}><span className={`side-badge ${order.side}`}>{order.side.toUpperCase()}</span><div className="order-identity"><strong>{market?.shortName} · {owner?.company}</strong><span>{owner?.role} · {timeAgo(order.created_at)}</span></div><div><small>REFERENCE</small><strong>{fmt(order.posted_price, order.market_id === "usdnpr" ? 3 : 2)}</strong></div><div><small>NOTIONAL</small><strong>{fmt(order.notional)} tNPR</strong></div>{own ? <button className="table-button" disabled={busy === `cancel-${order.id}`} onClick={() => cancelOrder(order)}>Cancel</button> : <button className={`take-button ${opposite(order.side)}`} disabled={busy === `take-${order.id}` || order.notional > currentAccount.available_balance} onClick={() => takeOrder(order)}>{busy === `take-${order.id}` ? "Matching..." : `Take ${opposite(order.side)}`}</button>}</div>; })}</div></article>;

  return <main className="app-shell">
    <div className="simulation-banner"><CircleAlert size={13}/><strong>PAPER SIMULATION</strong><span>No real money · no real derivative · 1,000,000 tNPR lifetime funding cap</span></div>
    <header className="topbar"><div className="header-brand"><span className="brand-mark small">N</span><span><strong>NPRX Global</strong><small>DOMESTIC HEDGE LAB</small></span></div><nav className="main-nav" aria-label="Main navigation">{([
      ["trade", <BarChart3 key="i"/>, "Trade"], ["orders", <ListFilter key="i"/>, "Orders"], ["portfolio", <PieChart key="i"/>, "Portfolio"], ["history", <Activity key="i"/>, "Transactions"], ["model", <ShieldCheck key="i"/>, "Why NPRX"],
    ] as const).map(([id, icon, label]) => <button key={id} className={view === id ? "active" : ""} onClick={() => setView(id)}>{icon}<b>{label}</b></button>)}</nav><div className="header-actions"><button className="fund-button" onClick={() => setCashMode("fund")}><ArrowDownToLine size={14}/> Fund</button><button className="user-chip" onClick={() => setView("portfolio")}><span className="avatar">{initials(currentAccount.display_name)}</span><span><strong>{currentAccount.company}</strong><small>{fmt(currentAccount.available_balance)} tNPR available</small></span></button><button className="logout-button" onClick={logout} aria-label="Leave participant"><LogOut size={15}/></button></div></header>
    {tickerTape}
    {(error || notice) && <div className={`status-message ${error ? "error" : "success"}`}>{error ? <CircleAlert size={15}/> : <CheckCircle2 size={15}/>}<span>{error || notice}</span><button onClick={() => { setError(""); setNotice(""); }}><X size={14}/></button></div>}

    <div className="workspace">
      {view === "trade" && <>
        <section className="account-ribbon"><div><span className="avatar">{initials(currentAccount.display_name)}</span><span><small>PAPER PARTICIPANT</small><strong>{currentAccount.company}</strong><em>{currentAccount.role}</em></span></div><div><small>EQUITY</small><strong>{fmt(equity, 2)} tNPR</strong></div><div><small>AVAILABLE</small><strong>{fmt(currentAccount.available_balance)} tNPR</strong></div><div><small>UNREALISED</small><strong className={unrealisedPnl >= 0 ? "positive" : "negative"}>{unrealisedPnl >= 0 ? "+" : ""}{fmt(unrealisedPnl, 2)}</strong></div><div><small>FUNDING USED</small><strong>{fmt(currentAccount.funding_total / MAX_FUNDING * 100, 0)}%</strong></div></section>
        <section className="trading-grid"><article className="panel chart-panel"><div className="chart-heading"><div className="instrument-heading"><span className="instrument-icon">{marketIcon(activeMarket.id)}</span><span><small>{activeMarket.symbol} · PAPER INDEX CONTRACT</small><strong>{activeMarket.name}</strong><em>{activeMarket.hedgeUse}</em></span></div><div className="quote-block"><small>INDICATIVE MARK</small><strong>{fmt(activeMarket.price, activeMarket.id === "usdnpr" ? 3 : 2)}</strong><span className={activeMarket.change >= 0 ? "positive" : "negative"}>{activeMarket.change >= 0 ? "+" : ""}{fmt(activeMarket.change, 3)} ({activeMarket.change >= 0 ? "+" : ""}{fmt(activeMarket.changePct, 2)}%)</span></div></div><div className="chart-toolbar"><span><button className="active">LIVE</button><button disabled>1W</button><button disabled>1M</button></span><span><Radio size={12}/>{activeMarket.provider}</span></div><MarketLineChart market={activeMarket}/><div className="market-stats"><span><small>OPEN</small><strong>{fmt(sessionOpen, activeMarket.id === "usdnpr" ? 3 : 2)}</strong></span><span><small>HIGH</small><strong>{fmt(sessionHigh, activeMarket.id === "usdnpr" ? 3 : 2)}</strong></span><span><small>LOW</small><strong>{fmt(sessionLow, activeMarket.id === "usdnpr" ? 3 : 2)}</strong></span><span><small>PREV CLOSE</small><strong>{fmt(activeMarket.previousClose, activeMarket.id === "usdnpr" ? 3 : 2)}</strong></span><span><small>UPDATED</small><strong>{timeAgo(activeMarket.updatedAt)}</strong></span></div>{activeMarket.id === "usdnpr" && nrbReference && <div className="nrb-strip"><Landmark size={15}/><span><strong>NRB official daily reference · {nrbReference.date}</strong><small>Buy {fmt(nrbReference.buy, 2)} · Sell {fmt(nrbReference.sell, 2)} · Mid {fmt(nrbReference.mid, 2)}</small></span></div>}</article>
        <aside className="panel order-ticket"><div className="panel-heading"><div><span className="section-kicker">COLLATERALISED PAPER ORDER</span><h2>{activeMarket.shortName}</h2></div><span className="paper-chip">SIMULATION</span></div><div className="ticket-quote"><span>Indicative execution</span><strong>{fmt(activeMarket.price, activeMarket.id === "usdnpr" ? 3 : 2)}</strong></div><div className="side-toggle"><button className={side === "long" ? "active long" : ""} onClick={() => setSide("long")}><TrendingUp size={15}/> Long</button><button className={side === "short" ? "active short" : ""} onClick={() => setSide("short")}><TrendingDown size={15}/> Short</button></div><p className="side-explainer">{side === "long" ? "Use a long hedge when a rising index would hurt your business." : "Use a short hedge when a falling index would hurt your business or offset a natural long exposure."}</p><label className="field-label">Notional <small>tNPR</small></label><div className="amount-input"><input type="number" min="10000" max="250000" step="10000" value={notional} onChange={(event) => setNotional(Number(event.target.value))}/><span>tNPR</span></div><div className="amount-presets">{[10000, 25000, 50000, 100000].map((amount) => <button key={amount} onClick={() => setNotional(amount)}>{fmt(amount / 1000)}K</button>)}</div><div className="ticket-summary"><span><small>Margin reserved</small><strong>{fmt(notional)} tNPR</strong></span><span><small>Initial P&L when matched</small><strong>0.00 tNPR</strong></span><span><small>Platform inventory</small><strong className="positive">0 tNPR</strong></span></div><button className={`primary-button submit-order ${side}`} disabled={busy === "place-order" || notional > currentAccount.available_balance || notional < 10000} onClick={placeOrder}>{busy === "place-order" ? "Posting..." : `Post ${side} request`}<ArrowRight size={15}/></button><p className="ticket-note"><LockKeyhole size={12}/> A position exists only after another participant takes the opposite side.</p></aside></section>
        <section className="lower-grid">{orderBook}<article className="panel recent-panel"><div className="panel-heading"><div><span className="section-kicker">LIVE MARKET TAPE</span><h2>Recent participant matches</h2></div><button className="link-button" onClick={() => setView("history")}>100 transactions <ArrowRight size={12}/></button></div><div className="compact-trades">{demo.trades.slice(0, 7).map((trade) => <div key={trade.id}><span className="trade-market">{markets.find((market) => market.id === trade.market_id)?.shortName}</span><span><strong>{fmt(trade.price, trade.market_id === "usdnpr" ? 3 : 2)}</strong><small>{dateTime(trade.created_at)}</small></span><b>{fmt(trade.notional)} tNPR</b><em className={trade.status === "matched" ? "open" : "settled"}>{trade.status}</em></div>)}</div></article></section>
      </>}

      {view === "orders" && <section className="standard-view"><div className="view-heading"><div><span className="eyebrow">SHARED PAPER LIQUIDITY</span><h1>Participant order book</h1><p>NPRX brokers introductions between opposite exposures. It cannot take a position, and open demand is not open interest.</p></div><span className="structure-callout"><Users size={20}/><span><strong>{demo.accounts.length} participants</strong><small>{demo.orders.length} requests · zero house orders</small></span></span></div>{orderBook}<div className="order-rules"><article><Scale size={18}/><span><strong>Two-sided by construction</strong><p>One participant long, one participant short, equal notional and the same entry mark.</p></span></article><article><LockKeyhole size={18}/><span><strong>No unilateral exit</strong><p>Closing requires counterparty consent to an offset or novation. Exits are not implemented in this prototype.</p></span></article><article><ShieldCheck size={18}/><span><strong>Fully paper-collateralised</strong><p>Both participants reserve 100% of notional before the match is written.</p></span></article></div></section>}

      {view === "portfolio" && <section className="standard-view"><div className="view-heading"><div><span className="eyebrow">RISK & COLLATERAL</span><h1>{currentAccount.company}</h1><p>A trading-app view of your simulated liquidity, matched exposure and mark-to-market risk.</p></div><div className="portfolio-actions"><button className="secondary-button" onClick={() => setCashMode("fund")}><ArrowDownToLine size={14}/> Fund</button><button className="secondary-button" disabled={currentAccount.available_balance < 10000} onClick={() => setCashMode("withdraw")}><ArrowUpFromLine size={14}/> Withdraw</button></div></div>
        <div className="portfolio-metrics"><article className="hero-metric"><small>NET LIQUIDATION VALUE</small><strong>{fmt(equity, 2)} <em>tNPR</em></strong><span className={unrealisedPnl >= 0 ? "positive" : "negative"}>{unrealisedPnl >= 0 ? "+" : ""}{fmt(unrealisedPnl, 2)} unrealised P&L</span></article><article><small>AVAILABLE MARGIN</small><strong>{fmt(currentAccount.available_balance)}</strong><span>tNPR ready</span></article><article><small>LOCKED COLLATERAL</small><strong>{fmt(lockedNotional)}</strong><span>{fmt(marginUtilisation, 1)}% utilisation</span></article><article><small>GROSS EXPOSURE</small><strong>{fmt(grossExposure)}</strong><span>{userPositions.length} open positions</span></article><article><small>LIFETIME FUNDING</small><strong>{fmt(currentAccount.funding_total)}</strong><span>{fmt(MAX_FUNDING - currentAccount.funding_total)} remaining</span></article></div>
        <section className="portfolio-grid"><article className="panel positions-panel"><div className="panel-heading"><div><span className="section-kicker">OPEN POSITIONS</span><h2>Matched business hedges</h2></div><span className="balanced-chip"><Scale size={13}/> COUNTERPARTY MATCHED</span></div><div className="position-table"><div className="table-head"><span>Market / side</span><span>Counterparty</span><span>Notional</span><span>Entry</span><span>Live mark</span><span>Unrealised</span><span>Proof</span></div>{userPositions.length === 0 && <div className="empty-state wide">No matched positions yet. Take an open request or post your own.</div>}{userPositions.map((position) => { const market = markets.find((item) => item.id === position.market_id); const counterparty = accountById(position.counterparty_id); const pnl = positionPnl(position); const trade = demo.trades.find((item) => item.match_id === position.match_id); return <div className="table-row" key={position.id}><span><b className={`side-dot ${position.side}`}/><strong>{market?.shortName}</strong><small>{position.side.toUpperCase()}</small></span><span><strong>{counterparty?.company}</strong><small>{counterparty?.role}</small></span><span><strong>{fmt(position.notional)} tNPR</strong></span><span><strong>{fmt(position.entry_price, position.market_id === "usdnpr" ? 3 : 2)}</strong></span><span><strong>{fmt(market?.price ?? position.entry_price, position.market_id === "usdnpr" ? 3 : 2)}</strong></span><span><strong className={pnl >= 0 ? "positive" : "negative"}>{pnl >= 0 ? "+" : ""}{fmt(pnl, 2)}</strong></span><span>{trade?.chain_signature ? <a className="chain-link" href={`https://explorer.solana.com/tx/${trade.chain_signature}?cluster=devnet`} target="_blank" rel="noreferrer">Verified <ExternalLink size={11}/></a> : trade ? <button className="table-button" disabled={busy === `anchor-${trade.id}`} onClick={() => anchorTrade(trade)}>Receipt</button> : <small>—</small>}</span></div>; })}</div></article>
        <aside className="panel exposure-panel"><div className="panel-heading"><div><span className="section-kicker">EXPOSURE MAP</span><h2>Gross and directional risk</h2></div></div><div className="exposure-list">{marketExposure.map((item) => { const label = markets.find((market) => market.id === item.marketId)?.shortName; const width = grossExposure ? item.gross / grossExposure * 100 : 0; return <div key={item.marketId}><span><strong>{label}</strong><small>{fmt(item.gross)} gross</small></span><i><b style={{ width: `${width}%` }}/></i><em className={item.net >= 0 ? "positive" : "negative"}>{item.net >= 0 ? "+" : ""}{fmt(item.net)} net</em></div>; })}</div><div className="portfolio-warning"><LockKeyhole size={15}/><span><strong>Bilateral exit constraint</strong>Your position cannot be closed unilaterally in this model. Counterparty consent is required.</span></div><div className="business-rationale"><BriefcaseBusiness size={17}/><span><strong>Your stated hedge rationale</strong><p>{currentAccount.hedge_story}</p></span></div></aside></section>
        <section className="portfolio-lower"><article className="panel cash-ledger"><div className="panel-heading"><div><span className="section-kicker">PAPER CASH LEDGER</span><h2>Funding and redemptions</h2></div></div>{cashActivity.length === 0 ? <div className="empty-state">No paper cash activity yet.</div> : cashActivity.map((item) => <div className="cash-row" key={item.id}><span className={item.signed > 0 ? "cash-icon in" : "cash-icon out"}>{item.signed > 0 ? <ArrowDownToLine size={14}/> : <ArrowUpFromLine size={14}/>}</span><span><strong>{item.kind}</strong><small>{item.reference}</small></span><time>{dateTime(item.created_at)}</time><b className={item.signed > 0 ? "positive" : "negative"}>{item.signed > 0 ? "+" : ""}{fmt(item.signed)} tNPR</b></div>)}</article><article className="panel collateral-card"><span className="section-kicker">FUTURE REGULATED MODEL</span><h2>From NPR deposit to NPR redemption</h2><div className="mini-flow"><span><Landmark size={16}/><b>Domestic NPR</b></span><ArrowRight/><span><Database size={16}/><b>1:1 tNPR</b></span><ArrowRight/><span><LockKeyhole size={16}/><b>On-chain margin</b></span><ArrowRight/><span><ArrowUpFromLine size={16}/><b>NPR redemption</b></span></div><p>Reserve backing, custody and redemption are a proposed licensed-market design. This prototype has no reserve and transfers no money.</p></article></section>
      </section>}

      {view === "history" && <section className="standard-view"><div className="view-heading"><div><span className="eyebrow">SHARED MARKET LEDGER</span><h1>100-transaction market tape</h1><p>A populated simulation of participant-to-participant USD/NPR and oil hedging activity.</p></div><div className="history-controls"><button className={historyScope === "all" ? "active" : ""} onClick={() => setHistoryScope("all")}><Users size={13}/> All market</button><button className={historyScope === "mine" ? "active" : ""} onClick={() => setHistoryScope("mine")}><ListFilter size={13}/> My trades</button></div></div><article className="panel history-panel"><div className="history-summary"><span><small>VISIBLE TRANSACTIONS</small><strong>{tradeRows.length}</strong></span><span><small>MATCHED NOTIONAL</small><strong>{fmt(tradeRows.reduce((sum, trade) => sum + trade.notional, 0))}</strong></span><span><small>SOLANA RECEIPTS</small><strong>{tradeRows.filter((trade) => trade.chain_signature).length}</strong></span><span><small>PLATFORM TRADES</small><strong>0</strong></span></div><div className="history-table"><div className="history-head"><span>Time</span><span>Market</span><span>Long participant</span><span>Short participant</span><span>Price</span><span>Notional</span><span>Status</span><span>Solana proof</span></div>{tradeRows.map((trade) => { const mine = trade.long_user_id === currentUserId || trade.short_user_id === currentUserId; return <div className="history-row" key={trade.id}><time>{dateTime(trade.created_at)}</time><span><strong>{markets.find((market) => market.id === trade.market_id)?.shortName}</strong><small>{trade.match_id}</small></span><span><strong>{accountById(trade.long_user_id)?.company}</strong><small className="positive">LONG</small></span><span><strong>{accountById(trade.short_user_id)?.company}</strong><small className="negative">SHORT</small></span><span><strong>{fmt(trade.price, trade.market_id === "usdnpr" ? 3 : 2)}</strong></span><span><strong>{fmt(trade.notional)} tNPR</strong></span><span><em className={`status-tag ${trade.status}`}>{trade.status}</em></span><span>{trade.chain_signature ? <a className="chain-link" href={`https://explorer.solana.com/tx/${trade.chain_signature}?cluster=devnet`} target="_blank" rel="noreferrer">Explorer <ExternalLink size={11}/></a> : mine ? <button className="table-button" disabled={busy === `anchor-${trade.id}`} onClick={() => anchorTrade(trade)}>{busy === `anchor-${trade.id}` ? "Signing..." : "Publish"}</button> : <small>Participant only</small>}</span></div>; })}</div></article></section>}

      {view === "model" && <section className="standard-view thesis-view"><div className="view-heading"><div><span className="eyebrow">THE MARKET THESIS</span><h1>Global exposure. Domestic settlement.</h1><p>NPRX explores a permissioned, NPR-denominated way for businesses with opposite risks to hedge one another—without buying the referenced foreign asset.</p></div><span className="zero-exposure"><ShieldCheck size={21}/><span><small>PLATFORM DIRECTIONAL EXPOSURE</small><strong>0 tNPR</strong></span></span></div>
        <div className="macro-strip"><span><small>11-MONTH IMPORTS</small><strong>NPR 1,894.10bn</strong></span><span><small>TRADE DEFICIT</small><strong>NPR 1,616.13bn</strong></span><span><small>BRENT YoY</small><strong className="negative">+16.63%</strong></span><span><small>NPR vs USD</small><strong className="negative">-9.8%</strong></span><a href="https://www.nrb.org.np/red/current-macroeconomic-and-financial-situation-english-based-on-eleven-months-data-of-2025-26/" target="_blank" rel="noreferrer">NRB, 11 months 2025/26 <ExternalLink size={11}/></a></div>
        <article className="panel thesis-hero"><div><span className="section-kicker">WHY A DOMESTIC HEDGE LAB?</span><h2>Nepal has forward contracts. Broad access and an organised exit market remain limited.</h2><p>NRB's study says importers, exporters and manufacturers can hedge FX through Class A commercial banks and national-level Class B development banks. It also found a bank-dominated market, only 12 of 81 surveyed non-financial firms using FX derivatives, and constraints including legal or administrative hurdles, rigidity, cost, short maturity and no exit policy.</p><div className="source-links"><a href="https://www.nrb.org.np/contents/uploads/2021/10/Foreign-Exchange-Derivative-Market-in-Nepal.pdf" target="_blank" rel="noreferrer">Read the NRB market study <ExternalLink size={12}/></a><a href="https://www.nrb.org.np/2023/08/%E0%A4%A8%E0%A5%87%E0%A4%AA%E0%A4%BE%E0%A4%B2%E0%A4%AE%E0%A4%BE-%E0%A4%95%E0%A5%8D%E0%A4%B0%E0%A4%BF%E0%A4%AA%E0%A5%8D%E0%A4%9F%E0%A5%8B%E0%A4%95%E0%A4%B0%E0%A5%87%E0%A4%A8%E0%A5%8D%E0%A4%B8%E0%A5%80/" target="_blank" rel="noreferrer">NRB on capital-account controls <ExternalLink size={12}/></a></div></div><aside><span><strong>Current account</strong><em>Convertible</em></span><span><strong>Capital account</strong><em>Controlled</em></span><span><strong>NPRX reference asset purchase</strong><em>None</em></span><span><strong>Proposed settlement</strong><em>Domestic NPR</em></span></aside></article>
        <div className="use-case-grid"><article className="panel"><span className="case-icon"><ArrowDownToLine/></span><small>USD/NPR · IMPORTER</small><h3>Future dollar invoice</h3><p>An importer is naturally short USD/NPR: dollar appreciation raises its NPR cost. It can request a long USD/NPR hedge.</p></article><article className="panel"><span className="case-icon"><ArrowUpFromLine/></span><small>USD/NPR · EXPORTER</small><h3>Future dollar receipt</h3><p>An exporter is naturally long USD/NPR. It can take the opposite short hedge to stabilise the future NPR value of receipts.</p></article><article className="panel"><span className="case-icon"><Fuel/></span><small>OIL · FUEL USER</small><h3>Costs rise with oil</h3><p>A transport or manufacturing firm is naturally short oil. A long paper hedge can offset part of an oil-price increase.</p></article><article className="panel"><span className="case-icon"><Zap/></span><small>OIL · SOLAR / RENEWABLE</small><h3>Demand can rise with oil</h3><p>A solar company may be economically long oil because high fossil-fuel prices improve its relative value. A short hedge can reduce that sensitivity.</p></article></div>
        <article className="panel blockchain-model"><div><span className="section-kicker">WHY BLOCKCHAIN?</span><h2>Collateral and rules that participants can verify</h2><p>A regulator-observable ledger could lock collateral, create equal and opposite positions atomically, prevent the broker from trading, and make settlement auditable. Full collateral reduces counterparty exposure; it does not eliminate oracle, smart-contract, custody, legal or operational risk.</p><button className="primary-button" onClick={connectWallet}><Wallet size={15}/>{walletAddress ? shortAddress(walletAddress) : "Connect for Devnet receipts"}</button></div><div className="production-flow"><span><Landmark/><b>Deposit NPR</b><small>Licensed domestic rail</small></span><ArrowRight/><span><Database/><b>Mint 1:1 tNPR</b><small>Audited reserves</small></span><ArrowRight/><span><Scale/><b>Match hedges</b><small>Participant only</small></span><ArrowRight/><span><LockKeyhole/><b>Settle on-chain</b><small>NPR difference</small></span><ArrowRight/><span><ArrowUpFromLine/><b>Redeem NPR</b><small>Burn tNPR</small></span></div><div className="honesty-note"><CircleAlert size={15}/><span><strong>Prototype boundary</strong>Today, tNPR is unbacked play money and matching is stored off-chain. Only optional trade receipts use Solana Devnet. A real launch would require legislation, licences, KYC/KYB, reserve audits, approved price governance and regulator supervision.</span></div></article>
        <div className="limitations-grid"><article className="panel"><span>01</span><h3>No unilateral exit</h3><p>A counterparty must consent to an offset or novation. This prototype does not implement exits.</p></article><article className="panel"><span>02</span><h3>No house liquidity</h3><p>Orders match only when another participant accepts the opposite side.</p></article><article className="panel"><span>03</span><h3>No capital export</h3><p>The concept is a domestic cash-settled index exposure, not ownership of USD, oil or overseas securities.</p></article><article className="panel"><span>04</span><h3>Permission required</h3><p>This simulation is not evidence that a public exchange is currently authorised in Nepal.</p></article></div>
      </section>}
    </div>

    <footer><div className="footer-brand"><span className="brand-mark small">N</span><span><strong>NPRX Global</strong><small>SOLANA-ENABLED PAPER MARKET</small></span></div><p>Educational hackathon simulation only. No real money, reserve, deposit, derivative, settlement, custody or investment service. Quotes are indicative.</p><span>Devnet · paper-v0.4</span></footer>
    {cashMode && <CashModal mode={cashMode} account={currentAccount} busy={busy === cashMode || busy === "fund" || busy === "withdraw"} onClose={() => setCashMode(null)} onSubmit={cashAction}/>}
  </main>;
}

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
  Clock3,
  Database,
  ExternalLink,
  Fuel,
  Globe2,
  Landmark,
  Link2,
  ListFilter,
  LockKeyhole,
  LogIn,
  LogOut,
  Plus,
  Radio,
  RefreshCw,
  Scale,
  Search,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
  X,
  Zap,
} from "lucide-react";
import { FormEvent, MouseEvent, useCallback, useEffect, useMemo, useState } from "react";

const MEMO_PROGRAM_ID = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr";
const DEMO_PASSWORD = "hedge123";

type View = "trade" | "orders" | "portfolio" | "history" | "proof";
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

type NrbReference = { date?: string; buy: number; sell: number; mid: number; provider: string };
type DemoAccount = { id: string; email: string; display_name: string; company: string; role: string; hedge_story: string; available_balance: number };
type DemoOrder = { id: string; user_id: string; market_id: MarketId; side: Side; notional: number; posted_price: number; status: string; created_at: string };
type DemoPosition = { id: string; match_id: string; user_id: string; counterparty_id: string; market_id: MarketId; side: Side; notional: number; entry_price: number; status: string; created_at: string; signature?: string | null };
type DemoTrade = { id: string; match_id: string; market_id: MarketId; long_user_id: string; short_user_id: string; notional: number; price: number; status: "matched" | "settled"; chain_signature?: string | null; created_at: string };
type DemoDeposit = { id: string; user_id: string; amount: number; reference: string; rail: string; created_at: string };
type DemoAudit = { id: string; kind: string; actor_id?: string | null; title: string; detail: string; created_at: string };
type DemoState = { accounts: DemoAccount[]; orders: DemoOrder[]; positions: DemoPosition[]; trades: DemoTrade[]; deposits: DemoDeposit[]; audit: DemoAudit[] };

type BrowserWallet = {
  publicKey?: { toString: () => string };
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

const personaCatalog = [
  { id: "person1", initials: "AS", name: "Asha Shrestha", company: "Himal Agro Imports", email: "asha@himalagro.demo", tag: "Oil importer" },
  { id: "person2", initials: "BK", name: "Bikash Karki", company: "Surya Solar Nepal", email: "bikash@suryasolar.demo", tag: "Solar operator" },
  { id: "person3", initials: "NG", name: "Nima Gurung", company: "Everest Freight & Logistics", email: "nima@everestfreight.demo", tag: "Freight operator" },
  { id: "person4", initials: "MR", name: "Maya Rana", company: "Annapurna Garment Exports", email: "maya@annapurnaexports.demo", tag: "USD exporter" },
];

const fallbackMarkets: Market[] = [
  { id: "wti", symbol: "CL=F", name: "WTI Crude Oil", shortName: "WTI", unit: "USD / barrel", hedgeUse: "Fuel, transport and energy-input costs", price: 87.5, previousClose: 84.34, change: 3.16, changePct: 3.75, updatedAt: new Date().toISOString(), marketState: "LOADING", points: [84.34,84.8,85.3,84.9,85.7,86.1,85.8,86.6,87.1,87.5].map((value,index)=>({value,time:Date.now()/1000-(9-index)*300})), provider: "Loading indicative quote", isFallback: true },
  { id: "brent", symbol: "BZ=F", name: "Brent Crude Oil", shortName: "BRENT", unit: "USD / barrel", hedgeUse: "Imported petroleum and global freight exposure", price: 94.18, previousClose: 91.01, change: 3.17, changePct: 3.48, updatedAt: new Date().toISOString(), marketState: "LOADING", points: [91.01,91.4,91.8,92.1,91.9,92.6,93.1,93.7,93.9,94.18].map((value,index)=>({value,time:Date.now()/1000-(9-index)*300})), provider: "Loading indicative quote", isFallback: true },
  { id: "usdnpr", symbol: "NPR=X", name: "USD / NPR", shortName: "USD/NPR", unit: "NPR per USD", hedgeUse: "Dollar invoices, imports and currency budgets", price: 154.242, previousClose: 153.983, change: .259, changePct: .17, updatedAt: new Date().toISOString(), marketState: "LOADING", points: [153.98,154.01,154.04,154.02,154.08,154.11,154.09,154.16,154.19,154.242].map((value,index)=>({value,time:Date.now()/1000-(9-index)*300})), provider: "Loading indicative quote", isFallback: true },
];

const emptyDemo: DemoState = { accounts: [], orders: [], positions: [], trades: [], deposits: [], audit: [] };
const fmt = (amount: number, digits = 0) => new Intl.NumberFormat("en-NP", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(amount);
const shortAddress = (value: string) => `${value.slice(0, 4)}...${value.slice(-4)}`;
const opposite = (side: Side): Side => side === "long" ? "short" : "long";
const marketIcon = (id: MarketId) => id === "usdnpr" ? <Globe2 size={17} /> : <Fuel size={17} />;
const initials = (name = "Demo User") => name.split(" ").map((part) => part[0]).join("").slice(0, 2);
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
  const width = 900;
  const height = 320;
  const pad = { left: 58, right: 22, top: 18, bottom: 36 };
  const points = market.points.length > 1 ? market.points : [{ value: market.previousClose, time: Date.now()/1000-300 }, { value: market.price, time: Date.now()/1000 }];
  const values = points.map((point) => point.value);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const buffer = Math.max((rawMax - rawMin) * .12, market.price * .001);
  const min = rawMin - buffer;
  const max = rawMax + buffer;
  const chartW = width - pad.left - pad.right;
  const chartH = height - pad.top - pad.bottom;
  const coords = points.map((point, index) => ({
    x: pad.left + (index / Math.max(points.length - 1, 1)) * chartW,
    y: pad.top + (1 - (point.value - min) / Math.max(max - min, .0001)) * chartH,
    ...point,
  }));
  const line = coords.map((point, index) => `${index ? "L" : "M"}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
  const area = `${line} L${coords.at(-1)?.x},${height-pad.bottom} L${coords[0].x},${height-pad.bottom} Z`;
  const positive = market.change >= 0;
  const active = coords[hover ?? coords.length - 1];
  const xLabels = [...new Set([0, Math.floor((points.length-1)/3), Math.floor((points.length-1)*2/3), points.length-1])];

  const move = (event: MouseEvent<SVGSVGElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const localX = ((event.clientX - box.left) / box.width) * width;
    const index = Math.round(((localX - pad.left) / chartW) * (points.length - 1));
    setHover(Math.max(0, Math.min(points.length - 1, index)));
  };

  return (
    <div className={`line-chart ${positive ? "up" : "down"}`}>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${market.name} intraday indicative price line chart`} onMouseMove={move} onMouseLeave={() => setHover(null)}>
        <defs><linearGradient id={`fill-${market.id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={positive ? "#19a77a" : "#d44d58"} stopOpacity=".2"/><stop offset="100%" stopColor={positive ? "#19a77a" : "#d44d58"} stopOpacity="0"/></linearGradient></defs>
        {[0,.25,.5,.75,1].map((step) => {
          const y = pad.top + step * chartH;
          const label = max - step * (max-min);
          return <g key={step}><line className="chart-gridline" x1={pad.left} x2={width-pad.right} y1={y} y2={y}/><text className="chart-axis-label" x={pad.left-10} y={y+3} textAnchor="end">{fmt(label, market.id === "usdnpr" ? 3 : 2)}</text></g>;
        })}
        {xLabels.map((index) => <text className="chart-axis-label" key={index} x={coords[index].x} y={height-10} textAnchor={index === 0 ? "start" : index === points.length-1 ? "end" : "middle"}>{new Date(points[index].time*1000).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"})}</text>)}
        <path d={area} fill={`url(#fill-${market.id})`} />
        <path className="price-line" d={line} fill="none" vectorEffect="non-scaling-stroke" />
        <line className="crosshair" x1={active.x} x2={active.x} y1={pad.top} y2={height-pad.bottom}/>
        <circle className="chart-point" cx={active.x} cy={active.y} r="5" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="chart-tooltip" style={{ left: `${Math.min(86, Math.max(12, active.x/width*100))}%`, top: `${Math.max(3, active.y/height*100-2)}%` }}><strong>{fmt(active.value, market.id === "usdnpr" ? 3 : 2)}</strong><span>{new Date(active.time*1000).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"})}</span></div>
    </div>
  );
}

function LoginScreen({ onLogin }: { onLogin: (id: string) => void }) {
  const [email, setEmail] = useState(personaCatalog[0].email);
  const [password, setPassword] = useState(DEMO_PASSWORD);
  const [error, setError] = useState("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const persona = personaCatalog.find((item) => item.email === email.trim().toLowerCase());
    if (!persona || password !== DEMO_PASSWORD) { setError("Use a listed demo email and the password hedge123."); return; }
    onLogin(persona.id);
  };
  return (
    <main className="login-shell">
      <section className="login-story">
        <div className="login-brand"><span className="brand-mark">N</span><span><strong>NPRX</strong><small>GLOBAL</small></span></div>
        <div className="story-copy"><span className="eyebrow">SOLANA DEVNET PAPER MARKET</span><h1>Hedge global costs. Settle the story locally.</h1><p>Nepali businesses budget in NPR while fuel, freight and dollar invoices move globally. NPRX makes that risk visible and lets businesses test matched hedges without real money.</p></div>
        <div className="story-stats"><span><strong>3</strong><small>live references</small></span><span><strong>4</strong><small>business personas</small></span><span><strong>0</strong><small>platform exposure</small></span></div>
      </section>
      <section className="login-panel"><form className="login-card" onSubmit={submit}>
        <span className="secure-chip"><LockKeyhole size={13}/> DEMO PERSONAS</span><h2>Enter the paper market</h2><p>Choose a business with a real hedging use case. Every account shares the same order book.</p>
        <div className="persona-grid">{personaCatalog.map((persona) => <button type="button" className="persona-button" key={persona.id} onClick={()=>onLogin(persona.id)}><span className={`avatar ${persona.id}`}>{persona.initials}</span><span><strong>{persona.name}</strong><small>{persona.company}</small><em>{persona.tag}</em></span><ArrowRight size={15}/></button>)}</div>
        <div className="or-divider"><span>or use demo credentials</span></div>
        <label className="login-label">Email<input value={email} onChange={(event)=>setEmail(event.target.value)} type="email" autoComplete="username"/></label>
        <label className="login-label">Password<input value={password} onChange={(event)=>setPassword(event.target.value)} type="password" autoComplete="current-password"/></label>
        {error && <div className="form-error"><CircleAlert size={14}/>{error}</div>}
        <button className="primary-button login-submit" type="submit"><LogIn size={16}/> Log in to demo</button>
        <p className="demo-note"><ShieldCheck size={13}/> Demo persona selector only. No real identity, bank account, or money.</p>
      </form></section>
    </main>
  );
}

export default function Home() {
  const [view, setView] = useState<View>("trade");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [demo, setDemo] = useState<DemoState>(emptyDemo);
  const [markets, setMarkets] = useState<Market[]>(fallbackMarkets);
  const [nrbReference, setNrbReference] = useState<NrbReference | null>(null);
  const [activeMarketId, setActiveMarketId] = useState<MarketId>("wti");
  const [side, setSide] = useState<Side>("long");
  const [notional, setNotional] = useState(10_000);
  const [historyScope, setHistoryScope] = useState<"all"|"mine">("all");
  const [loadingState, setLoadingState] = useState(true);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [depositOpen, setDepositOpen] = useState(false);
  const [depositStep, setDepositStep] = useState<"form"|"confirm"|"success">("form");
  const [depositAmount, setDepositAmount] = useState(100_000);
  const [depositReference, setDepositReference] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [walletProvider, setWalletProvider] = useState<BrowserWallet|null>(null);

  const fetchDemo = useCallback(async (quiet=false) => {
    try { const response = await fetch("/api/demo",{cache:"no-store"}); const payload = await response.json() as DemoState & {error?:string}; if(!response.ok) throw new Error(payload.error ?? "Shared demo state unavailable"); setDemo(payload); if(!quiet) setError(""); }
    catch(cause){ if(!quiet) setError(cause instanceof Error ? cause.message : "Could not load the shared demo"); }
    finally{ if(!quiet) setLoadingState(false); }
  },[]);
  const fetchMarkets = useCallback(async()=>{ try{ const response=await fetch("/api/markets",{cache:"no-store"}); if(!response.ok) throw new Error(); const payload=await response.json() as {markets:Market[];nrbReference:NrbReference|null}; if(payload.markets?.length) setMarkets(payload.markets); setNrbReference(payload.nrbReference??null); }catch{} },[]);

  useEffect(()=>{ const saved=window.sessionStorage.getItem("nprx-demo-user"); if(personaCatalog.some((item)=>item.id===saved)) setCurrentUserId(saved); fetchDemo(); fetchMarkets(); const a=window.setInterval(()=>fetchDemo(true),8000); const b=window.setInterval(fetchMarkets,30000); return()=>{window.clearInterval(a);window.clearInterval(b)}; },[fetchDemo,fetchMarkets]);

  const currentAccount=demo.accounts.find((account)=>account.id===currentUserId);
  const activeMarket=markets.find((market)=>market.id===activeMarketId)??markets[0];
  const accountById=(id:string)=>demo.accounts.find((account)=>account.id===id);
  const userPositions=demo.positions.filter((position)=>position.user_id===currentUserId);
  const userOrders=demo.orders.filter((order)=>order.user_id===currentUserId);
  const userTrades=demo.trades.filter((trade)=>trade.long_user_id===currentUserId||trade.short_user_id===currentUserId);
  const lockedNotional=[...userPositions,...userOrders].reduce((sum,item)=>sum+item.notional,0);
  const positionPnl=useCallback((position:DemoPosition)=>{ const mark=markets.find((market)=>market.id===position.market_id)?.price??position.entry_price; const direction=position.side==="long"?1:-1; return direction*position.notional*(mark/position.entry_price-1); },[markets]);
  const unrealisedPnl=userPositions.reduce((sum,position)=>sum+positionPnl(position),0);
  const equity=(currentAccount?.available_balance??0)+lockedNotional+unrealisedPnl;
  const totalLong=demo.positions.filter((position)=>position.side==="long").reduce((sum,position)=>sum+position.notional,0);
  const totalShort=demo.positions.filter((position)=>position.side==="short").reduce((sum,position)=>sum+position.notional,0);
  const openInterest=Math.min(totalLong,totalShort);
  const activeValues=activeMarket.points.map((point)=>point.value);
  const sessionOpen=activeValues[0]??activeMarket.previousClose;
  const sessionHigh=Math.max(...(activeValues.length?activeValues:[activeMarket.price]));
  const sessionLow=Math.min(...(activeValues.length?activeValues:[activeMarket.price]));

  const login=(id:string)=>{ window.sessionStorage.setItem("nprx-demo-user",id); setCurrentUserId(id); setSide(id==="person2"||id==="person4"?"short":"long"); setView("trade"); setError(""); if(!window.sessionStorage.getItem(`nprx-deposit-seen-${id}`)){setDepositStep("form");setDepositOpen(true);} };
  const logout=()=>{window.sessionStorage.removeItem("nprx-demo-user");setCurrentUserId(null);setDepositOpen(false);setNotice("");};
  const postAction=async(payload:Record<string,unknown>,label:string)=>{ if(!currentUserId)return null;setBusy(label);setError("");setNotice("");try{const response=await fetch("/api/demo",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...payload,userId:currentUserId})});const result=await response.json() as {error?:string;state?:DemoState;reference?:string;tradeId?:string};if(!response.ok)throw new Error(result.error??"Demo action failed");if(result.state)setDemo(result.state);return result;}catch(cause){setError(cause instanceof Error?cause.message:"Demo action failed");return null;}finally{setBusy("");}};
  const placeOrder=async()=>{const result=await postAction({action:"place_order",marketId:activeMarket.id,side,notional,postedPrice:activeMarket.price},"place-order");if(result){setNotice(`${side.toUpperCase()} ${activeMarket.shortName} request posted to the shared paper order book.`);setView("orders");}};
  const takeOrder=async(order:DemoOrder)=>{const market=markets.find((item)=>item.id===order.market_id);const matchPrice=market?.price??order.posted_price;const result=await postAction({action:"take_order",orderId:order.id,matchPrice},`take-${order.id}`);if(result){setNotice(`Paper trade matched at ${fmt(matchPrice,order.market_id==="usdnpr"?3:2)}. Initial P&L is 0.00 tNPR.`);setView("history");setHistoryScope("mine");}};
  const cancelOrder=async(order:DemoOrder)=>{if(await postAction({action:"cancel_order",orderId:order.id},`cancel-${order.id}`))setNotice(`${fmt(order.notional)} tNPR margin released.`);};
  const submitDeposit=async()=>{const result=await postAction({action:"deposit",amount:depositAmount},"deposit");if(result?.reference){setDepositReference(result.reference);setDepositStep("success");}};
  const closeDeposit=()=>{if(currentUserId)window.sessionStorage.setItem(`nprx-deposit-seen-${currentUserId}`,"yes");setDepositOpen(false);setDepositStep("form");};

  const connectWallet=async()=>{setError("");const provider=window.phantom?.solana??window.solana??window.solflare??null;if(!provider){setError("No compatible wallet found. Install Phantom or Solflare to publish a Devnet receipt.");return;}try{const response=await provider.connect();setWalletProvider(provider);setWalletAddress(response.publicKey.toString());setNotice("Wallet connected to Solana Devnet receipt mode.");}catch{setError("Wallet connection was cancelled.");}};
  const anchorTrade=async(trade:DemoTrade)=>{
    if(!walletProvider||!walletAddress){setError("Connect a Solana wallet before publishing a Devnet receipt.");return;}
    setBusy(`anchor-${trade.id}`);setError("");setNotice("Preparing the signed Devnet receipt...");
    try{
      const [{AnchorProvider,web3},{Buffer}]=await Promise.all([import("@coral-xyz/anchor/dist/browser/index.js"),import("buffer")]);
      (globalThis as unknown as {Buffer:typeof Buffer}).Buffer=Buffer;
      const publicKey=new web3.PublicKey(walletAddress);
      const anchorWallet={publicKey,signTransaction:walletProvider.signTransaction.bind(walletProvider),signAllTransactions:walletProvider.signAllTransactions?.bind(walletProvider)??(async<T,>(transactions:T[])=>Promise.all(transactions.map((transaction)=>walletProvider.signTransaction(transaction))))};
      const provider=new AnchorProvider(new web3.Connection(web3.clusterApiUrl("devnet"),"confirmed"),anchorWallet as never,{commitment:"confirmed",preflightCommitment:"confirmed"});
      const memo=Buffer.from(JSON.stringify({app:"NPRX Global",version:"paper-v0.3",action:"PAPER_TRADE_RECEIPT",trade:trade.id,match:trade.match_id,market:trade.market_id,long:trade.long_user_id,short:trade.short_user_id,notional_tnpr:trade.notional,price:trade.price,disclaimer:"PAPER TRADE - NO MONETARY VALUE"}),"utf8");
      const transaction=new web3.Transaction().add(new web3.TransactionInstruction({programId:new web3.PublicKey(MEMO_PROGRAM_ID),keys:[{pubkey:publicKey,isSigner:true,isWritable:false}],data:memo}));
      const signature=await provider.sendAndConfirm(transaction,[]);
      const response=await fetch("/api/demo",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"attach_signature",userId:currentUserId,tradeId:trade.id,signature})});
      const result=await response.json() as {error?:string;state?:DemoState};if(!response.ok)throw new Error(result.error??"Receipt could not be attached");if(result.state)setDemo(result.state);setNotice("Solana Devnet receipt confirmed and attached to the shared trade record.");
    }catch(cause){setError(cause instanceof Error?cause.message:"The Devnet receipt was not completed. The paper trade is unchanged.");}finally{setBusy("");}
  };

  if(!currentUserId)return <LoginScreen onLogin={login}/>;

  const tickerTape=<section className="ticker-tape" aria-label="Market ticker">{markets.map((market)=><button className={activeMarket.id===market.id?"active":""} key={market.id} onClick={()=>{setActiveMarketId(market.id);setView("trade")}}><span className="ticker-icon">{marketIcon(market.id)}</span><span><strong>{market.shortName}</strong><small>{market.unit}</small></span><b>{fmt(market.price,market.id==="usdnpr"?3:2)}</b><em className={market.change>=0?"positive":"negative"}>{market.change>=0?"+":""}{fmt(market.changePct,2)}%</em></button>)}</section>;

  const orderBook=<article className="panel orderbook-panel"><div className="panel-heading"><div><span className="section-kicker">PARTICIPANT LIQUIDITY</span><h2>Open hedge requests</h2></div><span className="sync-label"><RefreshCw size={12}/> 8s sync</span></div><div className="order-list">{demo.orders.map((order)=>{const owner=accountById(order.user_id);const market=markets.find((item)=>item.id===order.market_id);const own=order.user_id===currentUserId;return <div className="order-row" key={order.id}><span className={`side-badge ${order.side}`}>{order.side.toUpperCase()}</span><div className="order-identity"><strong>{market?.shortName} · {owner?.company}</strong><span>{owner?.display_name} · {timeAgo(order.created_at)}</span></div><div><small>POSTED</small><strong>{fmt(order.posted_price,order.market_id==="usdnpr"?3:2)}</strong></div><div><small>NOTIONAL</small><strong>{fmt(order.notional)} tNPR</strong></div>{own?<button className="table-button" disabled={busy===`cancel-${order.id}`} onClick={()=>cancelOrder(order)}>Cancel</button>:<button className={`take-button ${opposite(order.side)}`} disabled={busy===`take-${order.id}`} onClick={()=>takeOrder(order)}>{busy===`take-${order.id}`?"Matching...":`Take ${opposite(order.side)}`}</button>}</div>})}</div></article>;

  const tradeRows=(historyScope==="mine"?userTrades:demo.trades);

  return <main className="app-shell">
    <div className="simulation-banner"><span className="live-dot"/> PAPER TRADING · SOLANA DEVNET <i/> tNPR has no value <i/> Indicative/delayed quotes <i/> Participant-only open interest</div>
    <header className="topbar"><button className="brand" onClick={()=>setView("trade")}><span className="brand-mark">N</span><span><strong>NPRX</strong><small>GLOBAL</small></span></button><nav className="main-nav"><button className={view==="trade"?"active":""} onClick={()=>setView("trade")}>Trade</button><button className={view==="orders"?"active":""} onClick={()=>setView("orders")}>Orders <b>{demo.orders.length}</b></button><button className={view==="portfolio"?"active":""} onClick={()=>setView("portfolio")}>Portfolio</button><button className={view==="history"?"active":""} onClick={()=>setView("history")}>Transactions</button><button className={view==="proof"?"active":""} onClick={()=>setView("proof")}>Solana & Proof</button></nav><div className="header-actions"><span className="feed-status"><i/> FEEDS ACTIVE</span><button className="fund-button" onClick={()=>{setDepositStep("form");setDepositOpen(true)}}><Plus size={13}/> Funds</button><div className="user-chip"><span className="avatar mini">{initials(currentAccount?.display_name)}</span><span><strong>{currentAccount?.display_name??"Demo user"}</strong><small>{currentAccount?.company}</small></span><ChevronDown size={13}/></div><button className="icon-button" onClick={logout} aria-label="Switch demo account"><LogOut size={15}/></button></div></header>
    {tickerTape}
    {(error||notice)&&<div className={`status-message ${error?"error":"success"}`}>{error?<CircleAlert size={15}/>:<CheckCircle2 size={15}/>}<span>{error||notice}</span><button onClick={()=>{setError("");setNotice("")}}><X size={14}/></button></div>}

    <div className="workspace">{loadingState&&demo.accounts.length===0?<div className="loading-card"><RefreshCw className="spin"/> Loading paper market...</div>:<>
      {view==="trade"&&<>
        <section className="account-ribbon"><div><span className="avatar">{initials(currentAccount?.display_name)}</span><span><small>PAPER ACCOUNT</small><strong>{currentAccount?.company}</strong><em>{currentAccount?.role}</em></span></div><div><small>EQUITY</small><strong>{fmt(equity,2)} tNPR</strong></div><div><small>AVAILABLE</small><strong>{fmt(currentAccount?.available_balance??0)} tNPR</strong></div><div><small>UNREALISED P&L</small><strong className={unrealisedPnl>=0?"positive":"negative"}>{unrealisedPnl>=0?"+":""}{fmt(unrealisedPnl,2)} tNPR</strong></div><div><small>OPEN POSITIONS</small><strong>{userPositions.length}</strong></div></section>
        <section className="trading-grid"><article className="panel chart-panel"><div className="chart-heading"><div className="instrument-heading"><span className="instrument-icon">{marketIcon(activeMarket.id)}</span><span><small>{activeMarket.symbol} · PAPER FUTURE</small><strong>{activeMarket.name}</strong><em>{activeMarket.hedgeUse}</em></span></div><div className="quote-block"><small>INDICATIVE MARK</small><strong>{fmt(activeMarket.price,activeMarket.id==="usdnpr"?3:2)}</strong><span className={activeMarket.change>=0?"positive":"negative"}>{activeMarket.change>=0?"+":""}{fmt(activeMarket.change,3)} ({activeMarket.change>=0?"+":""}{fmt(activeMarket.changePct,2)}%)</span></div></div><div className="chart-toolbar"><span><button className="active">1D</button><button disabled>1W</button><button disabled>1M</button></span><span><Radio size={12}/>{activeMarket.provider}</span></div><MarketLineChart market={activeMarket}/><div className="market-stats"><span><small>OPEN</small><strong>{fmt(sessionOpen,activeMarket.id==="usdnpr"?3:2)}</strong></span><span><small>HIGH</small><strong>{fmt(sessionHigh,activeMarket.id==="usdnpr"?3:2)}</strong></span><span><small>LOW</small><strong>{fmt(sessionLow,activeMarket.id==="usdnpr"?3:2)}</strong></span><span><small>PREV CLOSE</small><strong>{fmt(activeMarket.previousClose,activeMarket.id==="usdnpr"?3:2)}</strong></span><span><small>UPDATED</small><strong>{timeAgo(activeMarket.updatedAt)}</strong></span></div>{activeMarket.id==="usdnpr"&&nrbReference&&<div className="nrb-strip"><Landmark size={15}/><span><strong>NRB official daily reference · {nrbReference.date}</strong><small>Buy {fmt(nrbReference.buy,2)} · Sell {fmt(nrbReference.sell,2)} · Mid {fmt(nrbReference.mid,2)}</small></span></div>}</article>
        <aside className="panel order-ticket"><div className="panel-heading"><div><span className="section-kicker">PAPER ORDER</span><h2>{activeMarket.shortName}</h2></div><span className="paper-chip">NO REAL MONEY</span></div><div className="ticket-quote"><span>Indicative execution</span><strong>{fmt(activeMarket.price,activeMarket.id==="usdnpr"?3:2)}</strong></div><div className="side-toggle"><button className={side==="long"?"active long":""} onClick={()=>setSide("long")}><TrendingUp size={15}/> Long</button><button className={side==="short"?"active short":""} onClick={()=>setSide("short")}><TrendingDown size={15}/> Short</button></div><p className="side-explainer">{side==="long"?"Protect against a rise in this business cost.":"Take the opposing view or protect against a fall."}</p><label className="field-label">Notional <small>tNPR</small></label><div className="amount-input"><input type="number" min="10000" max="250000" step="10000" value={notional} onChange={(event)=>setNotional(Number(event.target.value))}/><span>tNPR</span></div><div className="amount-presets">{[10000,25000,50000,100000].map((amount)=><button key={amount} onClick={()=>setNotional(amount)}>{fmt(amount/1000)}K</button>)}</div><div className="ticket-summary"><span><small>Margin reserved</small><strong>{fmt(notional)} tNPR</strong></span><span><small>Initial P&L when matched</small><strong>0.00 tNPR</strong></span><span><small>Platform inventory</small><strong className="positive">0 tNPR</strong></span></div><button className={`primary-button submit-order ${side}`} disabled={busy==="place-order"||notional>(currentAccount?.available_balance??0)} onClick={placeOrder}>{busy==="place-order"?"Posting...":`Post ${side} request`}<ArrowRight size={15}/></button><p className="ticket-note"><LockKeyhole size={12}/> 100% test margin. A position starts only when another business accepts.</p></aside></section>
        <section className="lower-grid">{orderBook}<article className="panel recent-panel"><div className="panel-heading"><div><span className="section-kicker">MARKET TAPE</span><h2>Recent matches</h2></div><button className="link-button" onClick={()=>setView("history")}>All transactions <ArrowRight size={12}/></button></div><div className="compact-trades">{demo.trades.slice(0,5).map((trade)=><div key={trade.id}><span className="trade-market">{markets.find((market)=>market.id===trade.market_id)?.shortName}</span><span><strong>{fmt(trade.price,trade.market_id==="usdnpr"?3:2)}</strong><small>{dateTime(trade.created_at)}</small></span><b>{fmt(trade.notional)} tNPR</b><em className={trade.status==="matched"?"open":"settled"}>{trade.status}</em></div>)}</div></article></section>
      </>}

      {view==="orders"&&<section className="standard-view"><div className="view-heading"><div><span className="eyebrow">SHARED PAPER LIQUIDITY</span><h1>Participant order book</h1><p>Open requests do not count as positions until a different business accepts the opposite side.</p></div><span className="structure-callout"><Users size={19}/><span><strong>{demo.accounts.length} demo businesses</strong><small>No house trading account</small></span></span></div>{tickerTape}{orderBook}<article className="panel participant-panel"><div className="panel-heading"><div><span className="section-kicker">MARKET PARTICIPANTS</span><h2>Businesses behind the liquidity</h2></div></div><div className="participant-grid">{demo.accounts.map((account)=><div key={account.id}><span className={`avatar ${account.id}`}>{initials(account.display_name)}</span><span><strong>{account.company}</strong><small>{account.display_name} · {account.role}</small><p>{account.hedge_story}</p></span></div>)}</div></article></section>}

      {view==="portfolio"&&<section className="standard-view"><div className="view-heading"><div><span className="eyebrow">PAPER PORTFOLIO</span><h1>{currentAccount?.company}</h1><p>Live mark-to-market exposure from equal and opposite participant matches. Exits are not part of this MVP.</p></div><div className="equity-card"><small>TOTAL TEST EQUITY</small><strong>{fmt(equity,2)} tNPR</strong><span className={unrealisedPnl>=0?"positive":"negative"}>{unrealisedPnl>=0?"+":""}{fmt(unrealisedPnl,2)} unrealised</span></div></div><article className="panel positions-panel"><div className="panel-heading"><div><span className="section-kicker">OPEN POSITIONS</span><h2>{userPositions.length} participant hedges</h2></div><span className="balanced-chip"><Scale size={13}/> 100% matched</span></div><div className="position-table"><div className="table-head"><span>Market / side</span><span>Counterparty</span><span>Notional</span><span>Entry</span><span>Live mark</span><span>Unrealised P&L</span><span>Solana</span></div>{userPositions.map((position)=>{const market=markets.find((item)=>item.id===position.market_id);const counterparty=accountById(position.counterparty_id);const pnl=positionPnl(position);const trade=demo.trades.find((item)=>item.match_id===position.match_id);return <div className="table-row" key={position.id}><span><b className={`side-dot ${position.side}`}/><strong>{market?.shortName}</strong><small>{position.side.toUpperCase()}</small></span><span><strong>{counterparty?.company}</strong><small>{counterparty?.display_name}</small></span><span><strong>{fmt(position.notional)} tNPR</strong></span><span><strong>{fmt(position.entry_price,position.market_id==="usdnpr"?3:2)}</strong></span><span><strong>{fmt(market?.price??position.entry_price,position.market_id==="usdnpr"?3:2)}</strong></span><span><strong className={pnl>=0?"positive":"negative"}>{pnl>=0?"+":""}{fmt(pnl,2)} tNPR</strong></span><span>{trade?.chain_signature?<a className="chain-link" href={`https://explorer.solana.com/tx/${trade.chain_signature}?cluster=devnet`} target="_blank" rel="noreferrer">Verified <ExternalLink size={11}/></a>:trade?<button className="table-button" disabled={busy===`anchor-${trade.id}`} onClick={()=>anchorTrade(trade)}>Receipt</button>:<small>—</small>}</span></div>})}</div></article><div className="balance-grid"><article className="panel balance-panel"><span><small>AVAILABLE MARGIN</small><strong>{fmt(currentAccount?.available_balance??0)} tNPR</strong></span><span><small>LOCKED MARGIN</small><strong>{fmt(lockedNotional)} tNPR</strong></span><button className="secondary-button" onClick={()=>{setDepositStep("form");setDepositOpen(true)}}><ArrowDownToLine size={14}/> Add test funds</button></article><article className="panel exposure-note"><BriefcaseBusiness size={18}/><span><strong>Business rationale</strong><p>{currentAccount?.hedge_story}</p></span></article></div></section>}

      {view==="history"&&<section className="standard-view"><div className="view-heading"><div><span className="eyebrow">SHARED MARKET LEDGER</span><h1>Transaction history</h1><p>Matched and settled paper trades across all four demo businesses, with optional Solana Devnet proof.</p></div><div className="history-controls"><button className={historyScope==="all"?"active":""} onClick={()=>setHistoryScope("all")}><Users size={13}/> All market</button><button className={historyScope==="mine"?"active":""} onClick={()=>setHistoryScope("mine")}><ListFilter size={13}/> My trades</button></div></div><article className="panel history-panel"><div className="history-summary"><span><small>TRANSACTIONS</small><strong>{tradeRows.length}</strong></span><span><small>MATCHED NOTIONAL</small><strong>{fmt(tradeRows.reduce((sum,trade)=>sum+trade.notional,0))} tNPR</strong></span><span><small>SOLANA RECEIPTS</small><strong>{tradeRows.filter((trade)=>trade.chain_signature).length}</strong></span><span><small>MARKETS</small><strong>3</strong></span></div><div className="history-table"><div className="history-head"><span>Time</span><span>Market</span><span>Long participant</span><span>Short participant</span><span>Price</span><span>Notional</span><span>Status</span><span>Solana proof</span></div>{tradeRows.map((trade)=>{const mine=trade.long_user_id===currentUserId||trade.short_user_id===currentUserId;return <div className="history-row" key={trade.id}><time>{dateTime(trade.created_at)}</time><span><strong>{markets.find((market)=>market.id===trade.market_id)?.shortName}</strong><small>{trade.match_id}</small></span><span><strong>{accountById(trade.long_user_id)?.company}</strong><small className="positive">LONG</small></span><span><strong>{accountById(trade.short_user_id)?.company}</strong><small className="negative">SHORT</small></span><span><strong>{fmt(trade.price,trade.market_id==="usdnpr"?3:2)}</strong></span><span><strong>{fmt(trade.notional)} tNPR</strong></span><span><em className={`status-tag ${trade.status}`}>{trade.status}</em></span><span>{trade.chain_signature?<a className="chain-link" href={`https://explorer.solana.com/tx/${trade.chain_signature}?cluster=devnet`} target="_blank" rel="noreferrer">Explorer <ExternalLink size={11}/></a>:mine?<button className="table-button" disabled={busy===`anchor-${trade.id}`} onClick={()=>anchorTrade(trade)}>{busy===`anchor-${trade.id}`?"Signing...":"Publish"}</button>:<small>Participant only</small>}</span></div>})}</div></article></section>}

      {view==="proof"&&<section className="standard-view"><div className="view-heading"><div><span className="eyebrow">SOLANA DEVNET + TRANSPARENT RISK</span><h1>Paper execution, public proof.</h1><p>NPRX keeps simulated balances and matching in a shared database while participants can publish signed trade receipts to Solana’s deployed Memo Program.</p></div><span className="zero-exposure"><ShieldCheck size={21}/><span><small>PLATFORM DIRECTIONAL EXPOSURE</small><strong>0 tNPR</strong></span></span></div><div className="proof-grid"><article className="panel problem-panel"><div><span className="section-kicker">THE PROBLEM</span><h2>Global prices move. Local budgets absorb the shock.</h2><p>Nepali importers, logistics companies and exporters face oil and USD/NPR volatility without an accessible place to practise transparent local hedging.</p></div><ArrowRight size={20}/><div><span className="section-kicker">THE NPRX USE CASE</span><h2>A paper market for opposite business exposures.</h2><p>Businesses test long and short hedges with one another, while a public Solana receipt can make each matched trade independently verifiable.</p></div></article><article className="panel solana-card"><span className="solana-icon"><Zap size={25}/></span><span className="section-kicker">FUNCTIONAL DEVNET INTEGRATION</span><h2>Sign a real blockchain receipt</h2><p>Connect Phantom or Solflare, choose one of your paper trades in Transactions, and sign. NPRX submits a structured memo through an AnchorProvider and saves the confirmed signature with the shared trade.</p><button className="primary-button" onClick={connectWallet}><Wallet size={15}/>{walletAddress?shortAddress(walletAddress):"Connect Solana wallet"}</button><div className="program-box"><span><small>NETWORK</small><strong>Solana Devnet</strong></span><span><small>DEPLOYED PROGRAM</small><strong>{shortAddress(MEMO_PROGRAM_ID)}</strong></span><a href={`https://explorer.solana.com/address/${MEMO_PROGRAM_ID}?cluster=devnet`} target="_blank" rel="noreferrer">View program <ExternalLink size={11}/></a></div><div className="honesty-note"><CircleAlert size={14}/><span><strong>Honest MVP boundary</strong>Paper balances, price feeds and order matching are off-chain simulations. The signed audit receipt is the functional on-chain component.</span></div></article><article className="panel structure-card"><div className="panel-heading"><div><span className="section-kicker">MATCHED BOOK</span><h2>Participant-created open interest</h2></div><span className="balanced-chip"><Check size={12}/> BALANCED</span></div><div className="exposure-figures"><span><small>LONGS</small><strong>{fmt(totalLong)} tNPR</strong></span><i>=</i><span><small>SHORTS</small><strong>{fmt(totalShort)} tNPR</strong></span></div><div className="exposure-bar"><span/><span/></div><div className="proof-metrics"><span><small>OPEN INTEREST</small><strong>{fmt(openInterest)} tNPR</strong></span><span><small>PARTICIPANTS</small><strong>{demo.accounts.length}</strong></span><span><small>OPEN REQUESTS</small><strong>{demo.orders.length}</strong></span><span><small>RECORDED TRADES</small><strong>{demo.trades.length}</strong></span></div></article><article className="panel controls-card"><div className="panel-heading"><div><span className="section-kicker">PAPER MARKET CONTROLS</span><h2>What the prototype enforces</h2></div></div><div className="control-list"><span><LockKeyhole size={16}/><div><strong>100% test margin</strong><small>Notional reserved before matching</small></div><em>ACTIVE</em></span><span><Users size={16}/><div><strong>Participant-only matches</strong><small>Self-matching and house inventory blocked</small></div><em>ACTIVE</em></span><span><Database size={16}/><div><strong>Durable shared ledger</strong><small>Accounts, orders, trades and audit events</small></div><em>ACTIVE</em></span><span><Link2 size={16}/><div><strong>Optional public receipt</strong><small>Confirmed signatures link to Explorer</small></div><em>DEVNET</em></span></div></article><article className="panel audit-panel"><div className="panel-heading"><div><span className="section-kicker">LIVE AUDIT STREAM</span><h2>Recent system events</h2></div><span className="sync-label"><i/> shared state</span></div><div className="audit-list">{demo.audit.slice(0,10).map((event)=><div key={event.id}><span className="audit-icon">{event.kind==="chain"?<Link2 size={14}/>:event.kind==="deposit"?<Landmark size={14}/>:event.kind==="match"?<Scale size={14}/>:<BarChart3 size={14}/>}</span><span><strong>{event.title}</strong><small>{event.detail}</small></span><em>{accountById(event.actor_id??"")?.company??"System"}</em><time>{timeAgo(event.created_at)}</time></div>)}</div></article></div></section>}
    </>}</div>

    <footer><div className="footer-brand"><span className="brand-mark small">N</span><span><strong>NPRX Global</strong><small>SOLANA PAPER MARKET</small></span></div><p>Hackathon prototype only. No real money, deposits, custody, securities, derivatives, settlement, or investment service. Quotes may be delayed and are not official settlement prices.</p><span>Devnet · paper-v0.3</span></footer>

    {depositOpen&&<div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Fund sandbox account"><div className="deposit-modal"><button className="modal-close" onClick={closeDeposit}><X size={17}/></button>{depositStep==="form"&&<><span className="payment-logo"><Landmark size={19}/></span><span className="section-kicker">CONNECTIPS SANDBOX SIMULATION</span><h2>Add paper funds</h2><p>Choose a fake NPR amount. Your account receives the same amount in test-only tNPR.</p><label className="field-label">Deposit amount <small>NPR</small></label><div className="amount-input modal-amount"><input type="number" min="10000" max="1000000" step="10000" value={depositAmount} onChange={(event)=>setDepositAmount(Number(event.target.value))}/><span>NPR</span></div><div className="amount-presets">{[50000,100000,250000,500000].map((amount)=><button key={amount} onClick={()=>setDepositAmount(amount)}>{fmt(amount/1000)}K</button>)}</div><div className="bank-account"><span>DB</span><span><strong>Demo Bank account</strong><small>Primary ···· {currentUserId==="person1"?"2408":currentUserId==="person2"?"7712":currentUserId==="person3"?"1864":"5931"}</small></span><CheckCircle2 size={16}/></div><button className="primary-button full" onClick={()=>setDepositStep("confirm")}>Continue to sandbox approval <ArrowRight size={15}/></button><button className="text-button" onClick={closeDeposit}>Use existing balance</button></>}{depositStep==="confirm"&&<><span className="connectips-wordmark">connect<span>IPS</span></span><span className="sandbox-label">SANDBOX · NOT THE REAL SERVICE</span><h2>Approve fake payment</h2><p>No bank, connectIPS system, credential, or real money will be contacted.</p><div className="payment-summary"><span><small>Merchant</small><strong>NPRX Global Paper Market</strong></span><span><small>Amount</small><strong>NPR {fmt(depositAmount,2)}</strong></span><span><small>Paper credit</small><strong>{fmt(depositAmount,2)} tNPR</strong></span></div><div className="simulation-warning"><CircleAlert size={17}/><span><strong>Simulation only</strong>No external payment occurs.</span></div><button className="primary-button full" disabled={busy==="deposit"} onClick={submitDeposit}>{busy==="deposit"?"Crediting...":"Approve sandbox payment"}</button><button className="text-button" onClick={()=>setDepositStep("form")}>Back</button></>}{depositStep==="success"&&<div className="deposit-success"><span><Check size={30}/></span><small>PAPER FUNDS CREDITED</small><h2>{fmt(depositAmount)} tNPR</h2><p>No real funds moved.</p><div className="reference-box"><small>Sandbox reference</small><strong>{depositReference}</strong></div><button className="primary-button full" onClick={closeDeposit}>Return to trading <ArrowRight size={15}/></button></div>}</div></div>}
  </main>;
}

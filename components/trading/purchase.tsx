"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { WalletProvider } from "@/lib/wallet/provider";
import type { Quote } from "@/lib/trading/quote";
import { executePurchase, refreshPurchase, recordKey, type PurchaseRecord } from "@/lib/trading/execute";
export function PurchasePanel({provider, account, amount, btcPercent}: {provider: WalletProvider; account: string; amount: number; btcPercent: number}) {
  const [slippageBps, setSlippage] = useState(50);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [record, setRecord] = useState<PurchaseRecord | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const active = useRef(true);
  const action = useRef(false);
  useEffect(() => {
    active.current = true;
    queueMicrotask(() => {
      if (!active.current) return;
      try { const saved = localStorage.getItem(recordKey(account)); if (saved) setRecord(JSON.parse(saved)); } catch { setError("Purchase journal unavailable."); }
    });
    return () => { active.current = false; };
  }, [account]);
  async function prepare() {
    if (action.current) return;
    action.current = true; setBusy(true); setError(""); setQuote(null); setConfirmed(false);
    try {
      const response = await fetch("/api/trading/prepare", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({account, amount, btcPercent, slippageBps}), signal: AbortSignal.timeout(45000)});
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not prepare purchase");
      if (active.current) setQuote(data);
    } catch (e) { if (active.current) setError(e instanceof Error ? e.message : "Could not prepare purchase"); }
    finally { action.current = false; if (active.current) setBusy(false); }
  }
  async function submit() {
    if (!quote || !confirmed || action.current) return;
    action.current = true; setBusy(true); setError("");
    try {
      const result = await executePurchase(provider, quote, () => active.current);
      if (active.current) { setRecord(result); setQuote(null); setConfirmed(false); }
    } catch (e) { if (active.current) setError(e instanceof Error ? e.message : "Could not submit purchase"); }
    finally { action.current = false; if (active.current) setBusy(false); }
  }
  const unresolved = record && ["pending", "unknown"].includes(record.state);
  return <div className="plan-review">
    <h3>One-time spot purchase · Mainnet</h3>
    <p>Your authorized local API agent signs this purchase inside the container. This purchase is separate from your draft schedule and its budget. It does not activate recurring buys. BTC allocation buys <strong>UBTC (Unit Bitcoin)</strong>, not a BTC perpetual contract.</p>
    <label>Maximum price slippage <select disabled={busy} value={slippageBps} onChange={e => {setSlippage(Number(e.target.value)); setQuote(null); setConfirmed(false);}}><option value={10}>0.1%</option><option value={50}>0.5%</option><option value={100}>1%</option></select></label>
    <p>Uses the current installment amount and allocation. A 1% fee reserve is included inside this amount. Orders are immediate-or-cancel and may fill partially or independently.</p>
    <Button type="button" disabled={busy || !!unresolved || !Number.isFinite(amount) || amount < 10 || !Number.isInteger(btcPercent)} onClick={() => void prepare()}>Prepare purchase</Button>
    {quote && <>
      <p>Account mode: {quote.accountMode || "standard"}. Available USDC for this purchase: {quote.availableUSDC}. Maximum estimated debit including fee reserve: {quote.maxDebit} USDC.</p>
      {quote.legs.map(leg => <p key={leg.cloid}><strong>{leg.symbol}/USDC</strong> · buy {leg.size} · limit {leg.price} USDC · max notional {leg.notional} USDC</p>)}
      <p>Quote expires at {new Date(quote.expiresAt).toLocaleTimeString()}. Refresh it if signing takes too long.</p>
      {quote.blockers.map(blocker => <p className="error" key={blocker}>{blocker}</p>)}
      {!quote.blockers.length && <>
        <label className="purchase-confirm"><input type="checkbox" checked={confirmed} disabled={busy} onChange={e => setConfirmed(e.target.checked)} /> I reviewed these real mainnet purchases, the UBTC asset, and the maximum debit.</label>
        <Button type="button" disabled={!confirmed || busy} onClick={() => void submit()}>{busy ? "Submitting through local agent…" : "Confirm and buy via agent"}</Button>
      </>}
    </>}
    {record && <div><h4>Last purchase: {record.state.toUpperCase()}</h4>
      {unresolved && <p className="error">Submission may have reached the exchange. New purchases are blocked. Check the client order IDs in Hyperliquid; do not retry blindly.</p>}
      {record.state === "not_sent" ? <p>No order was sent to Hyperliquid. The message below describes the signing or pre-submission failure. This purchase uses the authorized local API agent; no browser-wallet trade signature is requested.</p> : <p>A response is not a guarantee that both assets filled. Check each filled size, average price or error below.</p>}
      <pre className="purchase-result">{JSON.stringify(record.response ?? {clientOrderIds: record.quote.legs.map(l => l.cloid)}, null, 2)}</pre>
      <Button disabled={busy} onClick={() => { if (action.current) return; action.current = true; setBusy(true); setError(""); void refreshPurchase(record.quote).then(result => {if (active.current) {if (result) setRecord(result); else setError("No server result found. Do not retry an uncertain purchase.");}}).catch(() => {if (active.current) setError("Could not refresh the server result.");}).finally(() => {action.current = false; if (active.current) setBusy(false);}); }}>Refresh result</Button>
      <p className="small">Client order IDs: {record.quote.legs.map(l => l.cloid).join(", ")}</p>
      <a href="https://app.hyperliquid.xyz/portfolio" target="_blank" rel="noopener noreferrer">Check Hyperliquid history ↗</a>
    </div>}
    {error && <p className="error" role="alert">{error}</p>}
  </div>;
}

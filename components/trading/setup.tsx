"use client";
import { useEffect, useRef, useState } from "react";
import { discoverWallets, walletAddress, type Wallet } from "@/lib/wallet/provider";
import { loadPlan, savePlan, planSchema, planSummary, type DCAPlan } from "@/lib/dca/schedule";
import { Button } from "@/components/ui/button";
import { money } from "@/lib/format";

export function TradingSetup({ onViewPortfolio }: { onViewPortfolio: (account: string) => void }) {
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [connected, setConnected] = useState<{ wallet: Wallet; address: string } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const revision = useRef(0);
  const [amount, setAmount] = useState(50);
  const [budget, setBudget] = useState(1000);
  const [btcPercent, setBtcPercent] = useState(65);
  const [frequency, setFrequency] = useState<DCAPlan["frequency"]>("daily");
  const [market, setMarket] = useState<DCAPlan["market"]>("spot");
  const [start, setStart] = useState("");
  useEffect(() => discoverWallets(wallet => setWallets(current => {
    if (current.some(w => w.id === wallet.id || w.provider === wallet.provider)) return current;
    return wallet.id === "injected" && current.length ? current : [...current.filter(w => w.id !== "injected"), wallet];
  })), []);
  const address = connected?.address;
  useEffect(() => {
    if (!connected) return;
    const invalidate = () => { revision.current++; setConnected(null); setSaved(false); setError("Wallet account or network changed. Reconnect before editing this plan."); };
    const provider = connected.wallet.provider;
    for (const event of ["accountsChanged", "chainChanged", "disconnect"]) provider.on?.(event, invalidate);
    return () => { for (const event of ["accountsChanged", "chainChanged", "disconnect"]) provider.removeListener?.(event, invalidate); };
  }, [connected]);
  useEffect(() => () => { revision.current++; }, []);
  async function connect(wallet: Wallet) {
    const request = ++revision.current;
    setBusy(true); setError(""); setSaved(false);
    try {
      const account = walletAddress(await wallet.provider.request({ method: "eth_requestAccounts" }));
      if (request !== revision.current) return;
      if (!account) throw new Error("No valid wallet account was returned.");
      setConnected({ wallet, address: account });
      setAmount(50); setBudget(1000); setBtcPercent(65); setFrequency("daily"); setMarket("spot");
      // Event handler: read the clock only after an explicit wallet connection.
      // eslint-disable-next-line react-hooks/purity
      setStart(new Date(Date.now() + 3600000).toISOString().slice(0, 16));
      try {
        const stored = loadPlan(account);
        if (stored) {
          setAmount(stored.amount); setBudget(stored.budget); setBtcPercent(stored.btcPercent);
          setFrequency(stored.frequency); setMarket(stored.market); setStart(stored.startAt.slice(0, 16)); setSaved(true);
        }
      } catch { setError("Saved plan could not be loaded. Review settings before saving a replacement."); }
    } catch (e) {
      if (request === revision.current) setError((e as { code?: number }).code === 4001 ? "Wallet connection was cancelled." : "Could not connect. Unlock your wallet and try again.");
    } finally { if (request === revision.current) setBusy(false); }
  }
  const parsed = planSchema.safeParse({ version: 1, account: address, market, amount, budget, btcPercent, frequency, startAt: start ? `${start}:00.000Z` : "", status: "draft" });
  const summary = parsed.success ? planSummary(parsed.data) : null;
  function save() {
    setError("");
    if (!parsed.success) { setError("Check the amount, budget and start time."); return; }
    // Event handler: reject a past start time when the user saves.
    // eslint-disable-next-line react-hooks/purity
    if (Date.parse(parsed.data.startAt) <= Date.now()) { setError("Choose a future start time in UTC."); return; }
    try { savePlan(parsed.data); setSaved(true); } catch { setError("Could not save. Allow browser storage and try again."); }
  }
  return <section className="dca-setup card" aria-label="DCA setup">
    <div className="section-label">DCA SETUP · MAINNET</div>
    <h2>Connect. Plan. Review.</h2>
    <p className="muted">Connect your wallet and save a recurring purchase plan. This step stores a draft; order execution and the background scheduler are not connected yet.</p>
    {!connected ? <div className="wallet-options">
      {wallets.length === 0 && <p>Open this app in Chrome with MetaMask or another EVM wallet installed.</p>}
      {wallets.map(wallet => <Button key={wallet.id} disabled={busy} onClick={() => void connect(wallet)}>{busy ? "Connecting…" : `Connect ${wallet.name}`}</Button>)}
      <p className="small muted">Connection shares your public address only. No signature or trading permission is requested.</p>
    </div> : <>
      <div className="wallet-connected"><strong>{connected.wallet.name}</strong><code>{address}</code>
        <Button variant="outline" onClick={() => onViewPortfolio(connected.address)}>View portfolio</Button>
        <Button variant="ghost" onClick={() => { revision.current++; setConnected(null); setSaved(false); }}>Disconnect app</Button>
      </div>
      <form onSubmit={e => { e.preventDefault(); save(); }} onChange={() => setSaved(false)}>
        <div className="plan-fields">
          <label>Market<select value={market} onChange={e => setMarket(e.target.value as DCAPlan["market"])}><option value="spot">Spot · USDC</option></select></label>
          <label>Per purchase (USDC)<input type="number" min="10" max="100000" step="0.01" value={amount} onChange={e => setAmount(e.target.valueAsNumber)} required /></label>
          <label>Total order budget (USDC)<input type="number" min="10" max="1000000" step="0.01" value={budget} onChange={e => setBudget(e.target.valueAsNumber)} required /></label>
          <label>Frequency<select value={frequency} onChange={e => setFrequency(e.target.value as DCAPlan["frequency"])}><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></label>
          <label>First purchase (UTC)<input type="datetime-local" value={start} onChange={e => setStart(e.target.value)} required /></label>
          <label>BTC allocation (%)<input type="number" min="0" max="100" step="1" value={btcPercent} onChange={e => setBtcPercent(e.target.valueAsNumber)} required /></label>
        </div>
        {summary && <div className="plan-review">
          <p>Each purchase: BTC {money(summary.btc)} · HYPE {money(summary.hype)}. {summary.count} purchases · {money(summary.allocated)} allocated · {money(summary.remainder)} unallocated.</p>
          <p className="muted">Fees are additional. Individual orders still need exchange minimum-size, available-balance and price checks before execution. Dates below are in UTC.</p>
          <ol>{summary.nextRuns.map(run => <li key={run}>{run.replace("T", " ").replace(":00.000Z", " UTC")}</li>)}</ol>
        </div>}
        <Button type="submit" disabled={!parsed.success}>{saved ? "Draft saved" : "Save DCA draft"}</Button>
        <p className="small muted">Saved only in this browser, separately for each wallet. A wallet connection is not proof of trading authorization. No purchases are running.</p>
      </form>
    </>}
    {error && <p className="error" role="alert">{error}</p>}
  </section>;
}

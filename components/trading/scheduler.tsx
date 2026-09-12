"use client";
import {useEffect,useRef,useState} from "react";
import {Button} from "@/components/ui/button";
import type {DCAPlan} from "@/lib/dca/schedule";
import {occurrence,planSummary} from "@/lib/dca/schedule";
import type {RuntimeStrategy} from "@/lib/dca/runtime/types";
import type {WalletProvider} from "@/lib/wallet/provider";
import {walletAddress} from "@/lib/wallet/provider";
type Status={strategy:RuntimeStrategy|null;pauseRequested:boolean;worker:{started:boolean;busy:boolean;lastTick:string|null;error:boolean}};
export function SchedulerPanel({account,provider,plan}:{account:string;provider:WalletProvider;plan:DCAPlan|null}){
 const [status,setStatus]=useState<Status|null>(null);const [slippage,setSlippage]=useState(50);const [reviewed,setReviewed]=useState(false);const [busy,setBusy]=useState(false);const [error,setError]=useState("");const active=useRef(true);const working=useRef(false);
 async function request(action:string){
  if(action!=="status" && walletAddress(await provider.request({method:"eth_accounts"}))!==account)throw new Error("Wallet account changed. Reconnect.");
  if(!active.current)return;
  const response=await fetch("/api/dca",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({account,action,expectedId:status?.strategy?.id??null,...(action==="start" && plan ? {configuration:{plan,slippageBps:slippage}}:{})}),signal:AbortSignal.timeout(45000)});
  const data=await response.json();if(!response.ok)throw new Error(data.error||"Could not update strategy");if(active.current)setStatus(data);
 }
 const latest=useRef(request);useEffect(()=>{latest.current=request;});
 useEffect(()=>{active.current=true;const refresh=()=>{if(!working.current)void latest.current("status").catch(()=>{if(active.current)setError("Could not refresh strategy status.");});};refresh();const timer=setInterval(refresh,10000);return()=>{active.current=false;clearInterval(timer);};},[account]);
 async function act(action:string){if(working.current)return;working.current=true;setBusy(true);setError("");try{await request(action);setReviewed(false);}catch(e){if(active.current)setError(e instanceof Error?e.message:"Could not update strategy");}finally{working.current=false;if(active.current)setBusy(false);}}
 const current=status?.strategy;const count=current?planSummary(current.plan).count:0;
 return <section className="plan-review"><h3>Scheduled DCA · Mainnet</h3>
 <p>One strategy per wallet. The local container must stay running. Each installment includes a 1% fee reserve and buys spot UBTC/HYPE using the approved agent. No borrowing or leverage.</p>
 <p>Missed slots older than five minutes are skipped. Rejected, partial or uncertain purchases stop the strategy for review. Pausing prevents new submissions; an order already sent can still fill.</p>
 <label>Maximum slippage <select value={slippage} disabled={busy} onChange={e=>{setSlippage(Number(e.target.value));setReviewed(false);}}><option value={10}>0.1%</option><option value={50}>0.5%</option><option value={100}>1%</option></select></label>
 <p>Worker: {status?.worker.started ? status.worker.error ? "attention required":"enabled":"disabled / connecting"}. Last tick: {status?.worker.lastTick??"not reported"}.</p>
 {plan && <p>Review: {plan.amount} USDC per {plan.frequency} installment · budget {plan.budget} USDC · UBTC {plan.btcPercent}% / HYPE {100-plan.btcPercent}% · first purchase {plan.startAt}.</p>}
 <label className="purchase-confirm"><input type="checkbox" checked={reviewed} disabled={busy} onChange={e=>setReviewed(e.target.checked)}/> I authorize recurring mainnet purchases under the displayed settings. Replacing a strategy authorizes a new budget; past purchases remain separate.</label>
 <Button disabled={!plan||!reviewed||busy||!status||current?.status==="running"} onClick={()=>void act("start")}>{current?"Start replacement strategy":"Start DCA strategy"}</Button>{" "}
 {current && <>
  <Button disabled={busy} variant="outline" onClick={()=>void act("pause")}>Pause strategy</Button>{" "}
  <Button disabled={!reviewed||busy||!["paused","blocked"].includes(current.status)} variant="outline" onClick={()=>void act("resume")}>Resume saved strategy</Button>
  <p><strong>{status?.pauseRequested && current.status==="running" ? "PAUSE REQUESTED":current.status.toUpperCase()}</strong> · {current.nextIndex}/{count} slots processed · {current.reservedUSDC}/{current.plan.budget} USDC reserved.</p>
  <p>Saved: {current.plan.amount} USDC / {current.plan.frequency}; UBTC {current.plan.btcPercent}%; slippage {current.slippageBps/100}%. Resume uses these saved settings, not edited form values.</p>
  <p>Next slot: {current.nextIndex<count?occurrence(current.plan.startAt,current.plan.frequency,current.nextIndex):"none"}. Reserved budget is a conservative ceiling, not actual spending; unused portions are not reused automatically.</p>
  {current.error&&<p className="error">{current.error}</p>}
  <details><summary>Execution history ({current.runs.length})</summary>{current.runs.slice(-20).reverse().map(run=><div key={run.index}><strong>#{run.index+1} · {run.state.toUpperCase()} · {run.dueAt}</strong><pre className="purchase-result">{JSON.stringify(run.record?.response??run.message??{quoteId:run.quoteId},null,2)}</pre></div>)}</details>
 </>}
 <Button disabled={busy} variant="ghost" onClick={()=>void act("status")}>Refresh strategy</Button>
 {error&&<p role="alert" className="error">{error}</p>}
 </section>;
}

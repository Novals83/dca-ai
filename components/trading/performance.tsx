"use client";
import {useEffect,useState} from "react";
import {Button} from "@/components/ui/button";
import type {PerformanceSnapshot} from "@/lib/accounting/service";
export function PerformancePanel({account}:{account:string}){
 const [data,setData]=useState<PerformanceSnapshot|null>(null);const [busy,setBusy]=useState(false);const [error,setError]=useState("");
 useEffect(()=>{let active=true;setTimeout(()=>{if(active){setData(null);setError("");}},0);return()=>{active=false;};},[account]);
 async function load(action:"refresh"|"export"){
  setBusy(true);setError("");try{const r=await fetch("/api/performance",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({account,action}),signal:AbortSignal.timeout(120000)});if(!r.ok)throw new Error("Accounting refresh unavailable. Existing records remain saved.");const result=await r.json();
  if(action==="refresh")setData(result);else{const url=URL.createObjectURL(new Blob([JSON.stringify(result,null,2)],{type:"application/json"}));const a=document.createElement("a");a.href=url;a.download=`dca-accounting-${account}.json`;a.click();URL.revokeObjectURL(url);}
 }catch(e){setError(e instanceof Error?e.message:"Accounting unavailable");}finally{setBusy(false);}}
 const pct=(v:number|null)=>v===null?"N/A":`${v.toFixed(2)}%`;
 return <section className="plan-review"><h3>Strategy performance & accounting</h3><p>Actual fills and fees, not reserved budgets. DCA replacement revisions share a history; one-time purchases remain separate.</p><Button disabled={busy} onClick={()=>void load("refresh")}>Refresh performance</Button>{" "}<Button variant="outline" disabled={busy} onClick={()=>void load("export")}>Export accounting JSON</Button>
 {data&&<><p>Valuation: {data.asOf}</p>{data.scopes.map(s=><div key={s.id}><h4>{s.label}</h4><p>Invested: {Number(s.metrics.investedUSDC).toFixed(2)} USDC · Marked value: {Number(s.metrics.markedValueUSDC).toFixed(2)} USDC · P&amp;L: {s.metrics.pnlUSDC===null?"N/A":Number(s.metrics.pnlUSDC).toFixed(2)} USDC</p><p>ROI: {pct(s.metrics.roiPercent)} · APR (capital-time weighted): {pct(s.metrics.aprPercent)} · XIRR (effective annual return): {pct(s.metrics.xirrPercent)}</p><p>Fees by token: {JSON.stringify(s.metrics.fees)}</p>{s.metrics.warnings.map(w=><p className="small" key={w}>{w}</p>)}</div>)}{data.warnings.map(w=><p className="small" key={w}>{w}</p>)}</>}
 <p className="small">Annualization appears after 24 hours and is not a forecast. APR weights each cash flow by invested time; XIRR accounts for compounding and actual fill dates.</p>{error&&<p className="error">{error}</p>}</section>;
}

import {refreshPerformance} from "../../accounting/service";
import {purchaseRecords} from "../../trading/journal";
import Decimal from "decimal.js";
import {occurrence,planSummary} from "../schedule";
import {preparePurchase} from "../../trading/prepare";
import {executeAgentPurchase} from "../../trading/agent-execute";
import {readResult,persistQuote} from "../../trading/journal";
import {accounts,readStrategy,writeStrategy,lockStrategy,pauseRequested} from "./store";
import type {RuntimeStrategy,Run} from "./types";
const pending=(s:RuntimeStrategy)=>s.runs.find(r=>["preparing","pending","unknown"].includes(r.state));
function applyResult(s:RuntimeStrategy,run:Run,record:NonNullable<ReturnType<typeof readResult>>) {
 run.record=record;run.state=record.state;
 const response=record.response as {status?:string;response?:{data?:{statuses?:Array<{filled?:{totalSz:string}}>}}}|undefined;
 const fullyReported=record.state==="result" && response?.status==="ok" && response.response?.data?.statuses?.length===record.quote.legs.length && response.response.data.statuses.every((x,i)=>!!x.filled && new Decimal(x.filled.totalSz).eq(record.quote.legs[i].size));
 if(!fullyReported){s.status="blocked";s.error="Purchase needs review: rejected, incomplete, or unknown result. No automatic retry.";}
 else if(s.nextIndex>=planSummary(s.plan).count)s.status="completed";
}
export async function runAccount(account:string,now=Date.now()) {
 let unlock:()=>void;try{unlock=lockStrategy(account);}catch{return;}
 try {
  const state=readStrategy(account);if(!state)return;
  const unresolved=pending(state);
  if(unresolved){const record=unresolved.quoteId ? readResult(unresolved.quoteId):null;if(record && ["result","not_sent"].includes(record.state))applyResult(state,unresolved,record);else{state.status="blocked";state.error="Interrupted or uncertain purchase. Review the journal before further execution.";}writeStrategy(state);return;}
  if(pauseRequested(account) && state.status==="running"){state.status="paused";writeStrategy(state);return;}
  if(state.status!=="running")return;
  const count=planSummary(state.plan).count;
  // Missed slots older than five minutes are skipped, never bought in a catch-up burst.
  while(state.nextIndex<count && Date.parse(occurrence(state.plan.startAt,state.plan.frequency,state.nextIndex))<now-300000){
   state.runs.push({index:state.nextIndex,dueAt:occurrence(state.plan.startAt,state.plan.frequency,state.nextIndex),state:"skipped",message:"Missed slot; no catch-up purchase."});state.nextIndex++;
  }
  if(state.nextIndex>=count){state.status="completed";writeStrategy(state);return;}
  const dueAt=occurrence(state.plan.startAt,state.plan.frequency,state.nextIndex);
  if(Date.parse(dueAt)>now){writeStrategy(state);return;}
  if(Math.round((state.reservedUSDC+state.plan.amount)*100)>Math.round(state.plan.budget*100)){state.status="completed";writeStrategy(state);return;}
  const run:Run={index:state.nextIndex,dueAt,state:"preparing"};
  state.nextIndex++;state.reservedUSDC=Math.round((state.reservedUSDC+state.plan.amount)*100)/100;state.runs.push(run);
  writeStrategy(state); // Reserve the full installment ceiling before preparation/dispatch.
  try {
   const quote=await preparePurchase({account,amount:state.plan.amount,btcPercent:state.plan.btcPercent,slippageBps:state.slippageBps});
   quote.scheduledStrategyId=state.id;persistQuote(quote);
   run.quoteId=quote.id;run.state="pending";writeStrategy(state);
   if(pauseRequested(account)){run.state="not_sent";run.message="Paused before dispatch";state.status="paused";writeStrategy(state);return;}
   const result=await executeAgentPurchase(account,quote.id,()=>!pauseRequested(account));
   applyResult(state,run,result);
  }catch {const stored=run.quoteId?readResult(run.quoteId):null;run.state=stored && ["pending","unknown"].includes(stored.state)?"unknown":"not_sent";if(stored)run.record=stored;state.status="blocked";state.error="Execution interrupted. Review this slot; it will not be retried automatically.";}
  if(pauseRequested(account) && state.status==="running")state.status="paused";
  writeStrategy(state);
 }finally{unlock();}
}
type WorkerState={started:boolean;busy:boolean;lastTick:string|null;error:boolean};
const globalWorker=globalThis as typeof globalThis & {dcaWorker?:WorkerState};
export function workerStatus(){return globalWorker.dcaWorker ?? {started:false,busy:false,lastTick:null,error:false};}
export function startWorker(){
 if(process.env.DCA_WORKER_ENABLED!=="1" || globalWorker.dcaWorker?.started)return;
 const status:WorkerState={started:true,busy:false,lastTick:null,error:false};globalWorker.dcaWorker=status;
 const tick=async()=>{if(status.busy)return;status.busy=true;try{for(const account of accounts())await runAccount(account);status.error=false;}catch{status.error=true;}finally{status.lastTick=new Date().toISOString();status.busy=false;}};
 let accountingBusy=false;
 const accountTick=async()=>{if(accountingBusy)return;accountingBusy=true;try{for(const account of new Set(purchaseRecords().map(r=>r.quote.account))){try{await refreshPerformance(account);}catch{/* Retry on the next accounting tick without delaying trading. */}}}finally{accountingBusy=false;}};
 setInterval(()=>void tick(),15000).unref();void tick();
 setInterval(()=>void accountTick(),300000).unref();void accountTick();
}

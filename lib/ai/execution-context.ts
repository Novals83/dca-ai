import {readStrategy,pauseRequested} from "../dca/runtime/store";
import {workerStatus} from "../dca/runtime/engine";
import {occurrence,planSummary} from "../dca/schedule";
import {getAgent} from "../agent/store";
import {accountingRepository} from "../accounting/repository";
export async function executionContext(account:string,timeZone="UTC") {
 if(account==="demo")return {source:"demo",strategy:null};
 const master=account.toLowerCase();
 const state=readStrategy(master);
 const localAgent=getAgent(master,false);
 const summary=state?planSummary(state.plan):null;
 const nextAt=state && summary && state.nextIndex<summary.count?occurrence(state.plan.startAt,state.plan.frequency,state.nextIndex):null;
 const display=(iso:string)=>new Date(iso).toLocaleString("en-GB",{timeZone});
 let accounting:unknown=null;
 try {const snapshots=await accountingRepository().list<{asOf:string}>(master,"snapshots");accounting=snapshots.sort((a,b)=>b.asOf.localeCompare(a.asOf))[0]??null;}catch{accounting={error:"Accounting history unavailable"};}
 return {source:"saved_server_state",asOf:new Date().toISOString(),timeZone,worker:workerStatus(),
  agent:localAgent?{address:localAgent.address,localExpiry:new Date(localAgent.expiresAt).toISOString(),exchangeAuthorization:"Not verified by this read; local expiry alone does not prove authorization"}:null,
  strategy:state?{id:state.id,status:state.status,pauseRequested:pauseRequested(master),plan:state.plan,totalSlots:summary!.count,processedSlots:state.nextIndex,reservedUSDC:state.reservedUSDC,remainingBudgetUSDC:Math.round((state.plan.budget-state.reservedUSDC)*100)/100,nextScheduledAt:nextAt,nextScheduledLocal:nextAt?display(nextAt):null,nextPurchaseStatus:state.status==="running"&&!pauseRequested(master)?"scheduled_not_guaranteed":"not_running",schedule:Array.from({length:Math.min(20,summary!.count-state.nextIndex)},(_,i)=>occurrence(state.plan.startAt,state.plan.frequency,state.nextIndex+i)),scheduleTruncated:summary!.count-state.nextIndex>20,error:state.error??null,runs:state.runs.slice(-20).map(r=>({index:r.index,dueAt:r.dueAt,state:r.state,message:r.message,response:r.record?.response})),createdAt:state.createdAt,updatedAt:state.updatedAt}:null,
 accounting,notes:"Reserved budget is not actual spending. Dates are scheduled slots, not guaranteed fills. Paused or blocked strategies will not execute. Accounting has its own snapshot timestamp."};
}

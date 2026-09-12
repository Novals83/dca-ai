import {randomUUID} from "node:crypto";
import {z} from "zod";
import {readBody,apiError} from "@/lib/http";
import {runtimeInput,type RuntimeStrategy} from "@/lib/dca/runtime/types";
import {readStrategy,writeStrategy,lockStrategy,requestPause,pauseRequested,clearPause,archive} from "@/lib/dca/runtime/store";
import {workerStatus} from "@/lib/dca/runtime/engine";
import {preparePurchase} from "@/lib/trading/prepare";
import {getAgent} from "@/lib/agent/store";
import {info} from "@/lib/hyperliquid/client";
import {lastResult} from "@/lib/trading/journal";
export const runtime="nodejs";
const schema=z.object({account:z.string().regex(/^0x[0-9a-f]{40}$/),action:z.enum(["status","start","pause","resume"]),expectedId:z.string().uuid().nullable().optional(),configuration:runtimeInput.optional()});
export async function POST(request:Request){
 try{
  const origin=request.headers.get("origin");if(!origin || new URL(origin).host!==request.headers.get("host") || !["localhost","127.0.0.1","[::1]"].includes(new URL(origin).hostname))throw new Error("Forbidden");
  const input=await readBody(request,schema);
  const response=()=>Response.json({strategy:readStrategy(input.account),pauseRequested:pauseRequested(input.account),worker:workerStatus()},{headers:{"Cache-Control":"no-store"}});
  if(input.action==="status")return response();
  if(input.action==="pause"){requestPause(input.account);return response();}
  let unlock:()=>void;try{unlock=lockStrategy(input.account);}catch{return Response.json({error:"Strategy is processing a slot. Try again shortly."},{status:409});}
  try {
   const current=readStrategy(input.account);
   if((current?.id??null)!==(input.expectedId??null))return Response.json({error:"Strategy changed. Refresh before confirming."},{status:409});
   if(process.env.DCA_WORKER_ENABLED!=="1")return Response.json({error:"The DCA worker is disabled in this deployment."},{status:409});
   const prior=lastResult(input.account);
   if(prior && ["pending","unknown"].includes(prior.state))return Response.json({error:"Resolve the uncertain purchase before starting a strategy."},{status:409});
   if(current?.runs.some(r=>["pending","preparing","unknown"].includes(r.state)))return Response.json({error:"This strategy has an unresolved execution. Review its journal first."},{status:409});
   const config=input.action==="resume" && current ? {plan:current.plan,slippageBps:current.slippageBps}:input.configuration;
   if(!config || config.plan.account!==input.account)throw new Error("Forbidden");
   if(input.action==="start" && current?.status==="running")return Response.json({error:"Pause the current strategy before replacing it."},{status:409});
   if(input.action==="start" && Date.parse(config.plan.startAt)<=Date.now())return Response.json({error:"Choose a future first purchase time in UTC."},{status:400});
   const agent=getAgent(input.account,false);
   const agents=await info({type:"extraAgents",user:input.account},z.array(z.object({address:z.string(),validUntil:z.number().nullable()})));
   if(!agent || agent.expiresAt<=Date.now() || !agents.some(a=>a.address.toLowerCase()===agent.address.toLowerCase() && (a.validUntil===null || a.validUntil>Date.now())))return Response.json({error:"Authorize a valid local agent first."},{status:409});
   const quote=await preparePurchase({account:input.account,amount:config.plan.amount,btcPercent:config.plan.btcPercent,slippageBps:config.slippageBps});
   if(quote.blockers.length)return Response.json({error:quote.blockers.join(" ")},{status:422});
   if(input.action==="resume"){
    if(!current || current.status==="completed")return Response.json({error:"Create a new strategy for a new budget."},{status:409});
    current.status="running";delete current.error;clearPause(input.account);writeStrategy(current);
   }else{
    if(current)archive(current);
    const state:RuntimeStrategy={id:randomUUID(),...config,status:"running",nextIndex:0,reservedUSDC:0,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),runs:[]};
    clearPause(input.account);writeStrategy(state);
   }
   return response();
  }finally{unlock();}
 }catch(e){return apiError(e);}
}

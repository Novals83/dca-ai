import {z} from "zod";
import Decimal from "decimal.js";
import {info} from "../hyperliquid/client";
import {getAllMids} from "../hyperliquid/market";
import {spotMetaSchema,resolveSpot} from "../trading/quote";
import {purchaseRecords} from "../trading/journal";
import {strategyHistory} from "../dca/runtime/store";
import {accountingRepository} from "./repository";
import {performance,type LedgerFill} from "./returns";
const number=z.string().regex(/^-?\d+(\.\d+)?$/);
const fillSchema=z.array(z.object({oid:z.number(),tid:z.number(),time:z.number(),coin:z.string(),side:z.string(),px:number,sz:number,fee:number,feeToken:z.string(),hash:z.string()}));
export type PerformanceSnapshot={asOf:string;account:string;prices:Record<string,number>;scopes:Array<{id:string;label:string;metrics:ReturnType<typeof performance>}>;warnings:string[]};
const locks=new Map<string,Promise<PerformanceSnapshot>>();
export function refreshPerformance(account:string):Promise<PerformanceSnapshot>{
 const old=locks.get(account);if(old)return old;
 const task=refresh(account).finally(()=>locks.delete(account));locks.set(account,task);return task;
}
async function refresh(account:string):Promise<PerformanceSnapshot>{
 const repo=accountingRepository();const records=purchaseRecords(account);const strategies=strategyHistory(account);
 for(const state of strategies)await repo.put(account,"strategies",`${state.id}:${state.updatedAt}`,state);
 const scopeFor=(id?:string)=>id?`strategy:${strategies.find(s=>s.id===id)?.seriesId??id}`:"manual";
 const expected=new Map<number,{scope:string;quoteId:string;symbol:string;coin:string;quantity:string}>();
 const incomplete=new Set<string>();const warnings:string[]=[];
 for(const state of strategies)if(state.runs.some(r=>["pending","preparing","unknown"].includes(r.state)))incomplete.add(scopeFor(state.id));
 for(const r of records){
  await repo.put(account,"records",`${r.quote.id}:${r.updatedAt}`,r);
  const scope=scopeFor(r.quote.scheduledStrategyId);
  if(["pending","unknown"].includes(r.state)){incomplete.add(scope);continue;}
  if(r.state==="not_sent")continue;
  const response=r.response as {status?:string;response?:{data?:{statuses?:Array<{filled?:{oid:number;totalSz:string};error?:string}>}}};
  const statuses=response?.response?.data?.statuses;
  if(response?.status==="err")continue;
  if(!statuses){incomplete.add(scope);continue;}
  statuses.forEach((s,i)=>{const leg=r.quote.legs[i];if(s.filled&&leg)expected.set(s.filled.oid,{scope,quoteId:r.quote.id,symbol:leg.symbol,coin:leg.coin,quantity:s.filled.totalSz});else if(!s.error)incomplete.add(scope);});
 }
 const cached=await repo.list<LedgerFill>(account,"fills");
 const sums=()=>{const result=new Map<number,Decimal>();for(const f of cached)result.set(f.oid,(result.get(f.oid)||new Decimal(0)).plus(f.quantity));return result;};
 const initial=sums();const missing=[...expected].filter(([id,e])=>!initial.get(id)?.eq(e.quantity));
 if(missing.length){
  let from=Math.min(...records.filter(r=>missing.some(([,e])=>e.quoteId===r.quote.id)).map(r=>r.quote.expiresAt-120000));
  const end=Date.now();const ids=new Set(cached.map(f=>f.id));
  try{
   for(let page=0;page<20;page++){
    const fills=await info({type:"userFillsByTime",user:account,startTime:from,endTime:end,aggregateByTime:false},fillSchema);
    for(const f of fills){const e=expected.get(f.oid);if(!e||f.side!=="B"||f.coin!==e.coin)continue;const id=`${f.oid}:${f.tid}:${f.hash}`;if(ids.has(id))continue;
     const entry:LedgerFill={id,scope:e.scope,quoteId:e.quoteId,oid:f.oid,time:f.time,symbol:e.symbol,quantity:f.sz,price:f.px,fee:f.fee,feeToken:f.feeToken};
     await repo.put(account,"fills",id,entry);cached.push(entry);ids.add(id);
    }
    if(fills.length<2000)break;
    const next=Math.max(...fills.map(f=>f.time));if(next<=from){warnings.push("Fill pagination is incomplete.");break;}from=next;
   }
  }catch{warnings.push("Exchange fills unavailable; cached records retained.");}
 }
 const totals=sums();for(const [id,e] of expected)if(!totals.get(id)?.eq(e.quantity))incomplete.add(e.scope);
 const [meta,mids]=await Promise.all([info({type:"spotMeta"},spotMetaSchema),getAllMids()]);
 const prices=Object.fromEntries(["UBTC","HYPE"].map(s=>{const p=resolveSpot(meta,s as "UBTC"|"HYPE");return [s,mids[p.coin]];}));
 const now=Date.now();const scopes=[...new Set([...cached.map(f=>f.scope),...incomplete])];
 const snapshot:PerformanceSnapshot={account,asOf:new Date(now).toISOString(),prices,scopes:[{id:"all",label:"All app purchases",metrics:performance(cached,prices,now,incomplete.size===0)},...scopes.map(id=>({id,label:id==="manual"?"One-time purchases":`DCA history · ${id.slice(-8)}`,metrics:performance(cached.filter(f=>f.scope===id),prices,now,!incomplete.has(id))}))],warnings:[...warnings,"Buy-and-hold attribution: only app order fills are included. External sales, transfers and unrelated wallet activity are not strategy cash flows. Values are spot mid estimates; exit fees are excluded."]};
 await repo.put(account,"snapshots",`${Math.floor(now/60000)}`,snapshot);return snapshot;
}
export async function exportAccounting(account:string){const repo=accountingRepository();return {version:1,account,exportedAt:new Date().toISOString(),fills:await repo.list<LedgerFill>(account,"fills"),snapshots:await repo.list<PerformanceSnapshot>(account,"snapshots"),records:await repo.list(account,"records"),strategies:await repo.list(account,"strategies")};}

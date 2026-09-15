import {mkdtempSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {randomUUID} from "node:crypto";
import {beforeEach,afterEach,expect,it,vi} from "vitest";
const mock=vi.hoisted(()=>({authorized:true,send:vi.fn()}));
vi.mock("../lib/agent/store",()=>({getAgent:()=>({address:"0xagent",expiresAt:Date.now()+60000}),loadAgentSigner:()=>({address:"0xagent"}),markAgentAuthorized:()=>{}}));
vi.mock("../lib/hyperliquid/client",()=>({info:async (p:{type:string})=>{
 if(p.type==="extraAgents") return mock.authorized ? [{address:"0xagent",validUntil:Date.now()+60000}]:[];
 if(p.type==="spotClearinghouseState") return {balances:[{token:0,total:"100",hold:"0"}]};
 if(p.type==="userAbstraction") return "disabled";
 return {tokens:[{name:"USDC",index:0,szDecimals:8,tokenId:"0x6d1e7cde53ba9467b783cb7c530ce054"},{name:"UBTC",index:197,szDecimals:5,tokenId:"0x8f254b963e8468305d409b33aa137c67"}],universe:[{name:"@142",index:142,tokens:[197,0]}]};
}}));
vi.mock("@nktkas/hyperliquid",()=>({ExchangeClient:class {
 constructor(private config:{transport:{request:(endpoint:"exchange",payload:unknown)=>Promise<unknown>}}){}
 async order(payload:unknown){mock.send(payload);return this.config.transport.request("exchange",payload);}
}}));
import {executeAgentPurchase} from "../lib/trading/agent-execute";
import {persistQuote,readResult} from "../lib/trading/journal";
import type {Quote} from "../lib/trading/quote";
let directory:string;
const account=`0x${"1".repeat(40)}`;
const quote=():Quote=>({id:randomUUID(),account,amount:50,btcPercent:100,slippageBps:50,expiresAt:Date.now()+60000,availableUSDC:"100",maxDebit:"41",blockers:[],legs:[{symbol:"UBTC",asset:10142,coin:"@142",price:"100000",size:"0.0004",notional:"40",referenceAsk:"99999",cloid:`0x${"a".repeat(32)}`}]});
beforeEach(()=>{directory=mkdtempSync(join(tmpdir(),"agent-exec-"));vi.stubEnv("AGENT_DATA_DIR",directory);mock.authorized=true;mock.send.mockClear();vi.stubGlobal("fetch",vi.fn(async()=>Response.json({status:"ok",response:{type:"order",data:{statuses:[{filled:{totalSz:"0.0004",avgPx:"99999",oid:1}}]}}})));});
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();rmSync(directory,{recursive:true,force:true});});
it("signs the stored quote once and returns the journal on repeat",async()=>{
 const q=quote();persistQuote(q);expect((await executeAgentPurchase(account,q.id)).state).toBe("result");
 expect((await executeAgentPurchase(account,q.id)).state).toBe("result");expect(fetch).toHaveBeenCalledTimes(1);
 expect(mock.send.mock.calls[0][0].orders[0]).toMatchObject({a:10142,b:true,s:"0.0004",t:{limit:{tif:"Ioc"}}});
});
it("does not send expired quotes",async()=>{const q={...quote(),expiresAt:1};persistQuote(q);expect((await executeAgentPurchase(account,q.id)).state).toBe("not_sent");expect(fetch).not.toHaveBeenCalled();});
it("does not sign when the agent is revoked",async()=>{mock.authorized=false;const q=quote();persistQuote(q);expect((await executeAgentPurchase(account,q.id)).state).toBe("not_sent");expect(mock.send).not.toHaveBeenCalled();});
it("persists uncertainty and blocks another quote",async()=>{
 vi.mocked(fetch).mockRejectedValue(new Error("timeout"));const q=quote();persistQuote(q);expect((await executeAgentPurchase(account,q.id)).state).toBe("unknown");expect(readResult(q.id)?.state).toBe("unknown");
 const next=quote();persistQuote(next);await expect(executeAgentPurchase(account,next.id)).rejects.toThrow(/reconciliation/);expect(fetch).toHaveBeenCalledTimes(1);
});
it("rejects an account mismatch before signing",async()=>{const q=quote();persistQuote(q);await expect(executeAgentPurchase(`0x${"2".repeat(40)}`,q.id)).rejects.toThrow(/mismatch/);expect(fetch).not.toHaveBeenCalled();});
it("treats malformed exchange responses as unknown",async()=>{vi.mocked(fetch).mockResolvedValue(Response.json({status:"ok"}));const q=quote();persistQuote(q);expect((await executeAgentPurchase(account,q.id)).state).toBe("unknown");});

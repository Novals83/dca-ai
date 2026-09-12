import {ExchangeClient} from "@nktkas/hyperliquid";
import {z} from "zod";
import {getAgent, loadAgentSigner, markAgentAuthorized} from "../agent/store";
import {info} from "../hyperliquid/client";
import {purchaseBalance, tradingSpotSchema} from "./balance";
import {spotMetaSchema, resolveSpot} from "./quote";
import {lockAccount, readQuote, readResult, lastResult, rememberResult} from "./journal";
import type {PurchaseRecord} from "./execute";
class PreflightError extends Error {}
export async function executeAgentPurchase(account: string, quoteId: string): Promise<PurchaseRecord> {
  const quote = readQuote(quoteId);
  if (quote.account !== account) throw new Error("Purchase account mismatch");
  const unlock = lockAccount(account); // A crashed lock fails closed; never automatically discard it.
  try {
    const existing = readResult(quoteId);
    if (existing) return existing; // Idempotent across tabs, requests and container restarts.
    const previous = lastResult(account);
    if (previous && ["pending", "unknown"].includes(previous.state)) throw new Error("Previous purchase needs reconciliation");
    const record: PurchaseRecord = {quote, state:"pending", updatedAt:new Date().toISOString()};
    rememberResult(record); // Durable before signing or sending anything.
    let dispatched = false;
    let response: unknown;
    try {
      if (quote.blockers.length || !quote.legs.length || Date.now() >= quote.expiresAt) throw new PreflightError("Quote expired or blocked. Prepare a new purchase.");
      const agent = getAgent(account, false);
      if (!agent || agent.expiresAt <= Date.now()) throw new PreflightError("Prepare and authorize an unexpired local agent first.");
      const [agents, spot, mode, meta] = await Promise.all([
        info({type:"extraAgents", user:account}, z.array(z.object({address:z.string(), validUntil:z.number().nullable()}))),
        info({type:"spotClearinghouseState", user:account}, tradingSpotSchema),
        info({type:"userAbstraction", user:account}, z.string()),
        info({type:"spotMeta"}, spotMetaSchema),
      ]);
      const approved = agents.find(a => a.address.toLowerCase() === agent.address.toLowerCase());
      if (!approved || (approved.validUntil !== null && approved.validUntil <= Date.now())) throw new PreflightError("The local agent is not authorized or has expired. Refresh authorization.");
      const cash = purchaseBalance(mode, spot, resolveSpot(meta,"UBTC").quoteIndex);
      if (cash.blockers.length || cash.available.lt(quote.maxDebit)) throw new PreflightError("Available USDC or account mode changed. Prepare a new purchase.");
      for (const leg of quote.legs) {
        if (leg.symbol !== "UBTC" && leg.symbol !== "HYPE") throw new PreflightError("Unsupported spot asset");
        const pair = resolveSpot(meta,leg.symbol);
        if (pair.asset !== leg.asset || pair.coin !== leg.coin) throw new PreflightError("Spot metadata changed. Prepare a new purchase.");
      }
      markAgentAuthorized(account);
      const signer = loadAgentSigner(account);
      if (signer.address.toLowerCase() !== agent.address.toLowerCase()) throw new PreflightError("Agent changed. Prepare again.");
      const exchange = new ExchangeClient({wallet:signer, transport:{isTestnet:false,
        async request<T>(endpoint:"info"|"exchange", payload:unknown): Promise<T> {
          if (endpoint !== "exchange" || Date.now() >= quote.expiresAt) throw new PreflightError("Quote expired before dispatch. Prepare again.");
          dispatched = true;
          const res = await fetch("https://api.hyperliquid.xyz/exchange", {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(payload), signal:AbortSignal.timeout(20000)});
          if (!res.ok) throw new Error("Exchange unavailable");
          const data: unknown = await res.json();
          // Only a recognized exchange envelope establishes a known result.
          const parsed = z.union([z.object({status:z.literal("err"),response:z.string()}), z.object({status:z.literal("ok"),response:z.object({type:z.literal("order"),data:z.object({statuses:z.array(z.union([z.object({error:z.string()}),z.object({filled:z.object({totalSz:z.string(),avgPx:z.string(),oid:z.number()})}),z.object({resting:z.object({oid:z.number()})})])).length(quote.legs.length)})})})]).safeParse(data);
          if (!parsed.success) throw new Error("Unrecognized exchange response");
          response = parsed.data;
          return response as T;
        },
      }});
      await exchange.order({orders:quote.legs.map(l=>({a:l.asset,b:true,p:l.price,s:l.size,r:false,t:{limit:{tif:"Ioc" as const}},c:l.cloid})),grouping:"na"},{expiresAfter:quote.expiresAt});
      record.state="result"; record.response=response;
    } catch(e) {
      record.state=response!==undefined ? "result" : dispatched ? "unknown" : "not_sent";
      record.response=response ?? {message:dispatched ? "Submission result unknown. Refresh result; do not resend." : e instanceof PreflightError ? e.message : "Agent preflight or local signing failed. No order was sent. Check authorization and prepare again."};
    }
    record.updatedAt=new Date().toISOString();
    rememberResult(record);
    return record;
  } finally {unlock();}
}

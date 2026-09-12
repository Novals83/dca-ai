import { randomUUID } from "node:crypto";
import Decimal from "decimal.js";
import { z } from "zod";
import { readBody, apiError } from "@/lib/http";
import { info } from "@/lib/hyperliquid/client";
import { purchaseSchema, spotMetaSchema, resolveSpot, sizeBuy, type Quote, type PreparedLeg } from "@/lib/trading/quote";
const numberText = z.string().regex(/^\d+(\.\d+)?$/);
export async function POST(request: Request) {
  try {
    const input = await readBody(request, purchaseSchema);
    const [meta, spot, mode] = await Promise.all([
      info({ type: "spotMeta" }, spotMetaSchema),
      info({ type: "spotClearinghouseState", user: input.account }, z.object({ balances: z.array(z.object({token: z.number(), total: numberText, hold: numberText})) })),
      info({ type: "userAbstraction", user: input.account }, z.enum(["default", "disabled", "unifiedAccount", "portfolioMargin", "dexAbstraction"])),
    ]);
    const blockers: string[] = [];
    if (!["default", "disabled"].includes(mode)) blockers.push("Execution currently requires a standard Hyperliquid account. Unified, portfolio margin and DEX abstraction accounts are not supported yet.");
    const usdc = meta.tokens.find(t => t.name === "USDC" && t.tokenId === "0x6d1e7cde53ba9467b783cb7c530ce054");
    if (!usdc) throw new Error("USDC metadata unavailable");
    const balance = spot.balances.find(b => b.token === usdc.index);
    const available = balance ? Decimal.max(0, new Decimal(balance.total).minus(balance.hold)) : new Decimal(0);
    const allocations = [{symbol: "UBTC" as const, fraction: input.btcPercent}, {symbol: "HYPE" as const, fraction: 100 - input.btcPercent}];
    const legs: PreparedLeg[] = [];
    for (const allocation of allocations.filter(a => a.fraction > 0)) {
      const pair = resolveSpot(meta, allocation.symbol);
      const book = await info({type: "l2Book", coin: pair.coin}, z.object({time: z.number(), levels: z.array(z.array(z.object({px: numberText, sz: numberText}))).length(2)}));
      if (Math.abs(Date.now() - book.time) > 15000) throw new Error("Order book is stale");
      const ask = book.levels[1][0]?.px;
      if (!ask) throw new Error("Order book has no asks");
      try {
        const sized = sizeBuy(ask, new Decimal(input.amount).mul(allocation.fraction).div(100).toFixed(), pair.szDecimals, input.slippageBps);
        legs.push({symbol: pair.symbol, asset: pair.asset, coin: pair.coin, ...sized, cloid: `0x${randomUUID().replaceAll("-", "")}`});
      } catch (e) { blockers.push(`${pair.symbol}: ${e instanceof Error ? e.message : "Invalid order size"}`); }
    }
    const maxDebit = legs.reduce((sum, leg) => sum.plus(leg.notional), new Decimal(0)).mul("1.01");
    if (available.lt(maxDebit)) blockers.push("Insufficient available spot USDC for this purchase and fee reserve.");
    const result: Quote = {...input, id: randomUUID(), expiresAt: Date.now() + 60000, availableUSDC: available.toFixed(), maxDebit: maxDebit.toFixed(), legs, blockers};
    return Response.json(result, {headers: {"Cache-Control": "no-store"}});
  } catch (e) { return apiError(e); }
}

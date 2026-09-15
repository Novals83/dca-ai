import Decimal from "decimal.js";
import { z } from "zod";
export const purchaseSchema = z.object({
  account: z.string().regex(/^0x[0-9a-fA-F]{40}$/).transform(s => s.toLowerCase()),
  amount: z.number().finite().min(10).max(100000),
  btcPercent: z.number().int().min(0).max(100),
  slippageBps: z.number().int().min(1).max(100),
});
export type Purchase = z.infer<typeof purchaseSchema>;
export type PreparedLeg = { symbol: string; asset: number; coin: string; price: string; size: string; notional: string; referenceAsk: string; cloid: `0x${string}` };
export type Quote = { scheduledStrategyId?: string; accountMode?: string; id: string; account: string; amount: number; btcPercent: number; slippageBps: number; expiresAt: number; availableUSDC: string; maxDebit: string; legs: PreparedLeg[]; blockers: string[] };
export const spotMetaSchema = z.object({
  tokens: z.array(z.object({ name: z.string(), index: z.number().int(), szDecimals: z.number().int().min(0).max(8), tokenId: z.string() })),
  universe: z.array(z.object({ name: z.string(), index: z.number().int().nonnegative(), tokens: z.array(z.number().int()) })),
});
export type TradingMeta = z.infer<typeof spotMetaSchema>;
const identities = { UBTC: "0x8f254b963e8468305d409b33aa137c67", HYPE: "0x0d01dc56dcaaca66ad901c959b4011ec", USDC: "0x6d1e7cde53ba9467b783cb7c530ce054" };
export function resolveSpot(meta: TradingMeta, symbol: "UBTC" | "HYPE") {
  const token = meta.tokens.find(t => t.name === symbol && t.tokenId === identities[symbol]);
  const quote = meta.tokens.find(t => t.name === "USDC" && t.tokenId === identities.USDC);
  const pairs = meta.universe.filter(p => p.tokens.length === 2 && p.tokens[0] === token?.index && p.tokens[1] === quote?.index);
  if (!token || !quote || pairs.length !== 1) throw new Error(`Verified ${symbol}/USDC market unavailable`);
  return { symbol, asset: 10000 + pairs[0].index, coin: pairs[0].name, szDecimals: token.szDecimals, quoteIndex: quote.index };
}
export function sizeBuy(askText: string, budgetText: string, szDecimals: number, slippageBps: number) {
  const ask = new Decimal(askText);
  const budget = new Decimal(budgetText);
  if (!ask.isFinite() || ask.lte(0) || !budget.isFinite() || budget.lte(0) || !Number.isInteger(szDecimals) || szDecimals < 0 || szDecimals > 8) throw new Error("Invalid price or budget");
  const ceiling = ask.mul(new Decimal(1).plus(new Decimal(slippageBps).div(10000)));
  // Round down: never exceed the user's maximum slippage, including at tick boundaries.
  const price = ceiling.toSignificantDigits(5, Decimal.ROUND_DOWN).toDecimalPlaces(8 - szDecimals, Decimal.ROUND_DOWN);
  if (price.lt(ask)) throw new Error("Slippage is too small for the price tick");
  // Reserve 1% of each allocation for fees; unspent funds remain in the wallet.
  const size = budget.div("1.01").div(price).toDecimalPlaces(szDecimals, Decimal.ROUND_DOWN);
  if (size.mul(ask).lt(10)) throw new Error("Each nonzero asset allocation must cover the $10 minimum after rounding and fee reserve");
  return { price: price.toFixed(), size: size.toFixed(), notional: size.mul(price).toFixed(), referenceAsk: ask.toFixed() };
}

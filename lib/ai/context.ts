import { z } from "zod";
import { strategySchema, simulateDCA, defaultStrategy } from "../dca/simulator";
import { demoPortfolio } from "../demo";
import { addressSchema } from "../hyperliquid/client";
import { getPortfolio } from "../hyperliquid/portfolio";
import { getMarket } from "../hyperliquid/market";
export const contextSchema = z.object({
  account: z.union([z.literal("demo"), addressSchema]),
  strategy: strategySchema.optional(),
});
export type ContextRequest = z.infer<typeof contextSchema>;
export async function getContext(input: ContextRequest) {
  const [portfolio, market] = await Promise.all([
    input.account === "demo" ? Promise.resolve(demoPortfolio) : getPortfolio(input.account),
    getMarket(),
  ]);
  const strategy = input.strategy ?? defaultStrategy;
  return {
    portfolio,
    market,
    strategy,
    simulation: simulateDCA({
      ...strategy,
      btcPrice: market.BTC,
      hypePrice: market.HYPE,
    }),
  };
}
export type CopilotContext = Awaited<ReturnType<typeof getContext>>;

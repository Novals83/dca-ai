import { z } from "zod";
import { strategySchema, simulateDCA, defaultStrategy } from "../dca/simulator";
import { demoPortfolio } from "../demo";
import { addressSchema } from "../hyperliquid/client";
import { getPortfolio } from "../hyperliquid/portfolio";
import { getMarket } from "../hyperliquid/market";
import {executionContext} from "./execution-context";
export const contextSchema = z.object({
  account: z.union([z.literal("demo"), addressSchema]),
  strategy: strategySchema.optional(),
  timeZone:z.string().max(100).refine(value=>{try{new Intl.DateTimeFormat("en",{timeZone:value});return true;}catch{return false;}},"Invalid timezone").default("UTC"),
});
export type ContextRequest = Omit<z.infer<typeof contextSchema>, "timeZone"> & {timeZone?:string};
export async function getContext(input: ContextRequest) {
  const [portfolio, market, execution] = await Promise.all([
    input.account === "demo" ? Promise.resolve(demoPortfolio) : getPortfolio(input.account),
    getMarket(),
    executionContext(input.account,input.timeZone),
  ]);
  const strategy = input.strategy ?? defaultStrategy;
  return {
    execution,
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

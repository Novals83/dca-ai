import { z } from "zod";
import {
  strategySchema,
  simulateDCA,
  calculateAllocation,
  calculateEffectiveLeverage,
  type Strategy,
} from "../dca/simulator";
import type { CopilotContext } from "./context";
export const toolNames = [
  "get_portfolio",
  "get_market_prices",
  "simulate_dca",
  "compare_dca_strategies",
  "calculate_allocation",
  "calculate_effective_leverage",
  "create_strategy_preview",
] as const;
export type ToolName = (typeof toolNames)[number];
const strategyProperties = {
  capital: { type: "number" },
  contributionAmount: { type: "number" },
  contributionFrequency: {
    type: "string",
    enum: ["daily", "weekly", "monthly"],
  },
  btcAllocation: { type: "number" },
  hypeAllocation: { type: "number" },
  leverage: { type: "number" },
  durationMonths: { type: "integer" },
};
const strategyParams = {
  type: "object",
  properties: strategyProperties,
  required: Object.keys(strategyProperties),
  additionalProperties: false,
};
export const aiTools = toolNames.map((name) => ({
  type: "function" as const,
  name,
  description: {
    get_portfolio: "Get the verified portfolio and exposures.",
    get_market_prices: "Get reference BTC perp mid and HYPE spot mid prices.",
    simulate_dca:
      "Calculate a strategy at constant reference prices; all amounts through this calculator.",
    compare_dca_strategies:
      "Compare two complete DCA strategies at constant prices.",
    calculate_allocation: "Calculate USD split by BTC percentage.",
    calculate_effective_leverage: "Calculate gross exposure divided by equity.",
    create_strategy_preview:
      "Validate and preview a strategy. Does not save or execute.",
  }[name],
  strict: true,
  parameters: ["simulate_dca", "create_strategy_preview"].includes(name)
    ? strategyParams
    : name === "compare_dca_strategies"
      ? {
          type: "object",
          properties: { first: strategyParams, second: strategyParams },
          required: ["first", "second"],
          additionalProperties: false,
        }
      : name === "calculate_allocation"
        ? {
            type: "object",
            properties: {
              amount: { type: "number" },
              btcPercent: { type: "number" },
            },
            required: ["amount", "btcPercent"],
            additionalProperties: false,
          }
        : name === "calculate_effective_leverage"
          ? {
              type: "object",
              properties: {
                exposure: { type: "number" },
                equity: { type: "number" },
              },
              required: ["exposure", "equity"],
              additionalProperties: false,
            }
          : {
              type: "object",
              properties: {},
              required: [],
              additionalProperties: false,
            },
}));
export function runTool(
  name: ToolName,
  args: unknown,
  context: CopilotContext,
): unknown {
  const simulate = (strategy: Strategy) =>
    simulateDCA({
      ...strategy,
      btcPrice: context.market.BTC,
      hypePrice: context.market.HYPE,
    });
  switch (name) {
    case "get_portfolio":
      return context.portfolio;
    case "get_market_prices":
      return context.market;
    case "simulate_dca":
      return simulate(strategySchema.parse(args));
    case "create_strategy_preview": {
      const strategy = strategySchema.parse(args);
      return {
        strategy,
        simulation: simulate(strategy),
        status: "preview_only",
      };
    }
    case "compare_dca_strategies": {
      const v = z
        .object({ first: strategySchema, second: strategySchema })
        .parse(args);
      return { first: simulate(v.first), second: simulate(v.second) };
    }
    case "calculate_allocation": {
      const v = z
        .object({ amount: z.number(), btcPercent: z.number() })
        .parse(args);
      return calculateAllocation(v.amount, v.btcPercent);
    }
    case "calculate_effective_leverage": {
      const v = z
        .object({ exposure: z.number(), equity: z.number() })
        .parse(args);
      return {
        effectiveLeverage: calculateEffectiveLeverage(v.exposure, v.equity),
      };
    }
  }
}

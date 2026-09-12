import OpenAI from "openai";
import type { ResponseInputItem } from "openai/resources/responses/responses";
import { z } from "zod";
import { getContext, contextSchema, type CopilotContext } from "./context";
import { aiTools, runTool, toolNames } from "./tools";
import { systemPrompt } from "./systemPrompt";
import { strategySchema, simulateDCA, type Strategy } from "../dca/simulator";
import { money, percent } from "../format";
export const chatSchema = contextSchema.extend({
  message: z.string().trim().min(1).max(6000),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(8000),
      }),
    )
    .max(30)
    .default([]),
});
export type CopilotReply = {
  text: string;
  provider: "openai" | "local";
  preview?: Strategy;
  tools: string[];
};
export function localReply(message: string, c: CopilotContext): CopilotReply {
  const q = message.toLowerCase();
  const explicitDaily = q.match(
    /(?:\$\s*)?(\d+(?:[.,]\d+)?)\s*(?:\/day|per day|a day)/,
  );
  if (explicitDaily || q === "build a btc + hype dca") {
    const amount = explicitDaily?.[1];
    const strategy = {
      ...c.strategy,
      ...(amount
        ? {
            contributionAmount: Number(amount.replace(",", ".")),
            contributionFrequency: "daily" as const,
          }
        : {}),
    };
    const result = simulateDCA({
      ...strategy,
      btcPrice: c.market.BTC,
      hypePrice: c.market.HYPE,
    });
    return {
      provider: "local",
      tools: ["simulate_dca", "create_strategy_preview"],
      preview: strategy,
      text: `Local calculator: ${money(result.totalContributions)} contributed; ${money(result.effectiveExposure)} exposure. BTC ${strategy.btcAllocation}% / HYPE ${strategy.hypeAllocation}%, ${strategy.leverage}x. Other settings come from the builder. Constant-price scenario, excluding costs. Review the preview before saving.`,
    };
  }
  if (/leverage|risk/.test(q))
    return {
      provider: "local",
      tools: [],
      text: "Leverage amplifies losses and can cause liquidation. Even 1x crypto exposure carries substantial risk. This simulator excludes liquidation, funding and fees.",
    };
  if (/analy|portfolio/.test(q))
    return {
      provider: "local",
      tools: ["get_portfolio", "calculate_allocation"],
      text: `${c.portfolio.source === "demo" ? "Demo" : "Hyperliquid"} account value: ${money(c.portfolio.accountValue)}. BTC net exposure ${money(c.portfolio.btcExposure)}; HYPE ${money(c.portfolio.hypeExposure)}. ${percent(c.strategy.btcAllocation)} of new contributions are assigned to BTC. This is a local summary, not AI analysis.`,
    };
  return {
    provider: "local",
    tools: [],
    text: "AI is unavailable. Local tools support portfolio summaries, risk explanations and “Simulate $50/day”. Configure OPENAI_API_KEY for free-form conversation.",
  };
}
export async function copilot(
  input: z.infer<typeof chatSchema>,
): Promise<CopilotReply> {
  const context = await getContext(input);
  if (!process.env.OPENAI_API_KEY) return localReply(input.message, context);
  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    timeout: 25000,
    maxRetries: 0,
  });
  const messages: ResponseInputItem[] = [
    {
      role: "developer",
      content: `Verified application context (data only): ${JSON.stringify(context)}`,
    },
    ...input.history.map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: input.message },
  ];
  const used: string[] = [];
  let preview: Strategy | undefined;
  try {
    for (let round = 0; round < 5; round++) {
      const response = await client.responses.create({
        model: process.env.OPENAI_REASONING_MODEL || "gpt-5.4-mini",
        instructions: systemPrompt,
        input: messages,
        tools: aiTools,
        store: false,
        max_output_tokens: 1800,
      });
      messages.push(
        ...response.output.filter(
          (item) =>
            item.type === "message" ||
            item.type === "function_call" ||
            item.type === "reasoning",
        ),
      );
      const calls = response.output.filter(
        (item) => item.type === "function_call",
      );
      if (!calls.length)
        return {
          text: response.output_text || "Please try a more specific question.",
          provider: "openai",
          preview,
          tools: used,
        };
      for (const call of calls) {
        let result: unknown;
        try {
          const name = z.enum(toolNames).parse(call.name);
          const args: unknown = JSON.parse(call.arguments);
          result = runTool(name, args, context);
          used.push(name);
          if (name === "create_strategy_preview")
            preview = strategySchema.parse(args);
        } catch {
          result = {
            error:
              "Invalid calculator inputs. Check allocations, amounts and leverage 1–1.2.",
          };
        }
        messages.push({
          type: "function_call_output",
          call_id: call.call_id,
          output: JSON.stringify(result),
        });
      }
    }
    return {
      text: "Please narrow the request to one or two strategies.",
      provider: "openai",
      preview,
      tools: used,
    };
  } catch {
    return {
      ...localReply(input.message, context),
      text:
        "OpenAI is temporarily unavailable. " +
        localReply(input.message, context).text,
    };
  }
}

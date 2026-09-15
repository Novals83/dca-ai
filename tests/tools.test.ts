import { it, expect, vi } from "vitest";
import { getContext } from "../lib/ai/context";
import { runTool } from "../lib/ai/tools";
import { defaultStrategy } from "../lib/dca/simulator";
it("preview validates and returns a simulation without saving", async () => {
  const c = await getContext({ account: "demo" });
  expect(runTool("create_strategy_preview", defaultStrategy, c)).toMatchObject({
    status: "preview_only",
    strategy: defaultStrategy,
    simulation: { totalContributions: 18250 },
  });
});
it("comparison calculates both strategies", async () => {
  const c = await getContext({ account: "demo" });
  expect(
    runTool(
      "compare_dca_strategies",
      {
        first: { ...defaultStrategy, contributionAmount: 30 },
        second: defaultStrategy,
      },
      c,
    ),
  ).toMatchObject({
    first: { totalContributions: 10950 },
    second: { totalContributions: 18250 },
  });
});
it("tool rejects invalid leverage", async () => {
  const c = await getContext({ account: "demo" });
  expect(() =>
    runTool("simulate_dca", { ...defaultStrategy, leverage: 10 }, c),
  ).toThrow();
});

vi.mock("../lib/hyperliquid/market", () => ({ getMarket: vi.fn(async () => ({ BTC: 95000, HYPE: 40, source: "live", asOf: new Date().toISOString() })) }));

it("creates a real DCA draft without authorization or execution", async () => {
 const c=await getContext({account:"demo"});
 const draft={amount:50,budget:500,btcPercent:65,frequency:"daily",startAt:"2027-01-01T12:00:00.000Z"};
 expect(runTool("create_dca_draft",draft,c)).toMatchObject({draft,status:"draft_only"});
 expect(()=>runTool("create_dca_draft",{...draft,budget:10},c)).toThrow();
});

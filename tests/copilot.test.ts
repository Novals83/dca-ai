import { it, expect, vi } from "vitest";
import { localReply } from "../lib/ai/copilot";
import { getContext } from "../lib/ai/context";
it("limited fallback does not turn capital into daily spending", async () => {
  const c = await getContext({ account: "demo" });
  expect(
    localReply("I have $15,000. How should I allocate my DCA?", c).preview,
  ).toBeUndefined();
});
it("explicit daily command overrides weekly builder frequency", async () => {
  const c = await getContext({ account: "demo" });
  c.strategy.contributionFrequency = "weekly";
  expect(localReply("Simulate $50/day", c).preview).toMatchObject({
    contributionAmount: 50,
    contributionFrequency: "daily",
  });
});

vi.mock("../lib/hyperliquid/market", () => ({ getMarket: vi.fn(async () => ({ BTC: 95000, HYPE: 40, source: "live", asOf: new Date().toISOString() })) }));

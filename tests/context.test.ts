import { expect, it, vi } from "vitest";
import { getContext } from "../lib/ai/context";
import { getMarket } from "../lib/hyperliquid/market";
vi.mock("../lib/hyperliquid/market", () => ({ getMarket: vi.fn() }));
it("uses current market prices with explicitly demo portfolio balances", async () => {
  vi.mocked(getMarket).mockResolvedValue({ BTC: 77000, HYPE: 80, source: "live", asOf: "2026-09-12T12:00:00Z" });
  const context = await getContext({ account: "demo" });
  expect(context.portfolio.source).toBe("demo");
  expect(context.market).toMatchObject({ BTC: 77000, HYPE: 80, source: "live" });
});
it("does not replace an unavailable live market with fictitious prices", async () => {
  vi.mocked(getMarket).mockRejectedValue(new Error("Market unavailable"));
  await expect(getContext({ account: "demo" })).rejects.toThrow("Market unavailable");
});

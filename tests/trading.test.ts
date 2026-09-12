import { beforeEach, describe, expect, it, vi } from "vitest";
import Decimal from "decimal.js";
import { sizeBuy, resolveSpot, type Quote } from "../lib/trading/quote";
const scenario = vi.hoisted(() => ({ reject: false, afterSign: () => {} }));
vi.mock("@nktkas/hyperliquid", () => ({ ExchangeClient: class {
  constructor(private config: {transport: {request: (endpoint: string, payload: unknown) => Promise<unknown>}}) {}
  async order(payload: unknown, options: unknown) {
    if (scenario.reject) throw new Error("User rejected signature");
    scenario.afterSign();
    return this.config.transport.request("exchange", {payload, options});
  }
}}));
vi.mock("viem", () => ({createWalletClient: () => ({}), custom: () => ({})}));
import { executePurchase, recordKey } from "../lib/trading/execute";
const account = `0x${"1".repeat(40)}`;
const quote = (): Quote => ({id: "one", account, amount: 50, btcPercent: 100, slippageBps: 50, expiresAt: Date.now() + 60000, availableUSDC: "100", maxDebit: "50", blockers: [], legs: [{symbol: "UBTC", asset: 10142, coin: "@142", price: "100000", size: "0.0004", notional: "40", referenceAsk: "99900", cloid: `0x${"a".repeat(32)}`} ]});
const provider = {request: vi.fn(async () => [account])};
beforeEach(() => {
  scenario.reject = false; scenario.afterSign = () => {};
  const memory = new Map<string,string>();
  vi.stubGlobal("localStorage", {getItem: (k: string) => memory.get(k) ?? null, setItem: (k: string,v: string) => memory.set(k,v)});
  vi.stubGlobal("navigator", {locks: {request: async (_key: string, _options: unknown, callback: (lock: object) => unknown) => callback({})}});
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({status: "ok", response: {data: {statuses: [{filled: {totalSz: "0.0004"}}]}}})));
  provider.request.mockClear();
});
describe("spot sizing", () => {
  it("respects allocation including reserve and maximum slippage", () => {
    for (const [ask, budget, decimals] of [["100123.4", "50", 5], ["41.12345", "25", 2]] as const) {
      const sized = sizeBuy(ask, budget, decimals, 50);
      expect(new Decimal(sized.notional).mul("1.01").lte(budget)).toBe(true);
      expect(new Decimal(sized.price).lte(new Decimal(ask).mul("1.005"))).toBe(true);
      expect(new Decimal(sized.size).decimalPlaces()).toBeLessThanOrEqual(decimals);
    }
  });
  it("rejects minimum-size and invalid orders", () => {
    expect(() => sizeBuy("100000", "10", 5, 50)).toThrow(/minimum/);
    expect(() => sizeBuy("0", "100", 2, 50)).toThrow();
  });
  it("rejects a token with the right name but wrong identity", () => {
    expect(() => resolveSpot({tokens: [{name: "UBTC", index: 1, szDecimals: 5, tokenId: "fake"}], universe: []}, "UBTC")).toThrow();
  });
});
describe("purchase dispatch boundaries (mock signing and network)", () => {
  it("never signs expired quotes", async () => {
    await expect(executePurchase(provider, {...quote(), expiresAt: 1}, () => true)).rejects.toThrow();
    expect(provider.request).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
  });
  it("does not send when signature is rejected", async () => {
    scenario.reject = true;
    expect((await executePurchase(provider, quote(), () => true)).state).toBe("not_sent");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("checks component/wallet state after signing", async () => {
    let current = true; scenario.afterSign = () => {current = false;};
    expect((await executePurchase(provider, quote(), () => current)).state).toBe("not_sent");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("records timeout as unknown and blocks a fresh attempt", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("timeout"));
    expect((await executePurchase(provider, quote(), () => true)).state).toBe("unknown");
    await expect(executePurchase(provider, {...quote(), id: "two"}, () => true)).rejects.toThrow(/previous purchase/);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(recordKey(account))).toContain('"unknown"');
  });
  it("preserves mixed results and prevents quote replay", async () => {
    const response = {status: "ok", response: {data: {statuses: [{filled: {totalSz: "0.0001"}}, {error: "Insufficient balance"}]}}};
    vi.mocked(fetch).mockResolvedValue(Response.json(response));
    expect((await executePurchase(provider, quote(), () => true)).response).toEqual(response);
    await expect(executePurchase(provider, quote(), () => true)).rejects.toThrow(/already submitted/);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

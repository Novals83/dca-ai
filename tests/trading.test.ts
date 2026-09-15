import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";
import { sizeBuy, resolveSpot } from "../lib/trading/quote";
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

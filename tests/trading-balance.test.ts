import { describe, expect, it } from "vitest";
import { purchaseBalance, tradingSpotSchema } from "../lib/trading/balance";
const spot = {balances: [{token: 0, total: "100", hold: "20"}], tokenToAvailableAfterMaintenance: [[0, "35"] as [number,string]]};
describe("purchase cash by account mode", () => {
  it("uses unheld cash for standard accounts", () => {
    expect(purchaseBalance("disabled", spot, 0).available.toFixed()).toBe("80");
  });
  it("accepts unified accounts while preserving maintenance collateral", () => {
    const result = purchaseBalance("unifiedAccount", spot, 0);
    expect(result.available.toFixed()).toBe("35"); expect(result.blockers).toEqual([]);
  });
  it("never exceeds unheld cash even if maintenance availability is higher", () => {
    expect(purchaseBalance("unifiedAccount", {...spot, tokenToAvailableAfterMaintenance: [[0,"200"]]}, 0).available.toFixed()).toBe("80");
  });
  it("fails closed when unified availability is missing", () => {
    const result = purchaseBalance("unifiedAccount", {balances: spot.balances}, 0);
    expect(result.available.toFixed()).toBe("0"); expect(result.blockers).toHaveLength(1);
  });
  it("does not turn negative collateral into buying power", () => {
    expect(purchaseBalance("unifiedAccount", {...spot, tokenToAvailableAfterMaintenance: [[0,"-5"]]}, 0).available.toFixed()).toBe("0");
  });
  it("keeps portfolio margin and DEX abstraction blocked", () => {
    for (const mode of ["portfolioMargin", "dexAbstraction"]) expect(purchaseBalance(mode, spot, 0).blockers).toHaveLength(1);
  });
  it("parses signed availability and unrelated balances without a token index", () => {
    expect(tradingSpotSchema.parse({balances: [{total:"0",hold:"0"}], tokenToAvailableAfterMaintenance: [[0,"-1.2"]]}).tokenToAvailableAfterMaintenance?.[0][1]).toBe("-1.2");
  });
});

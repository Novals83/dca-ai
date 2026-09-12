import { describe, expect, it } from "vitest";
import { occurrence, planSummary, type DCAPlan } from "../lib/dca/schedule";
import { walletAddress } from "../lib/wallet/provider";
const plan: DCAPlan = { version: 1, account: "0x" + "1".repeat(40), market: "spot", amount: 50, budget: 125, btcPercent: 65, frequency: "monthly", startAt: "2027-01-31T12:30:00.000Z", status: "draft" };
describe("DCA calendar and budget", () => {
  it("clamps February without drifting subsequent monthly dates", () => {
    expect(occurrence(plan.startAt, "monthly", 1)).toBe("2027-02-28T12:30:00.000Z");
    expect(occurrence(plan.startAt, "monthly", 2)).toBe("2027-03-31T12:30:00.000Z");
    expect(occurrence("2028-01-31T12:30:00.000Z", "monthly", 1)).toBe("2028-02-29T12:30:00.000Z");
  });
  it("keeps the UTC time across year boundaries", () => {
    expect(occurrence("2026-12-31T23:30:00.000Z", "daily", 1)).toBe("2027-01-01T23:30:00.000Z");
    expect(occurrence("2026-12-31T23:30:00.000Z", "weekly", 1)).toBe("2027-01-07T23:30:00.000Z");
  });
  it("does not exceed the budget with a partial last installment", () => {
    expect(planSummary(plan)).toMatchObject({count: 2, allocated: 100, remainder: 25, btc: 32.5, hype: 17.5});
  });
  it("allocates rounded cents without creating extra spending", () => {
    const s = planSummary({...plan, amount: 10.01, budget: 20.02, btcPercent: 33});
    expect(s.count).toBe(2); expect(s.btc + s.hype).toBeCloseTo(10.01);
  });
  it("rejects insufficient budget and invalid values", () => {
    expect(() => planSummary({...plan, budget: 10})).toThrow();
    expect(() => planSummary({...plan, amount: NaN})).toThrow();
    expect(() => occurrence(plan.startAt, "daily", -1)).toThrow();
  });
  it("only accepts EVM account arrays from a provider", () => {
    expect(walletAddress([plan.account.toUpperCase().replace("0X", "0x")])).toBe(plan.account);
    expect(walletAddress(["not-an-address"])).toBeNull();
    expect(walletAddress(plan.account)).toBeNull();
  });
});

import { describe, it, expect } from "vitest";
import {
  simulateDCA,
  defaultStrategy,
  calculateEffectiveLeverage,
} from "../lib/dca/simulator";
const base = { ...defaultStrategy, btcPrice: 100000, hypePrice: 40 };
describe("DCA deterministic finance", () => {
  it.each([
    [10, "daily", 3650],
    [50, "daily", 18250],
    [100, "weekly", 5200],
  ] as const)("contributions %s / %s", (amount, frequency, total) => {
    const r = simulateDCA({
      ...base,
      contributionAmount: amount,
      contributionFrequency: frequency,
    });
    expect(r.totalContributions).toBe(total);
    expect(r.projectedValue).toBeCloseTo(total, 6);
  });
  it.each([0, 35, 65, 100])("allocates BTC %s", (btc) => {
    const r = simulateDCA({
      ...base,
      btcAllocation: btc,
      hypeAllocation: 100 - btc,
    });
    expect(r.btcContribution + r.hypeContribution).toBe(r.totalContributions);
    expect(r.projectedBTCAmount * base.btcPrice).toBeCloseTo(
      r.btcContribution,
      6,
    );
    expect(r.projectedHYPEAmount * base.hypePrice).toBeCloseTo(
      r.hypeContribution,
      6,
    );
  });
  it.each([1, 1.1, 1.2])("debt is not profit at %s x", (leverage) => {
    const r = simulateDCA({ ...base, leverage });
    expect(r.projectedValue).toBeCloseTo(r.totalContributions, 6);
    expect(r.effectiveExposure).toBeCloseTo(r.totalContributions * leverage);
    expect(r.borrowedPrincipal).toBeCloseTo(
      r.totalContributions * (leverage - 1),
    );
  });
  it.each([1, 12, 24])("horizon %s", (durationMonths) => {
    const r = simulateDCA({ ...base, durationMonths });
    expect(r.contributionCount).toBe(Math.floor((365 * durationMonths) / 12));
    expect(r.curve).toHaveLength(durationMonths + 1);
    expect(r.curve.at(-1)?.value).toBe(r.projectedValue);
  });
  it("annual return only accrues after contribution, not before", () => {
    const r = simulateDCA({
      ...base,
      capital: 1000,
      contributionAmount: 100,
      contributionFrequency: "monthly",
      btcAllocation: 100,
      hypeAllocation: 0,
      btcAnnualReturn: 1,
    });
    const expected =
      2000 +
      Array.from(
        { length: 12 },
        (_, i) => 100 * Math.pow(2, 1 - (i + 1) / 12),
      ).reduce((a, b) => a + b, 0);
    expect(r.projectedValue).toBeCloseTo(expected, 7);
  });
  it("monthly 1 month contribution has no artificial return", () => {
    const r = simulateDCA({
      ...base,
      contributionFrequency: "monthly",
      durationMonths: 1,
      btcAnnualReturn: 0.5,
      hypeAnnualReturn: 0.8,
    });
    expect(r.projectedValue).toBeCloseTo(50);
  });
  it("leverage worsens bear loss", () => {
    const s = { ...base, btcAnnualReturn: -0.3, hypeAnnualReturn: -0.5 };
    expect(simulateDCA({ ...s, leverage: 1.2 }).projectedValue).toBeLessThan(
      simulateDCA(s).projectedValue,
    );
  });
  it.each([
    { btcAllocation: -1, hypeAllocation: 101 },
    { btcAllocation: 65, hypeAllocation: 40 },
    { leverage: 0.9 },
    { leverage: 1.21 },
    { btcPrice: 0 },
    { hypePrice: NaN },
    { capital: Infinity },
    { contributionAmount: -5 },
    { btcAnnualReturn: -1 },
    { durationMonths: 0 },
    { durationMonths: 25 },
  ])("rejects invalid values %j", (patch) =>
    expect(() => simulateDCA({ ...base, ...patch })).toThrow(),
  );
  it("all numeric outputs finite across scenarios", () => {
    for (const btcAnnualReturn of [-0.3, 0, 0.5])
      for (const leverage of [1, 1.1, 1.2]) {
        const r = simulateDCA({ ...base, btcAnnualReturn, leverage });
        for (const value of Object.values(r))
          if (typeof value === "number")
            expect(Number.isFinite(value)).toBe(true);
      }
  });
  it("zero equity has undefined leverage", () =>
    expect(calculateEffectiveLeverage(100, 0)).toBeNull());
});

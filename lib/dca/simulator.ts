import { z } from "zod";

export const strategySchema = z
  .object({
    capital: z.number().finite().min(0).max(1e9).default(0),
    contributionAmount: z.number().finite().min(0.01).max(1e7),
    contributionFrequency: z.enum(["daily", "weekly", "monthly"]),
    btcAllocation: z.number().finite().min(0).max(100),
    hypeAllocation: z.number().finite().min(0).max(100),
    leverage: z.number().finite().min(1).max(1.2),
    durationMonths: z.number().int().min(1).max(24),
  })
  .refine(
    (v) => Math.abs(v.btcAllocation + v.hypeAllocation - 100) < 1e-8,
    "Allocations must total 100%",
  );
export type Strategy = z.infer<typeof strategySchema>;
export const simulationSchema = strategySchema.safeExtend({
  btcPrice: z.number().finite().min(1e-8).max(1e9),
  hypePrice: z.number().finite().min(1e-8).max(1e9),
  btcAnnualReturn: z.number().finite().gt(-1).max(5).default(0),
  hypeAnnualReturn: z.number().finite().gt(-1).max(5).default(0),
});
export type DCASimulationInput = z.input<typeof simulationSchema>;
export const defaultStrategy: Strategy = {
  capital: 0,
  contributionAmount: 50,
  contributionFrequency: "daily",
  btcAllocation: 65,
  hypeAllocation: 35,
  leverage: 1,
  durationMonths: 12,
};
export const scenarios = [
  { name: "Bear", btcAnnualReturn: -0.3, hypeAnnualReturn: -0.5 },
  { name: "Base", btcAnnualReturn: 0.15, hypeAnnualReturn: 0.2 },
  { name: "Bull", btcAnnualReturn: 0.5, hypeAnnualReturn: 0.8 },
] as const;
export function annualContribution(s: Strategy) {
  return (
    s.contributionAmount *
    { daily: 365, weekly: 52, monthly: 12 }[s.contributionFrequency]
  );
}
export function calculateAllocation(amount: number, btcPercent: number) {
  z.number().finite().min(0).max(1e12).parse(amount);
  z.number().finite().min(0).max(100).parse(btcPercent);
  return {
    btc: (amount * btcPercent) / 100,
    hype: (amount * (100 - btcPercent)) / 100,
  };
}
export function calculateEffectiveLeverage(exposure: number, equity: number) {
  if (!Number.isFinite(exposure) || !Number.isFinite(equity) || exposure < 0)
    throw new Error("Invalid exposure or equity");
  return equity > 0 ? exposure / equity : null;
}
export function simulateDCA(raw: DCASimulationInput) {
  const v = simulationSchema.parse(raw);
  const periodsPerYear = { daily: 365, weekly: 52, monthly: 12 }[
    v.contributionFrequency
  ];
  // Equal synthetic periods; end-of-period contributions. No partial installments.
  const count = Math.floor((periodsPerYear * v.durationMonths) / 12 + 1e-9);
  const years = v.durationMonths / 12;
  let btcUnits =
    (((v.capital * v.btcAllocation) / 100) * v.leverage) / v.btcPrice;
  let hypeUnits =
    (((v.capital * v.hypeAllocation) / 100) * v.leverage) / v.hypePrice;
  let contributions = v.capital;
  const curve = [{ month: 0, contributed: v.capital, value: v.capital }];
  let nextMonth = 1;
  function at(t: number) {
    const gross =
      btcUnits * v.btcPrice * Math.pow(1 + v.btcAnnualReturn, t) +
      hypeUnits * v.hypePrice * Math.pow(1 + v.hypeAnnualReturn, t);
    const debt = contributions * (v.leverage - 1);
    return { gross, debt, equity: gross - debt };
  }
  for (let k = 1; k <= count; k++) {
    const t = k / periodsPerYear;
    while (nextMonth / 12 < t - 1e-9 && nextMonth <= v.durationMonths) {
      curve.push({
        month: nextMonth,
        contributed: contributions,
        value: at(nextMonth / 12).equity,
      });
      nextMonth++;
    }
    btcUnits +=
      (((v.contributionAmount * v.btcAllocation) / 100) * v.leverage) /
      (v.btcPrice * Math.pow(1 + v.btcAnnualReturn, t));
    hypeUnits +=
      (((v.contributionAmount * v.hypeAllocation) / 100) * v.leverage) /
      (v.hypePrice * Math.pow(1 + v.hypeAnnualReturn, t));
    contributions = v.capital + k * v.contributionAmount;
  }
  while (nextMonth <= v.durationMonths) {
    curve.push({
      month: nextMonth,
      contributed: contributions,
      value: at(nextMonth / 12).equity,
    });
    nextMonth++;
  }
  const final = at(years);
  const warnings = [
    "Hypothetical smooth price paths; not forecasts.",
    "Fees, slippage, funding, borrowing costs and liquidation are excluded.",
    "Leverage applies to each contribution; there is no rebalancing or constant-leverage targeting.",
    "This MVP saves simulations only and never executes trades.",
  ];
  if (v.leverage > 1)
    warnings.unshift(
      "Leverage amplifies losses and can cause liquidation. This model does not simulate liquidation.",
    );
  return {
    totalContributions: contributions,
    contributionCount: count,
    effectiveExposure: contributions * v.leverage,
    btcContribution: (contributions * v.btcAllocation) / 100,
    hypeContribution: (contributions * v.hypeAllocation) / 100,
    projectedBTCAmount: btcUnits,
    projectedHYPEAmount: hypeUnits,
    projectedValue: final.equity,
    grossAssetValue: final.gross,
    borrowedPrincipal: final.debt,
    gain: final.equity - contributions,
    leverage: v.leverage,
    riskLevel: (v.leverage > 1.1 || v.hypeAllocation > 60
      ? "high"
      : v.leverage > 1 || v.hypeAllocation > 30
        ? "medium"
        : "low") as "low" | "medium" | "high",
    warnings,
    curve,
  };
}
export type DCASimulationResult = ReturnType<typeof simulateDCA>;

# DCA calculation methodology

All contribution and scenario calculations live in `lib/dca/simulator.ts`, separately from the UI and language model.

- Daily: 365 equal periods per year. Weekly: 52. Monthly: 12.
- Number of installments is floor(periods/year × months/12). No partial installments. Calendar-specific schedules and leap years are not modeled.
- Initial capital is invested at time zero. Recurring contributions are invested at the end of each synthetic period.
- BTC and HYPE prices evolve on smooth paths: P(t) = P(0) × (1 + annualReturn)^t, with t in years. This is not historical backtesting or a prediction.
- Each installment buys units using that installment's modeled price and its allocation percentage. Quantities are summed; the full contribution balance does not receive a whole year's return.
- At leverage L, each dollar of equity buys L dollars of gross exposure. Borrowed principal = contributions × (L − 1). Projected equity = ending gross assets − borrowed principal. At constant prices, 1.2x leverage does not manufacture a 20% profit.
- Leverage applies at entry to each installment; it does not maintain a constant leverage target as prices change. No rebalancing.
- Funding, borrowing interest, fees, slippage, actual execution and liquidation are excluded. Leveraged scenarios may be unachievable in practice.
- Risk labels are simple relative heuristics: high if L > 1.1 or HYPE > 60%; medium if L > 1 or HYPE > 30%; otherwise low. Even “low” carries substantial crypto risk.
- Prices must be finite and between 1e-8 and 1e9, allocations between 0 and 100 summing to 100, leverage between 1 and 1.2. Monetary bounds prevent unreasonable inputs and floating-point overflow. IEEE-754 doubles are used for analytical estimates, not order settlement.

Example at constant prices: $50/day, 12 months, 65/35 allocation, 1.1x → 365 contributions, $18,250 equity invested, $20,075 entry exposure, $1,825 borrowed principal, $18,250 ending equity before costs.

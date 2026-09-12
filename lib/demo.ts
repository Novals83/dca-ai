import type { Portfolio, Market } from "./hyperliquid/types";
import { defaultStrategy } from "./dca/simulator";
// Explicit fixtures; never a fallback for a connected live account.
export const demoMarket: Market = {
  BTC: 100000,
  HYPE: 40,
  asOf: "2026-01-01T00:00:00.000Z",
  source: "demo",
};
export const demoPortfolio: Portfolio = {
  address: "demo",
  accountValue: 48420,
  withdrawable: 8910,
  btcExposure: 27340,
  hypeExposure: 12170,
  usdcBalance: 8910,
  totalExposure: 39510,
  effectiveLeverage: 39510 / 48420,
  pnlDay: 1240,
  source: "demo",
  asOf: demoMarket.asOf,
  warnings: [],
  openOrders: [],
  recentFills: [],
  positions: [
    {
      coin: "BTC",
      side: "spot",
      size: 0.2734,
      usdValue: 27340,
      markPrice: 100000,
    },
    {
      coin: "HYPE",
      side: "spot",
      size: 304.25,
      usdValue: 12170,
      markPrice: 40,
    },
  ],
};
export const demoStrategy = {
  ...defaultStrategy,
  contributionAmount: 42,
  leverage: 1.08,
};

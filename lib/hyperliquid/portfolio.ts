import { z } from "zod";
import { info, addressSchema } from "./client";
import { getAllMids, getSpotMeta, spotPrice } from "./market";
import {
  perpSchema,
  spotSchema,
  ordersSchema,
  fillsSchema,
  type PerpState,
  type SpotState,
  type SpotMeta,
  type Portfolio,
  type Position,
} from "./types";
import { calculateEffectiveLeverage } from "../dca/simulator";
export const getPerpState = (user: string) =>
  info(
    { type: "clearinghouseState", user: addressSchema.parse(user) },
    perpSchema,
  );
export const getSpotState = (user: string) =>
  info(
    { type: "spotClearinghouseState", user: addressSchema.parse(user) },
    spotSchema,
  );
export const getOpenOrders = (user: string) =>
  info({ type: "openOrders", user: addressSchema.parse(user) }, ordersSchema);
export const getUserFills = (user: string) =>
  info({ type: "userFills", user: addressSchema.parse(user) }, fillsSchema);
export function normalizePortfolio(
  address: string,
  perp: PerpState,
  spot: SpotState,
  meta: SpotMeta,
  mids: Record<string, number>,
  mode: "standard" | "unifiedAccount" = "standard",
): Portfolio {
  const warnings: string[] = [];
  const positions: Position[] = perp.assetPositions.flatMap(
    ({ position: p }) => {
      if (p.szi === 0) return [];
      const mark = Math.abs(p.positionValue / p.szi);
      return [
        {
          coin: p.coin,
          side: p.szi < 0 ? ("short" as const) : ("long" as const),
          size: Math.abs(p.szi),
          usdValue: Math.abs(p.positionValue),
          markPrice: mark,
          entryPrice: p.entryPx ?? undefined,
          unrealizedPnl: p.unrealizedPnl,
          leverage: p.leverage.value,
        },
      ];
    },
  );
  let spotValue = 0;
  let usdcBalance = 0;
  for (const balance of spot.balances) {
    if (balance.total === 0) continue;
    const token = meta.tokens.find((t) => t.index === balance.token);
    const price = spotPrice(balance.token, meta, mids);
    if (price === null) {
      warnings.push(
        `Unpriced spot token ${balance.coin}: excluded from totals.`,
      );
      continue;
    }
    const value = balance.total * price;
    spotValue += value;
    if (token?.name === "USDC") {
      usdcBalance += value;
      continue;
    }
    positions.push({
      coin: token?.name ?? balance.coin,
      side: "spot",
      size: balance.total,
      usdValue: value,
      markPrice: price,
    });
  }
  // Unified collateral already lives in spot balances; never add per-DEX equity.
  const accountValue = mode === "unifiedAccount" ? spotValue : perp.marginSummary.accountValue + spotValue;
  let withdrawable = perp.withdrawable;
  if (mode === "unifiedAccount") {
    const usdc = meta.tokens.find(t => t.name === "USDC");
    const cash = spot.balances.find(b => b.token === usdc?.index);
    const available = spot.tokenToAvailableAfterMaintenance?.find(([token]) => token === usdc?.index)?.[1];
    withdrawable = available === undefined ? 0 : Math.max(0, Math.min(available, cash ? cash.total - cash.hold : 0));
    warnings.push("Unified account: equity uses spot balances once. Available USDC reflects holds and maintenance requirements; per-DEX equity is not added.");
    if (available === undefined) warnings.push("Available unified USDC is unavailable; displayed as zero.");
  }
  const totalExposure = positions.reduce(
    (sum, p) => sum + Math.abs(p.usdValue),
    0,
  );
  const exposure = (coin: string) =>
    positions
      .filter((p) => p.coin === coin)
      .reduce(
        (sum, p) => sum + (p.side === "short" ? -p.usdValue : p.usdValue),
        0,
      );
  warnings.push(
    "Balances cover spot assets; perpetual positions and exposure cover the main DEX only. Excludes vaults, staking, other DEX positions and linked subaccounts.",
  );
  return {
    address,
    accountValue,
    withdrawable,
    btcExposure: exposure("BTC") + exposure("UBTC"),
    hypeExposure: exposure("HYPE"),
    usdcBalance,
    positions,
    totalExposure,
    effectiveLeverage: calculateEffectiveLeverage(totalExposure, accountValue),
    warnings,
    source: "live",
    asOf: new Date().toISOString(),
    openOrders: [],
    recentFills: [],
  };
}
export async function getPortfolio(address: string) {
  addressSchema.parse(address);
  const mode = await info(
    { type: "userAbstraction", user: address },
    z.enum([
      "unifiedAccount",
      "portfolioMargin",
      "disabled",
      "default",
      "dexAbstraction",
    ]),
  );
  if (
    mode === "portfolioMargin" ||
    mode === "dexAbstraction"
  )
    throw new Error("Unsupported account mode");
  const [perp, spot, meta, mids] = await Promise.all([
    getPerpState(address),
    getSpotState(address),
    getSpotMeta(),
    getAllMids(),
  ]);
  const portfolio = normalizePortfolio(address, perp, spot, meta, mids, mode === "unifiedAccount" ? "unifiedAccount" : "standard");
  const [orders, fills] = await Promise.allSettled([
    getOpenOrders(address),
    getUserFills(address),
  ]);
  if (orders.status === "fulfilled") portfolio.openOrders = orders.value;
  else portfolio.warnings.push("Open orders unavailable.");
  if (fills.status === "fulfilled")
    portfolio.recentFills = fills.value.slice(0, 10);
  else portfolio.warnings.push("Recent fills unavailable.");
  return portfolio;
}

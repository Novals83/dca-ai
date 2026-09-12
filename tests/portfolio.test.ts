import { it, expect } from "vitest";
import { normalizePortfolio } from "../lib/hyperliquid/portfolio";
import { spotPrice } from "../lib/hyperliquid/market";
import { perpSchema, midsSchema } from "../lib/hyperliquid/types";
const meta = {
  tokens: [
    { name: "USDC", index: 0 },
    { name: "HYPE", index: 150 },
  ],
  universe: [{ name: "@107", index: 107, tokens: [150, 0] }],
};
const perp = {
  marginSummary: { accountValue: 1000, totalRawUsd: 900 },
  withdrawable: 500,
  assetPositions: [
    {
      position: {
        coin: "BTC",
        szi: -0.02,
        entryPx: 110000,
        positionValue: 2000,
        unrealizedPnl: 100,
        leverage: { value: 2 },
      },
    },
  ],
};
it("prices HYPE by spot pair index, not token index or perp ticker", () =>
  expect(spotPrice(150, meta, { "@107": 40, HYPE: 41, "@150": 500 })).toBe(40));
it("normalizes short exposure and never adds notional to equity", () => {
  const p = normalizePortfolio(
    "x",
    perp,
    {
      balances: [
        { coin: "HYPE", token: 150, total: 10, hold: 2 },
        { coin: "USDC", token: 0, total: 500, hold: 0 },
      ],
    },
    meta,
    { "@107": 40 },
  );
  expect(p.accountValue).toBe(1900);
  expect(p.btcExposure).toBe(-2000);
  expect(p.hypeExposure).toBe(400);
  expect(p.totalExposure).toBe(2400);
  expect(p.usdcBalance).toBe(500);
});
it("reports unpriced token rather than inventing a valuation", () => {
  const p = normalizePortfolio(
    "x",
    perp,
    { balances: [{ coin: "UNKNOWN", token: 999, total: 10, hold: 0 }] },
    meta,
    {},
  );
  expect(p.accountValue).toBe(1000);
  expect(p.warnings.join(" ")).toContain("Unpriced");
});
it("parses numeric strings explicitly and rejects empty or nonfinite values", () => {
  expect(midsSchema.parse({ BTC: "100000" })).toEqual({ BTC: 100000 });
  for (const BTC of ["", " ", "NaN", "Infinity"])
    expect(() => midsSchema.parse({ BTC })).toThrow();
  expect(perpSchema.parse(perp)).toEqual(perp);
});

it("rejects unsupported unified account before combining balances", async () => {
  const { vi } = await import("vitest");
  const { getPortfolio } = await import("../lib/hyperliquid/portfolio");
  const mock = vi
    .fn()
    .mockResolvedValue(
      new Response(JSON.stringify("unifiedAccount"), { status: 200 }),
    );
  vi.stubGlobal("fetch", mock);
  try {
    await expect(
      getPortfolio("0x1111111111111111111111111111111111111111"),
    ).rejects.toThrow("Unsupported account mode");
    expect(mock).toHaveBeenCalledTimes(1);
  } finally {
    vi.unstubAllGlobals();
  }
});

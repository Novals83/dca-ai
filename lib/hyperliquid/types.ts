import { z } from "zod";
const numeric = z
  .union([
    z.string().regex(/^-?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i),
    z.number(),
  ])
  .transform(Number)
  .pipe(z.number().finite());
export const perpSchema = z.object({
  marginSummary: z.object({ accountValue: numeric, totalRawUsd: numeric }),
  withdrawable: numeric,
  assetPositions: z.array(
    z.object({
      position: z.object({
        coin: z.string(),
        szi: numeric,
        entryPx: numeric.nullable(),
        positionValue: numeric,
        unrealizedPnl: numeric,
        leverage: z.object({ value: numeric }),
      }),
    }),
  ),
});
export const spotSchema = z.object({
  balances: z.array(
    z.object({
      coin: z.string(),
      token: z.number(),
      total: numeric,
      hold: numeric,
    }),
  ),
});
export const metaSchema = z.object({
  tokens: z.array(z.object({ name: z.string(), index: z.number() })),
  universe: z.array(
    z.object({
      name: z.string(),
      index: z.number(),
      tokens: z.array(z.number()),
    }),
  ),
});
export const midsSchema = z.record(z.string(), numeric);
export const ordersSchema = z.array(
  z.object({
    coin: z.string(),
    side: z.string(),
    limitPx: numeric,
    sz: numeric,
    oid: z.number(),
  }),
);
export const fillsSchema = z.array(
  z.object({
    coin: z.string(),
    side: z.string(),
    px: numeric,
    sz: numeric,
    time: z.number(),
  }),
);
export type PerpState = z.infer<typeof perpSchema>;
export type SpotState = z.infer<typeof spotSchema>;
export type SpotMeta = z.infer<typeof metaSchema>;
export type Position = {
  coin: string;
  side: "long" | "short" | "spot";
  size: number;
  usdValue: number;
  entryPrice?: number;
  markPrice: number;
  unrealizedPnl?: number;
  leverage?: number;
};
export type Portfolio = {
  address: string;
  accountValue: number;
  withdrawable: number;
  btcExposure: number;
  hypeExposure: number;
  usdcBalance: number;
  positions: Position[];
  totalExposure: number;
  effectiveLeverage: number | null;
  pnlDay?: number;
  pnlWeek?: number;
  warnings: string[];
  source: "demo" | "live";
  asOf: string;
  openOrders: z.infer<typeof ordersSchema>;
  recentFills: z.infer<typeof fillsSchema>;
};
export type Market = {
  BTC: number;
  HYPE: number;
  asOf: string;
  source: "live" | "demo";
};

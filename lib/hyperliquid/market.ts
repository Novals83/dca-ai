import { info } from "./client";
import { midsSchema, metaSchema, type SpotMeta, type Market } from "./types";
export const getAllMids = () => info({ type: "allMids" }, midsSchema);
export const getSpotMeta = () => info({ type: "spotMeta" }, metaSchema);
export function spotPrice(
  tokenIndex: number,
  meta: SpotMeta,
  mids: Record<string, number>,
): number | null {
  const token = meta.tokens.find((t) => t.index === tokenIndex);
  if (token?.name === "USDC") return 1;
  const pair = meta.universe.find(
    (p) =>
      p.tokens[0] === tokenIndex &&
      meta.tokens.find((t) => t.index === p.tokens[1])?.name === "USDC",
  );
  if (!pair) return null;
  const value = mids[pair.name] ?? mids[`@${pair.index}`];
  return value > 0 ? value : null;
}
export async function getMarket(): Promise<Market> {
  const [mids, meta] = await Promise.all([getAllMids(), getSpotMeta()]);
  const hype = meta.tokens.find((t) => t.name === "HYPE");
  const HYPE = hype ? spotPrice(hype.index, meta, mids) : null;
  if (!(mids.BTC > 0) || !HYPE) throw new Error("Market prices unavailable");
  return {
    BTC: mids.BTC,
    HYPE,
    asOf: new Date().toISOString(),
    source: "live",
  };
}
export const getBTCPrice = async () => (await getMarket()).BTC;
export const getHYPEPrice = async () => (await getMarket()).HYPE;

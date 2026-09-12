import Decimal from "decimal.js";
import { z } from "zod";
const amount = z.string().regex(/^-?\d+(\.\d+)?$/);
export const tradingSpotSchema = z.object({
  balances: z.array(z.object({token: z.number().int().optional(), total: amount, hold: amount})),
  tokenToAvailableAfterMaintenance: z.array(z.tuple([z.number().int(), amount])).optional(),
});
export function purchaseBalance(mode: string, spot: z.infer<typeof tradingSpotSchema>, token: number) {
  const blockers: string[] = [];
  const balance = spot.balances.find(b => b.token === token);
  const free = balance ? Decimal.max(0, new Decimal(balance.total).minus(Decimal.max(0, balance.hold))) : new Decimal(0);
  let available = free;
  if (mode === "unifiedAccount") {
    const maintenance = spot.tokenToAvailableAfterMaintenance?.find(([id]) => id === token);
    if (!maintenance) {
      available = new Decimal(0);
      blockers.push("Unified account available USDC could not be verified. Refresh the quote before buying.");
    } else {
      // Never spend collateral reserved by Hyperliquid or exceed actual unheld cash.
      available = Decimal.max(0, Decimal.min(free, maintenance[1]));
    }
  } else if (!["default", "disabled"].includes(mode)) {
    available = new Decimal(0);
    blockers.push("Spot purchases support standard and unified accounts. Portfolio margin and DEX abstraction are not supported yet.");
  }
  return {available, blockers};
}

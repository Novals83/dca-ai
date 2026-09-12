import { demoStrategy } from "../demo";
import { z } from "zod";
import { strategySchema, type Strategy } from "../dca/simulator";
const savedSchema = z.object({
  version: z.literal(1),
  strategy: strategySchema.nullable(),
  savedAt: z.string(),
});
export interface StrategyStorage {
  load(account: string): Promise<Strategy | null>;
  save(account: string, strategy: Strategy): Promise<void>;
  remove(account: string): Promise<void>;
}
export const localStrategyStorage: StrategyStorage = {
  async load(account) {
    const raw = localStorage.getItem(`dca-ai:v1:${account.toLowerCase()}`);
    if (!raw) return account === "demo" ? demoStrategy : null;
    const parsed = savedSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) throw new Error("Saved strategy could not be read");
    return parsed.data.strategy;
  },
  async save(account, strategy) {
    localStorage.setItem(
      `dca-ai:v1:${account.toLowerCase()}`,
      JSON.stringify({
        version: 1,
        strategy: strategySchema.parse(strategy),
        savedAt: new Date().toISOString(),
      }),
    );
  },
  async remove(account) {
    localStorage.setItem(
      `dca-ai:v1:${account.toLowerCase()}`,
      JSON.stringify({
        version: 1,
        strategy: null,
        savedAt: new Date().toISOString(),
      }),
    );
  },
};

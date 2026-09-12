import { z } from "zod";
export const planSchema = z.object({
  version: z.literal(1),
  account: z.string().regex(/^0x[0-9a-f]{40}$/),
  market: z.literal("spot"),
  amount: z.number().finite().min(10).max(100000),
  budget: z.number().finite().min(10).max(1000000),
  btcPercent: z.number().int().min(0).max(100),
  frequency: z.enum(["daily", "weekly", "monthly"]),
  startAt: z.iso.datetime(),
  status: z.literal("draft"),
}).refine(p => p.budget >= p.amount, "Budget must cover at least one purchase");
export type DCAPlan = z.infer<typeof planSchema>;
// Calendar recurrence in UTC. Monthly dates clamp to the last day of a month
// without moving the original anchor (Jan 31 -> Feb 28 -> Mar 31).
export function occurrence(startAt: string, frequency: DCAPlan["frequency"], index: number) {
  if (!Number.isSafeInteger(index) || index < 0) throw new Error("Invalid occurrence index");
  const anchor = new Date(startAt);
  if (!Number.isFinite(anchor.getTime())) throw new Error("Invalid start time");
  const next = new Date(anchor);
  if (frequency === "monthly") {
    next.setUTCDate(1);
    next.setUTCMonth(anchor.getUTCMonth() + index);
    const last = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate();
    next.setUTCDate(Math.min(anchor.getUTCDate(), last));
  } else next.setUTCDate(anchor.getUTCDate() + index * (frequency === "weekly" ? 7 : 1));
  return next.toISOString();
}
export function planSummary(raw: DCAPlan) {
  const plan = planSchema.parse(raw);
  const cents = Math.round(plan.amount * 100);
  const budgetCents = Math.round(plan.budget * 100);
  const count = Math.floor(budgetCents / cents);
  const btcCents = Math.round(cents * plan.btcPercent / 100);
  return {
    count, btc: btcCents / 100, hype: (cents - btcCents) / 100,
    allocated: count * cents / 100, remainder: (budgetCents - count * cents) / 100,
    nextRuns: Array.from({ length: Math.min(count, 5) }, (_, i) => occurrence(plan.startAt, plan.frequency, i)),
  };
}
export function loadPlan(account: string): DCAPlan | null {
  const raw = localStorage.getItem(`dca-ai:plan:v1:${account.toLowerCase()}`);
  if (!raw) return null;
  const parsed = planSchema.parse(JSON.parse(raw));
  if (parsed.account !== account.toLowerCase()) throw new Error("Plan belongs to another account");
  return parsed;
}
export function savePlan(plan: DCAPlan) {
  const parsed = planSchema.parse(plan);
  localStorage.setItem(`dca-ai:plan:v1:${parsed.account}`, JSON.stringify(parsed));
}

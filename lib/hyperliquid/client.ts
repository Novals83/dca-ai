import { z } from "zod";
export const addressSchema = z
  .string()
  .regex(/^0x[0-9a-fA-F]{40}$/, "Enter a valid 0x account address");
export async function info<T>(
  body: Record<string, unknown>,
  schema: z.ZodType<T>,
): Promise<T> {
  const response = await fetch("https://api.hyperliquid.xyz/info", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(12000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Hyperliquid unavailable");
  return schema.parse(await response.json());
}

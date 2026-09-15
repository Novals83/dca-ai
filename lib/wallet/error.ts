// Preserve useful provider diagnostics without serializing SDK requests or typed data.
export function walletError(error: unknown): string {
  const messages: string[] = [];
  const seen = new Set<unknown>();
  let current = error;
  for (let depth = 0; depth < 8 && current && typeof current === "object" && !seen.has(current); depth++) {
    seen.add(current);
    const item = current as {code?: unknown; shortMessage?: unknown; message?: unknown; cause?: unknown};
    if (item.code === 4001) return "Wallet signature was rejected. No order was sent.";
    const value = typeof item.shortMessage === "string" ? item.shortMessage : item.message;
    if (typeof value === "string") {
      const first = value.split(/\n|Request Arguments:|Raw Call Arguments:/)[0].slice(0, 300);
      if (first && !messages.includes(first)) messages.push(first);
    }
    current = item.cause;
  }
  return messages.slice(-3).join(" → ") || "Wallet signing failed. No order was sent.";
}

import { ExchangeClient } from "@nktkas/hyperliquid";
import { createWalletClient, custom } from "viem";
import type { WalletProvider } from "@/lib/wallet/provider";
import { walletAddress } from "@/lib/wallet/provider";
import { walletError } from "@/lib/wallet/error";
import type { Quote } from "./quote";
export type PurchaseRecord = { quote: Quote; state: "pending" | "result" | "unknown" | "not_sent"; response?: unknown; updatedAt: string };
export function recordKey(account: string) { return `dca-ai:purchase:${account.toLowerCase()}`; }
export function saveRecord(record: PurchaseRecord) { localStorage.setItem(recordKey(record.quote.account), JSON.stringify(record)); }
// No retries. A transport error after dispatch is UNKNOWN, not a failed purchase.
export async function executePurchase(provider: WalletProvider, quote: Quote, isCurrent: () => boolean): Promise<PurchaseRecord> {
  if (quote.blockers.length || !quote.legs.length || Date.now() >= quote.expiresAt) throw new Error("Prepare a new valid quote first.");
  if (!navigator.locks) throw new Error("Use a browser with Web Locks support.");
  return navigator.locks.request(`dca-ai:purchase:${quote.account}`, {ifAvailable: true}, async lock => {
    if (!lock) throw new Error("Another purchase is in progress for this wallet.");
    const old = localStorage.getItem(recordKey(quote.account));
    if (old) {
      const previous = JSON.parse(old) as PurchaseRecord;
      if (["pending", "unknown"].includes(previous.state)) throw new Error("Reconcile the previous purchase in Hyperliquid before creating another one.");
      if (previous.quote.id === quote.id && previous.state !== "not_sent") throw new Error("This purchase was already submitted.");
    }
    const assertCurrent = async () => {
      if (!isCurrent() || Date.now() >= quote.expiresAt) throw new Error("Quote expired or wallet changed. Prepare again.");
      if (walletAddress(await provider.request({method: "eth_accounts"})) !== quote.account) throw new Error("Wallet account changed.");
    };
    await assertCurrent();
    const record: PurchaseRecord = {quote, state: "pending", updatedAt: new Date().toISOString()};
    saveRecord(record); // Storage must work before requesting a signature.
    let dispatched = false;
    let response: unknown;
    try {
      const wallet = createWalletClient({account: quote.account as `0x${string}`, transport: custom(provider)});
      const exchange = new ExchangeClient({wallet, transport: {
        isTestnet: false,
        async request<T>(endpoint: "info" | "exchange", payload: unknown): Promise<T> {
          if (endpoint !== "exchange") throw new Error("Unexpected endpoint");
          await assertCurrent(); // Recheck after the signature dialog, before sending.
          dispatched = true;
          const result = await fetch("https://api.hyperliquid.xyz/exchange", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(payload), signal: AbortSignal.timeout(20000)});
          if (!result.ok) throw new Error("Exchange response unavailable");
          response = await result.json();
          return response as T;
        },
      }});
      await exchange.order({orders: quote.legs.map(leg => ({a: leg.asset, b: true, p: leg.price, s: leg.size, r: false, t: {limit: {tif: "Ioc" as const}}, c: leg.cloid})), grouping: "na"}, {expiresAfter: quote.expiresAt});
      record.state = "result";
      record.response = response;
    } catch (e) {
      record.state = response !== undefined ? "result" : dispatched ? "unknown" : "not_sent";
      record.response = response ?? {message: dispatched ? "Result unknown. Do not retry: check order history using the client order IDs." : walletError(e)};
    }
    record.updatedAt = new Date().toISOString();
    saveRecord(record);
    return record;
  });
}

import type {WalletProvider} from "../wallet/provider";
import {walletAddress} from "../wallet/provider";
import type {Quote} from "./quote";
export type PurchaseRecord = {quote:Quote;state:"pending"|"result"|"unknown"|"not_sent";response?:unknown;updatedAt:string};
export function recordKey(account:string) {return `dca-ai:purchase:${account.toLowerCase()}`;}
export function saveRecord(record:PurchaseRecord) {localStorage.setItem(recordKey(record.quote.account),JSON.stringify(record));}
export async function refreshPurchase(quote:Quote):Promise<PurchaseRecord|null> {
  const response=await fetch("/api/trading/execute",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({account:quote.account,quoteId:quote.id,action:"status"}),signal:AbortSignal.timeout(15000)});
  if (!response.ok) throw new Error("Could not read the server journal. Do not resend.");
  const result=await response.json();
  if (result.record) saveRecord(result.record);
  return result.record;
}
export async function executePurchase(provider:WalletProvider,quote:Quote,isCurrent:()=>boolean):Promise<PurchaseRecord> {
  if (quote.blockers.length || !quote.legs.length || Date.now()>=quote.expiresAt) throw new Error("Prepare a new valid quote first.");
  if (!navigator.locks) throw new Error("Use a browser with Web Locks support.");
  return navigator.locks.request(`dca-ai:purchase:${quote.account}`,{ifAvailable:true},async lock=>{
    if (!lock) throw new Error("Another purchase is in progress.");
    const previous=localStorage.getItem(recordKey(quote.account));
    if (previous) {
      const old=JSON.parse(previous) as PurchaseRecord;
      if (["pending","unknown"].includes(old.state)) throw new Error("Refresh the previous purchase result before continuing.");
      if (old.quote.id===quote.id && old.state!=="not_sent") throw new Error("This purchase was already submitted.");
    }
    const accounts=await provider.request({method:"eth_accounts"});
    if (!isCurrent() || Date.now()>=quote.expiresAt || walletAddress(accounts)!==quote.account) throw new Error("Wallet changed or quote expired. Prepare again.");
    const pending:PurchaseRecord={quote,state:"pending",updatedAt:new Date().toISOString()};
    saveRecord(pending);
    try {
      // One request, no retry. The server journals and signs with the local agent.
      const response=await fetch("/api/trading/execute",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({account:quote.account,quoteId:quote.id,action:"execute"}),signal:AbortSignal.timeout(45000)});
      if (!response.ok) throw new Error("Execution response unavailable");
      const result=await response.json();
      if (!result.record) throw new Error("Execution response unavailable");
      saveRecord(result.record);
      return result.record;
    } catch {
      const unknown:PurchaseRecord={...pending,state:"unknown",response:{message:"Server result unavailable. Refresh result; do not submit another purchase."},updatedAt:new Date().toISOString()};
      saveRecord(unknown); return unknown;
    }
  });
}

import { existsSync, mkdirSync, readFileSync, writeFileSync, linkSync, unlinkSync, renameSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { z } from "zod";
const schema = z.object({account: z.string().regex(/^0x[0-9a-f]{40}$/), privateKey: z.string().regex(/^0x[0-9a-f]{64}$/), name: z.string(), expiresAt: z.number(), createdAt: z.number()});
// This module is server-only. Never serialize its stored private key into an API response.
export function getAgent(account: string, create: boolean, directory = process.env.AGENT_DATA_DIR || "/app/.agent-data") {
  if (!/^0x[0-9a-f]{40}$/.test(account)) throw new Error("Invalid account");
  const path = join(directory, `${account}.json`);
  const read = () => schema.parse(JSON.parse(readFileSync(path, "utf8")));
  let stored;
  try { stored = read(); } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw new Error("Agent storage unavailable");
    if (!create) return null;
    mkdirSync(directory, {recursive: true, mode: 0o700});
    const now = Date.now();
    const candidate = {account, privateKey: generatePrivateKey(), name: `dca-${randomUUID().slice(0,8)}`, createdAt: now, expiresAt: now + 7 * 86400000};
    const temporary = join(directory, `${randomUUID()}.tmp`);
    writeFileSync(temporary, JSON.stringify(candidate), {flag: "wx", mode: 0o600});
    try { linkSync(temporary, path); } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw new Error("Agent storage unavailable");
    } finally { unlinkSync(temporary); }
    stored = read();
  }
  if (stored.account !== account) throw new Error("Agent account mismatch");
  const address = privateKeyToAccount(stored.privateKey as `0x${string}`).address;
  return {account, address, name: stored.name, expiresAt: stored.expiresAt, wasAuthorized: existsSync(join(directory, `${account}.authorized`))};
}

export function markAgentAuthorized(account: string, directory = process.env.AGENT_DATA_DIR || "/app/.agent-data") {
  if (!/^0x[0-9a-f]{40}$/.test(account)) throw new Error("Invalid account");
  try { writeFileSync(join(directory, `${account}.authorized`), "observed", {flag: "wx", mode: 0o600}); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw new Error("Agent storage unavailable"); }
}

// Return a local signer only to server execution code. Never return this from a route.
export function loadAgentSigner(account: string) {
  if (!/^0x[0-9a-f]{40}$/.test(account)) throw new Error("Invalid account");
  const directory = process.env.AGENT_DATA_DIR || "/app/.agent-data";
  const stored = schema.parse(JSON.parse(readFileSync(join(directory, `${account}.json`), "utf8")));
  if (stored.account !== account || stored.expiresAt <= Date.now()) throw new Error("Agent unavailable");
  return privateKeyToAccount(stored.privateKey as `0x${string}`);
}

// Update local policy only after the route verifies the exchange authorization.
export function syncAgentExpiry(account:string,address:string,expiresAt:number,directory=process.env.AGENT_DATA_DIR || "/app/.agent-data") {
 if (!/^0x[0-9a-f]{40}$/.test(account) || !Number.isSafeInteger(expiresAt)) throw new Error("Invalid agent expiry");
 const path=join(directory,`${account}.json`);
 const stored=schema.parse(JSON.parse(readFileSync(path,"utf8")));
 if(privateKeyToAccount(stored.privateKey as `0x${string}`).address.toLowerCase()!==address.toLowerCase())throw new Error("Agent changed");
 if(expiresAt<=stored.expiresAt)return;
 const temporary=join(directory,`${randomUUID()}.tmp`);
 writeFileSync(temporary,JSON.stringify({...stored,expiresAt}),{flag:"wx",mode:0o600});
 renameSync(temporary,path);
}

export function pendingAgent(account:string,create:boolean,expiresAt:number,directory=process.env.AGENT_DATA_DIR || "/app/.agent-data") {
 const pending=join(directory,"pending");
 const existing=getAgent(account,false,pending);
 if(existing || !create)return existing;
 const candidate=getAgent(account,true,pending)!;
 // No signature has been requested for this fresh address yet.
 syncAgentExpiry(account,candidate.address,Math.max(expiresAt,candidate.expiresAt),pending);
 return getAgent(account,false,pending);
}

// Caller must hold the account execution lock and verify this exact address on the exchange.
export function activatePendingAgent(account:string,address:string,validUntil:number|null,directory=process.env.AGENT_DATA_DIR || "/app/.agent-data") {
 const pending=join(directory,"pending");
 const candidate=getAgent(account,false,pending);
 if(!candidate || candidate.address.toLowerCase()!==address.toLowerCase() || candidate.expiresAt<=Date.now() || (validUntil!==null && validUntil<candidate.expiresAt))throw new Error("Replacement authorization is not valid for the requested lifetime");
 const target=join(directory,`${account}.json`);
 const archive=join(directory,"retired");mkdirSync(archive,{recursive:true,mode:0o700});
 if(existsSync(target))linkSync(target,join(archive,`${account}.${randomUUID()}.json`));
 renameSync(join(pending,`${account}.json`),target);
 markAgentAuthorized(account,directory);
 return getAgent(account,false,directory)!;
}

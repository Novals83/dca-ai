import { existsSync, mkdirSync, readFileSync, writeFileSync, linkSync, unlinkSync } from "node:fs";
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

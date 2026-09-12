import {mkdirSync, readFileSync, writeFileSync, renameSync, openSync, fsyncSync, closeSync, rmdirSync} from "node:fs";
import {join} from "node:path";
import {randomUUID} from "node:crypto";
import type {Quote} from "./quote";
import type {PurchaseRecord} from "./execute";
export const journalDirectory = () => join(process.env.AGENT_DATA_DIR || "/app/.agent-data", "purchases");
function file(id: string, suffix: string) {
  if (!/^[0-9a-f-]{36}$/.test(id)) throw new Error("Invalid purchase ID");
  return join(journalDirectory(), `${id}.${suffix}.json`);
}
function write(path: string, value: unknown) {
  mkdirSync(journalDirectory(), {recursive: true, mode: 0o700});
  const temp = `${path}.${randomUUID()}.tmp`;
  writeFileSync(temp, JSON.stringify(value), {flag: "wx", mode: 0o600});
  const fd = openSync(temp, "r"); try {fsyncSync(fd);} finally {closeSync(fd);}
  renameSync(temp, path);
  const dir = openSync(journalDirectory(), "r"); try {fsyncSync(dir);} finally {closeSync(dir);}
}
export function persistQuote(quote: Quote) { write(file(quote.id, "quote"), quote); }
export function readQuote(id: string): Quote { return JSON.parse(readFileSync(file(id, "quote"), "utf8")); }
export function readResult(id: string): PurchaseRecord | null {
  try {return JSON.parse(readFileSync(file(id, "result"), "utf8"));} catch (e) {if ((e as NodeJS.ErrnoException).code === "ENOENT") return null; throw e;}
}
export function persistResult(record: PurchaseRecord) {write(file(record.quote.id, "result"), record);}
function accountFile(account: string) {
  if (!/^0x[0-9a-f]{40}$/.test(account)) throw new Error("Invalid account");
  return join(journalDirectory(), account);
}
export function lockAccount(account: string) {
  mkdirSync(journalDirectory(), {recursive:true, mode:0o700});
  const path = `${accountFile(account)}.lock`;
  mkdirSync(path, {mode:0o700});
  return () => rmdirSync(path);
}
export function lastResult(account: string): PurchaseRecord | null {
  let id;
  try {id=readFileSync(`${accountFile(account)}.latest`, "utf8");} catch(e) {if ((e as NodeJS.ErrnoException).code === "ENOENT") return null; throw e;}
  return readResult(JSON.parse(id));
}
export function rememberResult(record: PurchaseRecord) {
  persistResult(record);
  write(`${accountFile(record.quote.account)}.latest`, record.quote.id);
}

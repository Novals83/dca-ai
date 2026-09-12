import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { getAgent, markAgentAuthorized } from "../lib/agent/store";
const directories: string[] = [];
const directory = () => {const d = mkdtempSync(join(tmpdir(), "dca-agent-test-")); directories.push(d); return d;};
const account = `0x${"1".repeat(40)}`;
afterEach(() => { for (const d of directories.splice(0)) rmSync(d, {recursive: true, force: true}); });
describe("local agent custody", () => {
  it("does not create a key during a status check", () => {
    const d = directory(); expect(getAgent(account, false, d)).toBeNull(); expect(readdirSync(d)).toEqual([]);
  });
  it("persists one key per master account but returns only public metadata", () => {
    const d = directory(); const first = getAgent(account, true, d)!;
    expect(getAgent(account, true, d)).toEqual(first);
    expect(first.account).toBe(account); expect(first.address.toLowerCase()).not.toBe(account);
    const file = join(d, `${account}.json`); const saved = JSON.parse(readFileSync(file, "utf8"));
    expect(JSON.stringify(first)).not.toContain(saved.privateKey);
    expect(statSync(file).mode & 0o777).toBe(0o600);
    expect(first.expiresAt - saved.createdAt).toBe(7 * 86400000);
  });
  it("remembers observed authorization so revoked keys cannot silently re-register", () => {
    const d = directory(); getAgent(account, true, d); markAgentAuthorized(account, d);
    expect(getAgent(account, false, d)?.wasAuthorized).toBe(true);
  });
  it("rejects path traversal and keeps accounts isolated", () => {
    const d = directory(); expect(() => getAgent("../secret", true, d)).toThrow();
    expect(getAgent(account, true, d)?.address).not.toBe(getAgent(`0x${"2".repeat(40)}`, true, d)?.address);
  });
});

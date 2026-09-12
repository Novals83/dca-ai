"use client";
import { useEffect, useRef, useState } from "react";
import { ExchangeClient } from "@nktkas/hyperliquid";
import { createWalletClient, custom } from "viem";
import { Button } from "@/components/ui/button";
import { walletAddress, type WalletProvider } from "@/lib/wallet/provider";
type Agent = {configured: boolean; account?: string; address?: `0x${string}`; name?: string; expiresAt?: number; status?: string; validUntil?: number | null};
export function AgentPanel({account, provider}: {account: string; provider: WalletProvider}) {
  const [agent, setAgent] = useState<Agent | null>(null);
  const [busy, setBusy] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [message, setMessage] = useState("");
  const active = useRef(true);
  const working = useRef(false);
  useEffect(() => { active.current = true; return () => {active.current = false;}; }, []);
  async function status(create: boolean) {
    const response = await fetch("/api/agent", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({account, create}), signal: AbortSignal.timeout(20000)});
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Could not read agent status");
    if (active.current) {setAgent(result); setReviewed(false);}
    return result as Agent;
  }
  async function run(action: () => Promise<void>) {
    if (working.current) return;
    working.current = true; setBusy(true); setMessage("");
    try { await action(); } catch { if (active.current) setMessage("Operation was not confirmed. Refresh authorization status before trying again."); }
    finally {working.current = false; if (active.current) setBusy(false);}
  }
  async function approve() {
    if (!reviewed || !agent?.address || !agent.name || !agent.expiresAt || agent.status !== "not_authorized") return;
    const expected = agent;
    const check = async () => {
      if (!active.current || Date.now() >= expected.expiresAt! || walletAddress(await provider.request({method: "eth_accounts"})) !== account) throw new Error("Wallet changed or authorization expired");
    };
    await check();
    const client = new ExchangeClient({wallet: createWalletClient({account: account as `0x${string}`, transport: custom(provider)}), transport: {
      isTestnet: false,
      async request<T>(endpoint: "info" | "exchange", payload: unknown): Promise<T> {
        if (endpoint !== "exchange") throw new Error("Unexpected endpoint");
        await check();
        const response = await fetch("https://api.hyperliquid.xyz/exchange", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(payload), signal: AbortSignal.timeout(20000)});
        if (!response.ok) throw new Error("Authorization response unavailable");
        return await response.json() as T;
      },
    }});
    await client.approveAgent({agentAddress: agent.address, agentName: `${agent.name} valid_until ${agent.expiresAt}`});
    await status(false);
  }
  return <section className="plan-review">
    <h3>Local API agent · Mainnet</h3>
    <p>An API wallet can trade on behalf of your account without signing each order. It cannot withdraw funds, but its trading permission is broader than this DCA plan. Budget and spot-only limits must be enforced by this app.</p>
    <p>The private key stays in this deployment’s local storage. Only its public address is sent to your wallet for approval. Authorizing the agent does not start a scheduler.</p>
    <Button disabled={busy} onClick={() => void run(async () => {await status(false);})}>Refresh authorization</Button>{" "}
    {(!agent || !agent.configured) && <Button disabled={busy} onClick={() => void run(async () => {await status(true);})}>Prepare local agent</Button>}
    {agent?.configured && <>
      <p className="small">Account: {account}<br/>Agent: {agent.address}<br/>Name: {agent.name}</p>
      <p>Status: <strong>{agent.status?.replaceAll("_", " ")}</strong> · Local expiry: {new Date(agent.expiresAt!).toLocaleString()}</p>
      {agent.status === "not_authorized" && <>
        <label className="purchase-confirm"><input type="checkbox" disabled={busy} checked={reviewed} onChange={e => setReviewed(e.target.checked)}/> I authorize this local agent to trade for my account for up to 7 days. This permission is not limited to the draft budget.</label>
        <Button disabled={busy || !reviewed} onClick={() => void run(approve)}>Approve agent in wallet</Button>
      </>}
      {["expired", "revoked"].includes(agent.status || "") && <p>Create a fresh agent key before future use. Do not reuse an expired or revoked agent.</p>}
      <p>Start and pause recurring execution in Scheduled DCA. To revoke trading access, remove this agent in Hyperliquid’s API settings. Pausing a strategy will not revoke its permission.</p>
    </>}
    {message && <p role="alert" className="error">{message}</p>}
  </section>;
}

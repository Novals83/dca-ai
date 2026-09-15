"use client";
import { useEffect, useRef, useState } from "react";
import { ExchangeClient } from "@nktkas/hyperliquid";
import { createWalletClient, custom } from "viem";
import { Button } from "@/components/ui/button";
import { walletAddress, type WalletProvider } from "@/lib/wallet/provider";
import {walletError} from "@/lib/wallet/error";
import type {DCAPlan} from "@/lib/dca/schedule";
type Candidate={address:`0x${string}`;name:string;expiresAt:number};
type Agent = {replacement?:Candidate|null;configured: boolean; requiredUntil?:number|null; requestedUntil?:number; canAuthorize?:boolean; coverage?:boolean|null; account?: string; address?: `0x${string}`; name?: string; expiresAt?: number; status?: string; validUntil?: number | null};
export function AgentPanel({account, provider, plan}: {account: string; provider: WalletProvider; plan:DCAPlan|null}) {
  const [agent, setAgent] = useState<Agent | null>(null);
  const [busy, setBusy] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [message, setMessage] = useState("");
  const active = useRef(true);
  const working = useRef(false);
  useEffect(() => { active.current = true; return () => {active.current = false;}; }, []);
  async function status(create: boolean, replace=false) {
    const response = await fetch("/api/agent", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({account, create, replace, ...(plan?{plan}:{})}), signal: AbortSignal.timeout(20000)});
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Could not read agent status");
    if (active.current) {setAgent(result); setReviewed(false);}
    return result as Agent;
  }
  const refresh = useRef(status);
  useEffect(()=>{refresh.current=status;});
  useEffect(()=>{void refresh.current(false).catch(()=>{if(active.current)setMessage("Could not read authorization status. Refresh to retry.");});},[]);
  async function run(action: () => Promise<void>) {
    if (working.current) return;
    working.current = true; setBusy(true); setMessage("");
    try { await action(); } catch (error) { if (active.current) setMessage(`${walletError(error)} Refresh authorization status before retrying.`); }
    finally {working.current = false; if (active.current) setBusy(false);}
  }
  async function approve() {
    if (!reviewed || !agent?.address || !agent.name || !agent.requestedUntil || !agent.canAuthorize ) return;
    const target=agent.replacement;
    if(!target)throw new Error("Prepare a new agent address before requesting authorization");
    if(target.expiresAt<agent.requestedUntil)throw new Error("The prepared agent does not cover the edited strategy. Restore the reviewed schedule before signing.");
    const expected = agent;
    const check = async () => {
      if (!active.current || Date.now() >= expected.requestedUntil! || walletAddress(await provider.request({method: "eth_accounts"})) !== account) throw new Error("Wallet changed or authorization expired");
    };
    await check();
    const chainId=await provider.request({method:"eth_chainId"});
    if(typeof chainId!=="string" || !/^0x[0-9a-f]+$/i.test(chainId))throw new Error("Wallet returned an invalid chain ID");
    const client = new ExchangeClient({signatureChainId:chainId as `0x${string}`, wallet: createWalletClient({account: account as `0x${string}`, transport: custom(provider)}), transport: {
      isTestnet: false,
      async request<T>(endpoint: "info" | "exchange", payload: unknown): Promise<T> {
        if (endpoint !== "exchange") throw new Error("Unexpected endpoint");
        await check();
        if(await provider.request({method:"eth_chainId"})!==chainId)throw new Error("Wallet network changed. Reconnect before authorizing.");
        if(active.current)setMessage("Signature received. Submitting authorization to Hyperliquid…");
        const response = await fetch("https://api.hyperliquid.xyz/exchange", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(payload), signal: AbortSignal.timeout(20000)});
        if (!response.ok) throw new Error(`Hyperliquid authorization HTTP ${response.status}. Refresh status before retrying.`);
        return await response.json() as T;
      },
    }});
    if(active.current)setMessage("Confirm the agent authorization signature in your wallet…");
    await client.approveAgent({agentAddress: target.address, agentName: `${target.name} valid_until ${target.expiresAt}`});
    const result=await status(false);
    if(active.current)setMessage(result.coverage===true ? "Authorization verified. The entire strategy is covered." : "Hyperliquid accepted the request, but extended authorization is not yet verified. Refresh authorization status.");
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
      {agent.coverage===false && <p role="alert" className="error">Authorization does not cover the entire strategy. Required through {new Date(agent.requiredUntil!).toLocaleString()}. Renew before the next purchase.</p>}
      {agent.coverage===true && <p>Authorization covers the entire saved strategy and displayed draft.</p>}
      {!agent.canAuthorize && <p role="alert" className="error">The schedule exceeds the supported authorization window (179 days). Shorten the strategy before authorizing.</p>}
      {agent.canAuthorize && agent.coverage!==true && <>
        {!agent.replacement && <Button disabled={busy} onClick={()=>void run(async()=>{await status(false,true);})}>Prepare replacement agent</Button>}
        {agent.replacement && <>
        <p>New agent: <code>{agent.replacement.address}</code><br/>Authorization until {new Date(agent.replacement.expiresAt).toLocaleString()}. The current signer stays selected until this new permission is verified. The old permission is not revoked automatically.</p>
        <label className="purchase-confirm"><input type="checkbox" disabled={busy} checked={reviewed} onChange={e => setReviewed(e.target.checked)}/> I authorize this local agent to trade for my account until {new Date(agent.replacement.expiresAt).toLocaleString()}. This permission is not limited to the draft budget.</label>
        <Button disabled={busy || !reviewed} onClick={() => void run(approve)}>Authorize new agent in wallet</Button></>}
      </>}
      {["expired", "revoked"].includes(agent.status || "") && <p>Prepare a replacement below using a fresh address. Expired and revoked addresses are never reauthorized.</p>}
      <p>Start and pause recurring execution in Scheduled DCA. To revoke trading access, remove this agent in Hyperliquid’s API settings. Pausing a strategy will not revoke its permission.</p>
    </>}
    {message && <p role="alert" className="error">{message}</p>}
  </section>;
}

import { z } from "zod";
import { readBody, apiError } from "@/lib/http";
import { info } from "@/lib/hyperliquid/client";
import { getAgent, markAgentAuthorized, syncAgentExpiry, pendingAgent, activatePendingAgent } from "@/lib/agent/store";
import {planSchema} from "@/lib/dca/schedule";
import {requiredAgentExpiry,coversStrategy} from "@/lib/agent/coverage";
import {readStrategy} from "@/lib/dca/runtime/store";
import {lockAccount,lastResult} from "@/lib/trading/journal";
export const runtime = "nodejs";
const inputSchema = z.object({account: z.string().regex(/^0x[0-9a-fA-F]{40}$/).transform(s => s.toLowerCase()), create: z.boolean().default(false), replace: z.boolean().default(false), plan: planSchema.optional()});
export async function POST(request: Request) {
  try {
    // Key creation is for the local single-user deployment, never an unauthenticated cloud API.
    const origin = request.headers.get("origin");
    const host = request.headers.get("host");
    if (!origin || new URL(origin).host !== host || !["localhost", "127.0.0.1", "[::1]"].includes(new URL(origin).hostname)) throw new Error("Forbidden");
    const input = await readBody(request, inputSchema);
    const unlock=lockAccount(input.account);
    try {
    let agent = getAgent(input.account, input.create);
    if (!agent) return Response.json({configured: false}, {headers: {"Cache-Control": "no-store"}});
    // Always query the master account, never the signing agent address.
    const agents = await info({type: "extraAgents", user: input.account}, z.array(z.object({address: z.string(), name: z.string(), validUntil: z.number().nullable()})));
    const candidate=pendingAgent(input.account,false,0);
    const candidateApproval=candidate?agents.find(a=>a.address.toLowerCase()===candidate.address.toLowerCase()):null;
    if(candidate && candidateApproval && candidate.expiresAt>Date.now() && (candidateApproval.validUntil===null || candidateApproval.validUntil>=candidate.expiresAt)) {
      const prior=lastResult(input.account);
      if(prior && ["pending","unknown"].includes(prior.state))throw new Error("Resolve the uncertain purchase before activating the replacement agent");
      agent=activatePendingAgent(input.account,candidate.address,candidateApproval.validUntil);
    }
    const agentAddress=agent.address.toLowerCase();
    const approved = agents.find(a => a.address.toLowerCase() === agentAddress);
    if (approved) {
      markAgentAuthorized(input.account);
      if(approved.validUntil != null && approved.validUntil>Date.now() && agent.expiresAt>Date.now()) {
        syncAgentExpiry(input.account,agent.address,approved.validUntil);
        agent=getAgent(input.account,false)!;
      }
    }
    if(input.plan && input.plan.account!==input.account)throw new Error("Forbidden");
    const saved=readStrategy(input.account);
    const requirements=[input.plan,saved && saved.status!=="completed" ? saved.plan:null].filter(p=>p!=null).map(p=>requiredAgentExpiry(p));
    const requiredUntil=requirements.length?Math.max(...requirements):null;
    const requestedUntil=requiredUntil??Date.now()+7*86400000;
    const canAuthorize=requestedUntil>Date.now() && requestedUntil<=Date.now()+179*86400000;
    const coverage=requiredUntil===null?null:!!approved && coversStrategy(agent.expiresAt,approved.validUntil,requiredUntil);
    if(input.replace && !canAuthorize)throw new Error("The strategy is outside the supported authorization window");
    const replacement=pendingAgent(input.account,input.replace,requestedUntil);
    const expired = agent.expiresAt <= Date.now() || (approved?.validUntil != null && approved.validUntil <= Date.now());
    return Response.json({configured: true, ...agent, replacement, requiredUntil, requestedUntil, canAuthorize, coverage, status: expired ? "expired" : approved ? "authorized" : agent.wasAuthorized ? "revoked" : "not_authorized", validUntil: approved?.validUntil ?? null, scheduler: process.env.DCA_WORKER_ENABLED === "1"}, {headers: {"Cache-Control": "no-store"}});
    } finally {unlock();}
  } catch (error) { return apiError(error); }
}

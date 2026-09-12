import { z } from "zod";
import { readBody, apiError } from "@/lib/http";
import { info } from "@/lib/hyperliquid/client";
import { getAgent, markAgentAuthorized } from "@/lib/agent/store";
export const runtime = "nodejs";
const inputSchema = z.object({account: z.string().regex(/^0x[0-9a-fA-F]{40}$/).transform(s => s.toLowerCase()), create: z.boolean().default(false)});
export async function POST(request: Request) {
  try {
    // Key creation is for the local single-user deployment, never an unauthenticated cloud API.
    const origin = request.headers.get("origin");
    const host = request.headers.get("host");
    if (!origin || new URL(origin).host !== host || !["localhost", "127.0.0.1", "[::1]"].includes(new URL(origin).hostname)) throw new Error("Forbidden");
    const input = await readBody(request, inputSchema);
    const agent = getAgent(input.account, input.create);
    if (!agent) return Response.json({configured: false}, {headers: {"Cache-Control": "no-store"}});
    // Always query the master account, never the signing agent address.
    const agents = await info({type: "extraAgents", user: input.account}, z.array(z.object({address: z.string(), name: z.string(), validUntil: z.number().nullable()})));
    const approved = agents.find(a => a.address.toLowerCase() === agent.address.toLowerCase());
    if (approved) markAgentAuthorized(input.account);
    const expired = agent.expiresAt <= Date.now() || (approved?.validUntil != null && approved.validUntil <= Date.now());
    return Response.json({configured: true, ...agent, status: expired ? "expired" : approved ? "authorized" : agent.wasAuthorized ? "revoked" : "not_authorized", validUntil: approved?.validUntil ?? null, scheduler: process.env.DCA_WORKER_ENABLED === "1"}, {headers: {"Cache-Control": "no-store"}});
  } catch (error) { return apiError(error); }
}

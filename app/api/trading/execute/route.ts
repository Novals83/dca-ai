import {z} from "zod";
import {readBody, apiError} from "@/lib/http";
import {executeAgentPurchase} from "@/lib/trading/agent-execute";
import {readQuote, readResult} from "@/lib/trading/journal";
export const runtime="nodejs";
export async function POST(request:Request) {
  try {
    const origin=request.headers.get("origin");
    if (!origin || new URL(origin).host!==request.headers.get("host") || !["localhost","127.0.0.1","[::1]"].includes(new URL(origin).hostname)) throw new Error("Forbidden");
    const input=await readBody(request,z.object({account:z.string().regex(/^0x[0-9a-f]{40}$/),quoteId:z.string().uuid(),action:z.enum(["execute","status"])}));
    const quote=readQuote(input.quoteId);
    if (input.action==="execute" && quote.scheduledStrategyId) throw new Error("Forbidden");
    if (quote.account!==input.account) throw new Error("Forbidden");
    const result=input.action==="status" ? readResult(input.quoteId) : await executeAgentPurchase(input.account,input.quoteId);
    return Response.json({record:result},{headers:{"Cache-Control":"no-store"}});
  } catch(e) {return apiError(e);}
}

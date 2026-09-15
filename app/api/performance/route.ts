import {z} from "zod";
import {readBody,apiError} from "@/lib/http";
import {refreshPerformance,exportAccounting} from "@/lib/accounting/service";
export const runtime="nodejs";
export async function POST(request:Request){
 try{
  const {account,action}=await readBody(request,z.object({account:z.string().regex(/^0x[0-9a-f]{40}$/),action:z.enum(["refresh","export"])}));
  const data=action==="export"?await exportAccounting(account):await refreshPerformance(account);
  return Response.json(data,{headers:{"Cache-Control":"no-store"}});
 }catch(e){return apiError(e);}
}

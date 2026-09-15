import {readBody, apiError} from "@/lib/http";
import {purchaseSchema} from "@/lib/trading/quote";
import {preparePurchase} from "@/lib/trading/prepare";
export async function POST(request:Request) {
  try {return Response.json(await preparePurchase(await readBody(request,purchaseSchema)),{headers:{"Cache-Control":"no-store"}});}
  catch(e) {return apiError(e);}
}

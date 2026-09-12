import { getMarket } from "@/lib/hyperliquid/market";
import { apiError } from "@/lib/http";
export async function GET() {
  try {
    return Response.json(await getMarket());
  } catch (e) {
    return apiError(e);
  }
}

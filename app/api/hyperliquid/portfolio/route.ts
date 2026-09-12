import { z } from "zod";
import { addressSchema } from "@/lib/hyperliquid/client";
import { getPortfolio } from "@/lib/hyperliquid/portfolio";
import { readBody, apiError } from "@/lib/http";
export async function POST(request: Request) {
  try {
    const { address } = await readBody(
      request,
      z.object({ address: addressSchema }),
    );
    return Response.json(await getPortfolio(address));
  } catch (e) {
    return apiError(e);
  }
}

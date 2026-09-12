import { copilot, chatSchema } from "@/lib/ai/copilot";
import { readBody, apiError } from "@/lib/http";
export async function POST(request: Request) {
  try {
    return Response.json(await copilot(await readBody(request, chatSchema)));
  } catch (e) {
    return apiError(e);
  }
}

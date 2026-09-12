import { z } from "zod";
import { readBody, apiError } from "@/lib/http";
export async function POST(request: Request) {
  try {
    const { sdp } = await readBody(
      request,
      z.object({ sdp: z.string().min(1).max(50000) }),
    );
    if (!process.env.OPENAI_API_KEY)
      return Response.json(
        {
          error:
            "Voice unavailable. Configure OPENAI_API_KEY; use text chat meanwhile.",
        },
        { status: 503 },
      );
    const response = await fetch("https://api.openai.com/v1/live/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        session: {
          model: process.env.OPENAI_LIVE_MODEL || "gpt-live-1",
          instructions:
            "You are DCA AI. Speak briefly in the user language. You are an AI voice. Delegate every portfolio question, calculation and strategy request to the backend. Never invent financial figures. No trades or automatic saving are possible. A strategy preview must be confirmed in the UI. Announce that this is simulation only. Do not claim a saved strategy unless the application confirms it.",
          delegation: { type: "client" },
        },
        transport: { type: "webrtc", sdp },
      }),
      signal: AbortSignal.timeout(25000),
    });
    if (!response.ok)
      return Response.json(
        { error: "Voice temporarily unavailable. Use text chat." },
        { status: 503 },
      );
    const result = z
      .object({
        session: z.object({ id: z.string() }),
        transport: z.object({ sdp: z.string() }),
      })
      .parse(await response.json());
    return Response.json(result, { status: 201 });
  } catch (e) {
    return apiError(e);
  }
}

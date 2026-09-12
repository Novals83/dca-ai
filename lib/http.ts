import { z } from "zod";
const windowCounts = new Map<string, { since: number; count: number }>();
export async function readBody<T>(
  request: Request,
  schema: z.ZodType<T>,
): Promise<T> {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (origin && new URL(origin).host !== host) throw new Error("Forbidden");
  const scope = new URL(request.url).pathname;
  const current = windowCounts.get(scope);
  const now = Date.now();
  if (!current || now - current.since > 60000)
    windowCounts.set(scope, { since: now, count: 1 });
  else if (++current.count > 30) throw new Error("Rate limit");
  const text = await request.text();
  if (text.length > 64000) throw new Error("Too large");
  return schema.parse(JSON.parse(text));
}
export function apiError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  const status =
    error instanceof z.ZodError || error instanceof SyntaxError
      ? 400
      : message === "Forbidden"
        ? 403
        : message === "Rate limit"
          ? 429
          : message === "Too large"
            ? 413
            : message === "Unsupported account mode"
              ? 422
              : 502;
  return Response.json(
    {
      error:
        status === 422
          ? "This account uses portfolio margin or legacy DEX abstraction. Portfolio view supports standard and unified accounts."
          : status === 400
            ? "Check the address and input values."
            : status === 429
              ? "Too many requests. Please wait a minute."
              : status === 403
                ? "Request origin is not allowed."
                : "Service temporarily unavailable. Please try again.",
    },
    { status },
  );
}

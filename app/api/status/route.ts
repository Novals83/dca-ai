export async function GET() {
  return Response.json({
    aiConfigured: Boolean(process.env.OPENAI_API_KEY),
    edition: "community",
    trading: "manual-spot",
    scheduler: process.env.DCA_WORKER_ENABLED === "1",
  });
}

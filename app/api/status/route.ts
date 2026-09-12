export async function GET() {
  return Response.json({
    aiConfigured: Boolean(process.env.OPENAI_API_KEY),
    edition: "community",
    trading: false,
  });
}

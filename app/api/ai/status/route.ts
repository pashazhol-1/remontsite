export function GET() {
  return Response.json({ enabled: Boolean(process.env.OPENROUTER_API_KEY) });
}

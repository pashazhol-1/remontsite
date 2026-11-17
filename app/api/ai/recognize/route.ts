import { recognizeWithOpenRouter } from "@/lib/ai/openrouter";

export async function POST(request: Request) {
  if (!process.env.OPENROUTER_API_KEY) {
    return Response.json({ error: "Ключ распознавания не задан" }, { status: 503 });
  }

  let images: string[] = [];
  try {
    const body = (await request.json()) as { images?: unknown };
    if (!Array.isArray(body.images) || body.images.some((item) => typeof item !== "string")) {
      return Response.json({ error: "Нет фотографий чека" }, { status: 400 });
    }
    images = body.images.slice(0, 3);
  } catch {
    return Response.json({ error: "Не удалось прочитать фото" }, { status: 400 });
  }

  if (images.length === 0) {
    return Response.json({ error: "Нет фотографий чека" }, { status: 400 });
  }

  try {
    const result = await recognizeWithOpenRouter(images);
    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось распознать чек";
    return Response.json({ error: message }, { status: 502 });
  }
}

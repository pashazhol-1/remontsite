import { assessRecognition } from "@/lib/ai/assess";
import type { RecognitionResult } from "@/lib/ai/types";

const PROMPT = `Ты читаешь фотографию кассового чека. Верни только JSON без пояснений:
{
  "storeName": "название магазина или null",
  "receiptDate": "дата покупки в формате YYYY-MM-DD или null",
  "receiptNumber": "номер чека или null",
  "currency": "BYN",
  "totalAmount": 0,
  "confidence": 0.0,
  "items": [
    { "name": "товар", "quantity": 1, "unitPrice": 0, "totalPrice": 0 }
  ]
}
Правила:
- Не выдумывай позиции, которых нет на фото.
- confidence от 0 до 1: насколько ты уверен во всём чеке.
- totalAmount — итог чека, items — строки товаров.
- Если валюта не белорусский рубль, укажи код валюты как на чеке.
- Не добавляй категорию работ.`;

function extractJson(text: string) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const source = fenced?.[1] ?? text;
  const start = source.indexOf("{");
  const end = source.lastIndexOf("}");
  if (start < 0 || end < start) {
    throw new Error("Модель не вернула данные чека");
  }
  return JSON.parse(source.slice(start, end + 1)) as Record<string, unknown>;
}

export async function recognizeWithOpenRouter(images: string[]): Promise<RecognitionResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("NO_KEY");
  }
  const model = process.env.OPENROUTER_MODEL || "openrouter/free";
  const content = [
    { type: "text", text: PROMPT },
    ...images.slice(0, 3).map((url) => ({
      type: "image_url",
      image_url: { url },
    })),
  ];

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      messages: [{ role: "user", content }],
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(details.slice(0, 300) || "Сервис распознавания не ответил");
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | Array<{ text?: string }> } }>;
  };
  const message = payload.choices?.[0]?.message?.content;
  const text = Array.isArray(message)
    ? message.map((part) => part.text ?? "").join("\n")
    : message ?? "";
  const parsed = extractJson(text);

  return assessRecognition({
    provider: "openrouter",
    model,
    storeName: typeof parsed.storeName === "string" ? parsed.storeName : null,
    receiptDate: typeof parsed.receiptDate === "string" ? parsed.receiptDate : null,
    receiptNumber: typeof parsed.receiptNumber === "string" ? parsed.receiptNumber : null,
    currency: typeof parsed.currency === "string" ? parsed.currency : "BYN",
    totalAmount: typeof parsed.totalAmount === "number" ? parsed.totalAmount : null,
    confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.5,
    items: Array.isArray(parsed.items)
      ? parsed.items.map((item) => {
          const row = item as Record<string, unknown>;
          return {
            name: String(row.name ?? ""),
            quantity: Number(row.quantity ?? 0),
            unitPrice: Number(row.unitPrice ?? 0),
            totalPrice: Number(row.totalPrice ?? 0),
          };
        })
      : [],
  });
}

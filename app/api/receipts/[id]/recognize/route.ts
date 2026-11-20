import { demoRecognition } from "@/lib/ai/demo";
import { recognizeWithOpenRouter } from "@/lib/ai/openrouter";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { RecognitionResult } from "@/lib/ai/types";
import { after } from "next/server";

export const maxDuration = 60;

function safeDate(value: string | null) {
  if (!value) return null;
  const iso = value.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];
  const russian = value.match(/^(\d{2})\.(\d{2})\.(\d{4})/);
  if (russian) return `${russian[3]}-${russian[2]}-${russian[1]}`;
  return null;
}

function payloadOf(result: RecognitionResult) {
  return {
    storeName: result.storeName,
    receiptDate: safeDate(result.receiptDate),
    receiptNumber: result.receiptNumber,
    totalAmount: result.totalAmount,
    currency: result.currency,
    needsReview: result.needsReview,
    confidence: result.confidence,
    reviewReason: result.reviewReason,
    provider: result.provider,
    model: result.model,
    items: result.items,
  };
}

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return Response.json({ error: "Нужно войти" }, { status: 401 });
  }

  const { data: receipt } = await supabase
    .from("receipts")
    .select("id, user_id")
    .eq("id", id)
    .maybeSingle();
  if (!receipt || receipt.user_id !== auth.user.id) {
    return Response.json({ error: "Чек не найден" }, { status: 404 });
  }

  after(async () => {
    await readReceiptInBackground(id);
  });

  return Response.json({ started: true });
}

async function readReceiptInBackground(id: string) {
  const supabase = await createSupabaseServerClient();
  const { data: images } = await supabase
    .from("receipt_images")
    .select("storage_path")
    .eq("receipt_id", id)
    .order("sort_order", { ascending: true });
  const paths = (images ?? []).map((image) => image.storage_path as string).slice(0, 3);
  if (paths.length === 0) return;

  const dataUrls: string[] = [];
  for (const path of paths) {
    const { data, error } = await supabase.storage.from("receipt-photos").download(path);
    if (error || !data) return;
    const bytes = Buffer.from(await data.arrayBuffer());
    const type = data.type || "image/jpeg";
    dataUrls.push(`data:${type};base64,${bytes.toString("base64")}`);
  }

  try {
    const result = process.env.OPENROUTER_API_KEY
      ? await recognizeWithOpenRouter(dataUrls)
      : demoRecognition();
    await supabase.rpc("apply_receipt_recognition", {
      target_receipt: id,
      payload: payloadOf(result),
    });
  } catch {
    await supabase.rpc("apply_receipt_recognition", {
      target_receipt: id,
      payload: {
        storeName: null,
        receiptDate: null,
        receiptNumber: null,
        totalAmount: null,
        currency: "BYN",
        needsReview: true,
        confidence: 0,
        reviewReason: "Не удалось прочитать фото. Заказчик может нажать «Прочитать фото снова».",
        provider: "openrouter",
        model: process.env.OPENROUTER_MODEL || "openrouter/free",
        items: [],
      },
    });
  }
}

import { fileToDataUrl } from "@/lib/files";
import { demoRecognition } from "@/lib/ai/demo";
import type { RecognitionResult } from "@/lib/ai/types";

export async function recognizeReceiptPhotos(files: Blob[]): Promise<RecognitionResult> {
  const statusResponse = await fetch("/api/ai/status");
  const status = (await statusResponse.json()) as { enabled?: boolean };
  if (!status.enabled) return demoRecognition();

  const images = await Promise.all(files.slice(0, 3).map((file) => fileToDataUrl(file)));
  const response = await fetch("/api/ai/recognize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ images }),
  });
  const payload = (await response.json()) as RecognitionResult & { error?: string };
  if (!response.ok) {
    throw new Error(payload.error || "Не удалось распознать чек");
  }
  return payload;
}

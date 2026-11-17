import { assessRecognition } from "@/lib/ai/assess";
import type { RecognitionResult } from "@/lib/ai/types";

export function demoRecognition(): RecognitionResult {
  return assessRecognition({
    provider: "demo",
    model: "sample",
    storeName: "Строймаркет",
    receiptDate: new Date().toISOString().slice(0, 10),
    receiptNumber: null,
    currency: "BYN",
    totalAmount: 253,
    confidence: 0.92,
    items: [
      { name: "Штукатурка гипсовая", quantity: 5, unitPrice: 35, totalPrice: 175 },
      { name: "Грунтовка", quantity: 2, unitPrice: 24, totalPrice: 48 },
      { name: "Шпатель", quantity: 1, unitPrice: 18, totalPrice: 18 },
      { name: "Саморезы", quantity: 2, unitPrice: 6, totalPrice: 12 },
    ],
  });
}

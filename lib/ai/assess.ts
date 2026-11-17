import { DEFAULT_CURRENCY } from "@/lib/config";
import type { RecognitionResult } from "@/lib/ai/types";

const CONFIDENCE_LIMIT = 0.75;
const MONEY_GAP = 0.05;

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function asNumber(value: unknown) {
  const number = typeof value === "number" ? value : Number(String(value).replace(",", "."));
  return Number.isFinite(number) ? number : null;
}

export function itemsSum(items: Array<{ totalPrice: number }>) {
  return roundMoney(items.reduce((sum, item) => sum + item.totalPrice, 0));
}

export function assessRecognition(
  raw: Partial<RecognitionResult> & { provider: string; model: string },
): RecognitionResult {
  const items = (raw.items ?? [])
    .map((item) => {
      const quantity = asNumber(item.quantity) ?? 0;
      const unitPrice = asNumber(item.unitPrice) ?? 0;
      const totalPrice = asNumber(item.totalPrice) ?? roundMoney(quantity * unitPrice);
      return {
        name: item.name?.trim() || "Без названия",
        quantity,
        unitPrice: roundMoney(unitPrice),
        totalPrice: roundMoney(totalPrice),
      };
    })
    .filter((item) => item.name);

  const totalAmount = raw.totalAmount == null ? null : asNumber(raw.totalAmount);
  const confidence = Math.min(1, Math.max(0, asNumber(raw.confidence) ?? 0));
  const sum = itemsSum(items);
  const mismatch =
    totalAmount != null && items.length > 0 && Math.abs(sum - totalAmount) > MONEY_GAP;
  const incomplete = items.length === 0 || totalAmount == null || !raw.storeName;
  const lowConfidence = confidence < CONFIDENCE_LIMIT;

  let reviewReason: string | null = null;
  if (mismatch) {
    reviewReason = `Сумма позиций ${sum.toFixed(2)} не сходится с итогом ${totalAmount?.toFixed(2)}`;
  } else if (lowConfidence) {
    reviewReason = "Модель не уверена в прочтении";
  } else if (incomplete) {
    reviewReason = "Не все поля удалось прочитать";
  }

  return {
    storeName: raw.storeName?.trim() || null,
    receiptDate: raw.receiptDate?.trim() || null,
    receiptNumber: raw.receiptNumber?.trim() || null,
    currency: raw.currency?.trim() || DEFAULT_CURRENCY,
    totalAmount: totalAmount == null ? null : roundMoney(totalAmount),
    items,
    confidence,
    needsReview: Boolean(reviewReason),
    reviewReason,
    provider: raw.provider,
    model: raw.model,
    itemsSum: sum,
  };
}

export function statusAfterRecognition(
  current: "pending_review" | "unpaid" | "paid",
  needsReview: boolean,
) {
  if (current === "paid") return current;
  return needsReview ? "pending_review" : "unpaid";
}

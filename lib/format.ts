import { DEFAULT_CURRENCY } from "@/lib/config";
import type { ReceiptStatus } from "@/types";

export function formatMoney(
  amount: number | null | undefined,
  currency = DEFAULT_CURRENCY,
) {
  if (amount === null || amount === undefined || Number.isNaN(amount)) {
    return "—";
  }
  const formatted = new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
  return `${formatted} ${currency}`;
}

export function receiptCountLabel(count: number) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  const word =
    mod10 === 1 && mod100 !== 11
      ? "чек"
      : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
        ? "чека"
        : "чеков";
  return `${count} ${word}`;
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value.includes("T") ? value : `${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function statusLabel(status: ReceiptStatus) {
  switch (status) {
    case "paid":
      return "Оплачено";
    case "unpaid":
      return "Не оплачено";
    default:
      return "На проверке";
  }
}

export function roleLabel(role: "admin" | "builder") {
  return role === "admin" ? "Заказчик" : "Строитель";
}

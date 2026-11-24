import type { Receipt } from "@/types";

export type PeriodPreset = "all" | "month" | "week" | "custom";

export type PeriodValue = {
  preset: PeriodPreset;
  from: string;
  to: string;
};

export const defaultPeriod: PeriodValue = { preset: "all", from: "", to: "" };

export function receiptMoment(receipt: Pick<Receipt, "receiptDate" | "createdAt">) {
  const value = receipt.receiptDate || receipt.createdAt;
  const date = new Date(value.includes("T") ? value : `${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function endOfDay(value: string) {
  const date = new Date(`${value}T23:59:59`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function matchesPeriod(receipt: Pick<Receipt, "receiptDate" | "createdAt">, period: PeriodValue) {
  if (period.preset === "all") return true;
  const date = receiptMoment(receipt);
  if (!date) return false;

  if (period.preset === "month") {
    const now = new Date();
    return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
  }

  if (period.preset === "week") {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - 6);
    return date >= start;
  }

  const from = period.from ? new Date(`${period.from}T00:00:00`) : null;
  const to = period.to ? endOfDay(period.to) : null;
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
}

export function moneyOf(
  receipts: Array<Pick<Receipt, "totalAmount" | "status">>,
  status?: Receipt["status"],
) {
  return receipts
    .filter((receipt) => (status ? receipt.status === status : true))
    .reduce((sum, receipt) => sum + (receipt.totalAmount ?? 0), 0);
}

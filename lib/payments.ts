import { formatMoney } from "@/lib/format";
import type { NotificationKind, Receipt, ReceiptStatus, UserRole } from "@/types";

export function builderMayDeleteReceipt(status: Receipt["status"]) {
  return status === "pending_review" || status === "unpaid";
}

export function assertStatusChange(
  role: UserRole,
  userId: string,
  receipt: Pick<Receipt, "userId" | "status">,
  next: ReceiptStatus | undefined,
) {
  if (!next || next === receipt.status) return;
  if (role === "builder") {
    if (userId !== receipt.userId) throw new Error("Это не ваш чек");
    if (receipt.status !== "awaiting_confirmation" || (next !== "paid" && next !== "unpaid")) {
      throw new Error("Можно только подтвердить или отклонить оплату, которую отметил заказчик");
    }
    return;
  }
  if (next === "paid") {
    throw new Error("Оплата становится окончательной только после подтверждения строителя");
  }
  if (next === "awaiting_confirmation" && receipt.status === "paid") {
    throw new Error("Оплата уже подтверждена");
  }
}

export function notificationKindForChange(
  role: UserRole,
  previous: ReceiptStatus,
  next: ReceiptStatus,
): NotificationKind | null {
  if (previous === next) return null;
  if (next === "awaiting_confirmation") return "payment_requested";
  if (next === "paid") return "payment_confirmed";
  if (previous === "awaiting_confirmation" && next === "unpaid") {
    return role === "admin" ? "payment_cancelled" : "payment_rejected";
  }
  return null;
}

export function receiptSummary(receipt: Pick<Receipt, "storeName" | "totalAmount" | "currency">) {
  return `${receipt.storeName || "Чек без магазина"}, ${formatMoney(receipt.totalAmount, receipt.currency)}`;
}

export function notificationText(
  kind: NotificationKind,
  receipt: Pick<Receipt, "storeName" | "totalAmount" | "currency" | "status">,
) {
  const summary = receiptSummary(receipt);
  switch (kind) {
    case "receipt_created":
      return receipt.storeName
        ? { title: "Новый чек", body: summary }
        : { title: "Новый чек", body: "Фото ещё читается. Магазин и сумма появятся сами." };
    case "payment_requested":
      return {
        title: "Подтвердите оплату",
        body: `Вы получили деньги по чеку ${summary}?`,
      };
    case "payment_confirmed":
      return { title: "Оплата подтверждена", body: summary };
    case "payment_rejected":
      return { title: "Строитель не подтвердил оплату", body: summary };
    case "payment_cancelled":
      return { title: "Заказчик отменил отметку об оплате", body: summary };
  }
}

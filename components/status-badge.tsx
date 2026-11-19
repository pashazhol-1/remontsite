import { Badge } from "@/components/ui/badge";
import { statusLabel } from "@/lib/format";
import type { ReceiptStatus } from "@/types";
import { Check, CircleAlert } from "lucide-react";

const styles: Record<ReceiptStatus, string> = {
  paid: "border-emerald-300 bg-emerald-600 text-white",
  awaiting_confirmation: "border-emerald-200 bg-emerald-50 text-emerald-800",
  unpaid: "border-orange-200 bg-orange-50 text-orange-800",
  pending_review: "border-amber-200 bg-amber-50 text-amber-800",
};

const hints: Record<ReceiptStatus, string> = {
  paid: "Строитель подтвердил, что получил деньги",
  awaiting_confirmation: "Строитель ещё не подтвердил, что получил деньги",
  unpaid: "Деньги ещё не отмечены как отданные",
  pending_review: "Чек нужно проверить",
};

export function StatusBadge({ status }: { status: ReceiptStatus }) {
  return (
    <Badge variant="outline" className={styles[status]} title={hints[status]}>
      {status === "paid" ? <Check /> : null}
      {status === "awaiting_confirmation" ? <CircleAlert /> : null}
      {statusLabel(status)}
    </Badge>
  );
}

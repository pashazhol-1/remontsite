import { Badge } from "@/components/ui/badge";
import { statusLabel } from "@/lib/format";
import type { ReceiptStatus } from "@/types";

export function StatusBadge({ status }: { status: ReceiptStatus }) {
  const styles = {
    paid: "border-emerald-200 bg-emerald-50 text-emerald-800",
    unpaid: "border-orange-200 bg-orange-50 text-orange-800",
    pending_review: "border-amber-200 bg-amber-50 text-amber-800",
  } as const;

  return (
    <Badge variant="outline" className={styles[status]}>
      {statusLabel(status)}
    </Badge>
  );
}

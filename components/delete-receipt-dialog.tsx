"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatMoney } from "@/lib/format";
import type { Receipt } from "@/types";
import { useEffect, useState } from "react";

export function DeleteReceiptDialog({
  receipt,
  open,
  pending,
  subject,
  onOpenChange,
  onConfirm,
}: {
  receipt: Receipt | null;
  open: boolean;
  pending: boolean;
  subject?: string;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  const [shown, setShown] = useState(receipt);
  useEffect(() => {
    if (receipt) setShown(receipt);
  }, [receipt]);
  const name = shown?.storeName || "без магазина";
  const amount = shown ? ` на ${formatMoney(shown.totalAmount, shown.currency)}` : "";
  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{subject ? "Удалить работу?" : "Удалить чек?"}</DialogTitle>
          <DialogDescription>
            {subject
              ? `Работа «${subject}» будет удалена вместе с фото. Вернуть её нельзя.`
              : `Чек «${name}»${amount} будет удалён вместе с фото. Вернуть его нельзя.`}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={pending} onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button type="button" variant="destructive" disabled={pending} onClick={onConfirm}>
            {pending ? "Удаление..." : "Удалить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

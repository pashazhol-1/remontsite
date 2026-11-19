"use client";

import { useApp } from "@/components/app-provider";
import { ReceiptList } from "@/components/receipt-list";
import { StatCard } from "@/components/stat-card";
import { formatMoney } from "@/lib/format";
import { moneyOf } from "@/lib/period";
import type { Receipt, WorkCategory } from "@/types";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export default function AdminReceiptsPage() {
  const { repo } = useApp();
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [categories, setCategories] = useState<WorkCategory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void Promise.all([repo.listReceipts("all"), repo.listCategories()]).then(([nextReceipts, nextCategories]) => {
      setReceipts(nextReceipts);
      setCategories(nextCategories);
      setLoading(false);
    });
  }, [repo]);

  const reviewCount = receipts.filter((receipt) => receipt.status === "pending_review").length;

  async function removeReceipt(receipt: Receipt) {
    try {
      await repo.deleteReceipt(receipt.id);
      setReceipts((current) => current.filter((item) => item.id !== receipt.id));
      toast.success("Чек удалён");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось удалить чек");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Сводка</h1>
        <p className="text-muted-foreground">Все покупки строителей. Суммы считаются по тем чекам, где уже указан итог.</p>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <StatCard label="Всего" value={formatMoney(moneyOf(receipts))} />
        <StatCard label="Оплачено" value={formatMoney(moneyOf(receipts, "paid"))} hint="Строитель подтвердил" />
        <StatCard label="Ждёт подтверждения" value={formatMoney(moneyOf(receipts, "awaiting_confirmation"))} />
        <StatCard label="Не оплачено" value={formatMoney(moneyOf(receipts, "unpaid"))} />
        <StatCard label="На проверке" value={formatMoney(moneyOf(receipts, "pending_review"))} hint={`${reviewCount} шт.`} />
        <StatCard label="Чеков" value={String(receipts.length)} />
      </div>
      {loading ? (
        <p className="text-muted-foreground">Загрузка чеков...</p>
      ) : (
        <ReceiptList
          receipts={receipts}
          categories={categories}
          detailed
          hrefFor={(receipt) => `/admin/receipts/${receipt.id}`}
          onDelete={removeReceipt}
        />
      )}
    </div>
  );
}

"use client";

import { AddEntryMenu } from "@/components/add-entry-menu";
import { useApp } from "@/components/app-provider";
import { SummaryTable } from "@/components/summary-table";
import { StatCard } from "@/components/stat-card";
import { formatMoney } from "@/lib/format";
import { moneyOf } from "@/lib/period";
import type { Receipt, WorkCategory, WorkRecord } from "@/types";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export default function AdminReceiptsPage() {
  const { repo } = useApp();
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [works, setWorks] = useState<WorkRecord[]>([]);
  const [categories, setCategories] = useState<WorkCategory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void Promise.all([repo.listReceipts("all"), repo.listWorks("all"), repo.listCategories()]).then(([nextReceipts, nextWorks, nextCategories]) => {
      setReceipts(nextReceipts);
      setWorks(nextWorks);
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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Сводка</h1>
            <p className="text-muted-foreground">Чеки на материалы и работы мастеров в одной таблице.</p>
          </div>
          <AddEntryMenu receiptHref="/admin/receipts/new" workHref="/admin/works/new" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <StatCard label="Всего" value={formatMoney(moneyOf(receipts) + moneyOf(works))} />
        <StatCard label="Оплачено" value={formatMoney(moneyOf(receipts, "paid") + moneyOf(works, "paid"))} hint="Мастер подтвердил" />
        <StatCard label="Ждёт подтверждения" value={formatMoney(moneyOf(receipts, "awaiting_confirmation") + moneyOf(works, "awaiting_confirmation"))} />
        <StatCard label="Не оплачено" value={formatMoney(moneyOf(receipts, "unpaid") + moneyOf(works, "unpaid"))} />
        <StatCard label="На проверке" value={formatMoney(moneyOf(receipts, "pending_review"))} hint={`${reviewCount} чеков`} />
        <StatCard label="Записей" value={String(receipts.length + works.length)} />
      </div>
      {loading ? (
        <p className="text-muted-foreground">Загрузка чеков...</p>
      ) : (
        <SummaryTable
          receipts={receipts}
          works={works}
          categories={categories}
          detailed
          hrefForReceipt={(receipt) => `/admin/receipts/${receipt.id}`}
          hrefForWork={(work) => `/admin/works/${work.id}`}
          onDeleteReceipt={removeReceipt}
          onDeleteWork={async (work) => {
            try {
              await repo.deleteWork(work.id);
              setWorks((current) => current.filter((item) => item.id !== work.id));
              toast.success("Работа удалена");
            } catch (error) {
              toast.error(error instanceof Error ? error.message : "Не удалось удалить работу");
            }
          }}
        />
      )}
    </div>
  );
}

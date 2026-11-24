"use client";

import { AddEntryMenu } from "@/components/add-entry-menu";
import { useApp } from "@/components/app-provider";
import { SummaryTable } from "@/components/summary-table";
import { builderMayDeleteReceipt, builderMayDeleteWork } from "@/lib/payments";
import type { Receipt, WorkRecord } from "@/types";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export default function BuilderHomePage() {
  const { repo, profile } = useApp();
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [works, setWorks] = useState<WorkRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void Promise.all([repo.listReceipts("mine"), repo.listWorks("mine")]).then(([nextReceipts, nextWorks]) => {
      setReceipts(nextReceipts);
      setWorks(nextWorks);
      setLoading(false);
    });
  }, [repo]);

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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Здравствуйте, {profile?.name}</h1>
          <p className="text-muted-foreground">Добавьте чек на материалы или расскажите, какую работу сделали.</p>
        </div>
        <AddEntryMenu receiptHref="/builder/new" workHref="/builder/works/new" />
      </div>
      {loading ? (
        <p className="text-muted-foreground">Загрузка...</p>
      ) : (
        <SummaryTable
          receipts={receipts}
          works={works}
          hrefForReceipt={(receipt) => `/builder/receipts/${receipt.id}`}
          hrefForWork={(work) => `/builder/works/${work.id}`}
          onDeleteReceipt={removeReceipt}
          canDeleteReceipt={(receipt) => builderMayDeleteReceipt(receipt.status)}
          onDeleteWork={async (work) => {
            try {
              await repo.deleteWork(work.id);
              setWorks((current) => current.filter((item) => item.id !== work.id));
              toast.success("Работа удалена");
            } catch (error) {
              toast.error(error instanceof Error ? error.message : "Не удалось удалить работу");
            }
          }}
          canDeleteWork={(work) => builderMayDeleteWork(work)}
        />
      )}
    </div>
  );
}

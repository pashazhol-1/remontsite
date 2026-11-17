"use client";

import { useApp } from "@/components/app-provider";
import { ReceiptList } from "@/components/receipt-list";
import { formatMoney, receiptCountLabel } from "@/lib/format";
import { moneyOf } from "@/lib/period";
import type { Receipt } from "@/types";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function CategoryReceiptsPage() {
  const params = useParams<{ id: string }>();
  const { repo } = useApp();
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [title, setTitle] = useState("Вид работ");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void Promise.all([repo.listReceipts("all"), repo.listCategories()]).then(([nextReceipts, categories]) => {
      const category = categories.find((item) => item.id === params.id);
      setTitle(category?.name ?? "Вид работ");
      setReceipts(nextReceipts.filter((receipt) => receipt.categoryId === params.id));
      setLoading(false);
    });
  }, [params.id, repo]);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/categories" className="text-sm text-muted-foreground hover:underline">
          Все виды работ
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-muted-foreground">
          {receiptCountLabel(receipts.length)} · {formatMoney(moneyOf(receipts))} · оплачено {formatMoney(moneyOf(receipts, "paid"))}
        </p>
      </div>
      {loading ? (
        <p className="text-muted-foreground">Загрузка...</p>
      ) : (
        <ReceiptList receipts={receipts} detailed hrefFor={(receipt) => `/admin/receipts/${receipt.id}`} />
      )}
    </div>
  );
}

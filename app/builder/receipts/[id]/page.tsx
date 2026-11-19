"use client";

import { useApp } from "@/components/app-provider";
import { ReceiptDetail } from "@/components/receipt-detail";
import type { Receipt, WorkCategory } from "@/types";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function BuilderReceiptPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { repo } = useApp();
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [categories, setCategories] = useState<WorkCategory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void Promise.all([repo.getReceipt(params.id), repo.listCategories()]).then(
      ([nextReceipt, nextCategories]) => {
        setReceipt(nextReceipt);
        setCategories(nextCategories);
        setLoading(false);
      },
    );
  }, [params.id, repo]);

  if (loading) return <p className="text-muted-foreground">Загрузка...</p>;
  if (!receipt) return <p>Чек не найден</p>;

  return (
    <ReceiptDetail
      receipt={receipt}
      categories={categories}
      onUpdated={setReceipt}
      onDeleted={() => router.replace("/builder")}
    />
  );
}

"use client";

import { useApp } from "@/components/app-provider";
import { ReceiptList } from "@/components/receipt-list";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Receipt } from "@/types";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function BuilderHomePage() {
  const { repo, profile } = useApp();
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void repo.listReceipts("mine").then((items) => {
      setReceipts(items);
      setLoading(false);
    });
  }, [repo]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Здравствуйте, {profile?.name}</h1>
          <p className="text-muted-foreground">Сфотографируйте чек, выберите вид работ и отправьте заказчику.</p>
        </div>
        <Link href="/builder/new" className={cn(buttonVariants(), "h-12 px-5 text-base")}>
          Добавить чек
        </Link>
      </div>
      {loading ? <p className="text-muted-foreground">Загрузка...</p> : <ReceiptList receipts={receipts} hrefFor={(receipt) => `/builder/receipts/${receipt.id}`} />}
    </div>
  );
}

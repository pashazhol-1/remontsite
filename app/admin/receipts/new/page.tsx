"use client";

import { useApp } from "@/components/app-provider";
import { NewReceiptForm } from "@/components/new-receipt-form";
import { categoriesForProfile } from "@/lib/categories";
import type { WorkCategory } from "@/types";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export default function AdminNewReceiptPage() {
  const { repo, isDemo, profile } = useApp();
  const router = useRouter();
  const [categories, setCategories] = useState<WorkCategory[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void repo.listCategories().then((items) => setCategories(categoriesForProfile(items, profile)));
  }, [profile, repo]);

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Новый чек</h1>
        <p className="text-muted-foreground">Если покупали сами, чек сразу считается оплаченным. Подтверждение мастера не нужно.</p>
      </div>
      <NewReceiptForm
        categories={categories}
        submitting={submitting}
        allowSamplePhoto={isDemo}
        onSubmit={async (input) => {
          setSubmitting(true);
          try {
            await repo.createReceipt(input);
            toast.success("Чек сохранён и сразу отмечен оплаченным.");
            router.replace("/admin");
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Не удалось сохранить чек");
          } finally {
            setSubmitting(false);
          }
        }}
      />
    </div>
  );
}

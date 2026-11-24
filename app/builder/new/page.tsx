"use client";

import { useApp } from "@/components/app-provider";
import { NewReceiptForm } from "@/components/new-receipt-form";
import { categoriesForProfile } from "@/lib/categories";
import type { WorkCategory } from "@/types";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export default function NewReceiptPage() {
  const { repo, isDemo, profile } = useApp();
  const router = useRouter();
  const [categories, setCategories] = useState<WorkCategory[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    void repo.listCategories().then((items) => setCategories(categoriesForProfile(items, profile)));
  }, [profile, repo]);

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Новый чек</h1>
        <p className="text-muted-foreground">Четыре шага: фото, вид работ, комментарий, отправка.</p>
      </div>
      <NewReceiptForm
        categories={categories}
        submitting={submitting}
        allowSamplePhoto={isDemo}
        onSubmit={async (input) => {
          setSubmitting(true);
          setFormError("");
          try {
            await repo.createReceipt(input);
            toast.success("Чек отправлен заказчику. Фото прочитается само.");
            router.replace("/builder");
          } catch (error) {
            const message = error instanceof Error ? error.message : "Не удалось отправить чек";
            toast.error(message);
            setFormError(message);
          } finally {
            setSubmitting(false);
          }
        }}
      />
      {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
    </div>
  );
}

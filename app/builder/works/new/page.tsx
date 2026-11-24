"use client";

import { useApp } from "@/components/app-provider";
import { NewWorkForm } from "@/components/new-work-form";
import { categoriesForProfile } from "@/lib/categories";
import type { WorkCategory } from "@/types";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export default function NewBuilderWorkPage() {
  const { repo, profile } = useApp();
  const router = useRouter();
  const [categories, setCategories] = useState<WorkCategory[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void repo.listCategories().then((items) => setCategories(categoriesForProfile(items, profile)));
  }, [profile, repo]);

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Новая работа</h1>
        <p className="text-muted-foreground">Можно сохранить даты и сумму без фото, а фотоотчёт добавить позже.</p>
      </div>
      <NewWorkForm
        categories={categories}
        masters={[]}
        submitting={submitting}
        onSubmit={async (input) => {
          setSubmitting(true);
          try {
            await repo.createWork(input);
            toast.success("Работа сохранена. Заказчик увидит её в сводке.");
            router.replace("/builder");
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Не удалось сохранить работу");
          } finally {
            setSubmitting(false);
          }
        }}
      />
    </div>
  );
}

"use client";

import { useApp } from "@/components/app-provider";
import { NewWorkForm } from "@/components/new-work-form";
import type { Profile, WorkCategory } from "@/types";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export default function NewAdminWorkPage() {
  const { repo } = useApp();
  const router = useRouter();
  const [categories, setCategories] = useState<WorkCategory[]>([]);
  const [masters, setMasters] = useState<Profile[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void Promise.all([repo.listCategories(), repo.listUsers()]).then(([nextCategories, users]) => {
      setCategories(nextCategories.filter((category) => category.isActive));
      setMasters(users.filter((user) => user.role === "builder"));
    });
  }, [repo]);

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Новая работа</h1>
        <p className="text-muted-foreground">Запишите оплату мастеру, даты и, если уже есть, фотоотчёт.</p>
      </div>
      <NewWorkForm
        categories={categories}
        masters={masters}
        submitting={submitting}
        onSubmit={async (input) => {
          setSubmitting(true);
          try {
            await repo.createWork(input);
            toast.success("Работа добавлена в сводку");
            router.replace("/admin");
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

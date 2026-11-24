"use client";

import { useApp } from "@/components/app-provider";
import { WorkDetail } from "@/components/work-detail";
import type { WorkRecord } from "@/types";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export default function BuilderWorkPage() {
  const params = useParams<{ id: string }>();
  const { repo, profile } = useApp();
  const router = useRouter();
  const [work, setWork] = useState<WorkRecord | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void repo.getWork(params.id).then((next) => {
      setWork(next);
      setLoading(false);
    });
  }, [params.id, repo]);

  if (loading) return <p className="text-muted-foreground">Загрузка...</p>;
  if (!work) return <p>Работа не найдена</p>;

  return (
    <WorkDetail
      work={work}
      canManage={false}
      isOwner={work.userId === profile?.id}
      onUpdated={setWork}
      onSave={(patch) => repo.updateWork(work.id, patch)}
      onDeleted={() => {
        void repo.deleteWork(work.id).then(() => {
          toast.success("Работа удалена");
          router.replace("/builder");
        }).catch((error) => {
          toast.error(error instanceof Error ? error.message : "Не удалось удалить");
        });
      }}
    />
  );
}

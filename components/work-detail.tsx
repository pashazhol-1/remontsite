"use client";

import { DeleteReceiptDialog } from "@/components/delete-receipt-dialog";
import { PhotoPicker } from "@/components/photo-picker";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { formatDate, formatMoney, progressLabel } from "@/lib/format";
import { builderMayDeleteWork } from "@/lib/payments";
import type { WorkRecord } from "@/types";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export function WorkDetail({
  work,
  canManage,
  isOwner,
  onUpdated,
  onDeleted,
  onSave,
}: {
  work: WorkRecord;
  canManage: boolean;
  isOwner: boolean;
  onUpdated: (work: WorkRecord) => void;
  onDeleted: () => void;
  onSave: (patch: { progress?: "done"; status?: WorkRecord["status"]; photos?: File[] }) => Promise<WorkRecord>;
}) {
  const [photos, setPhotos] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const canRemove = canManage || (isOwner && builderMayDeleteWork(work));

  async function run(patch: { progress?: "done"; status?: WorkRecord["status"]; photos?: File[] }, success: string) {
    setBusy(true);
    try {
      const updated = await onSave(patch);
      onUpdated(updated);
      setPhotos([]);
      toast.success(success);
      window.dispatchEvent(new CustomEvent("otchet-notifications-changed"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось сохранить");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{work.title}</h1>
          <p className="text-sm text-muted-foreground">
            {work.categoryName} · {work.userName}
            {work.startDate ? ` · ${formatDate(work.startDate)}` : ""}
            {work.endDate ? ` — ${formatDate(work.endDate)}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-accent px-2 py-0.5 text-xs text-accent-foreground">{progressLabel(work.progress)}</span>
          <StatusBadge status={work.status} />
          {canRemove ? (
            <Button type="button" variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" aria-label="Удалить работу" onClick={() => setConfirmDelete(true)}>
              <Trash2 />
            </Button>
          ) : null}
        </div>
      </div>
      <p className="text-lg font-semibold">{formatMoney(work.totalAmount, work.currency)}</p>
      {work.commentText ? <p className="whitespace-pre-wrap text-sm">{work.commentText}</p> : null}
      {work.audioTranscription ? <p className="text-sm text-muted-foreground">{work.audioTranscription}</p> : null}
      {work.images.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {work.images.map((image) => (
            <a key={image.id} href={image.url} target="_blank" rel="noreferrer" className="overflow-hidden rounded-xl border bg-white">
              <img src={image.url} alt="" className="aspect-[3/4] w-full object-cover" />
            </a>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Фотоотчёта пока нет.</p>
      )}
      {isOwner && work.status !== "paid" ? (
        <div className="space-y-3 rounded-xl border bg-white p-4">
          <p className="text-sm font-medium">Добавить фото</p>
          <PhotoPicker files={photos} onChange={setPhotos} />
          {photos.length > 0 ? (
            <Button type="button" disabled={busy} onClick={() => void run({ photos }, "Фото добавлены")}>Сохранить фото</Button>
          ) : null}
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {isOwner && work.progress === "planned" ? (
          <Button disabled={busy} onClick={() => void run({ progress: "done" }, "Работа отмечена выполненной")}>Работа выполнена</Button>
        ) : null}
        {canManage && work.status !== "paid" && work.status !== "awaiting_confirmation" ? (
          <Button disabled={busy} onClick={() => void run({ status: "awaiting_confirmation" }, "Ждём подтверждения мастера")}>Оплатил</Button>
        ) : null}
        {canManage && work.status === "awaiting_confirmation" ? (
          <Button variant="outline" disabled={busy} onClick={() => void run({ status: "unpaid" }, "Отметка об оплате отменена")}>Отменить отметку</Button>
        ) : null}
        {isOwner && work.status === "awaiting_confirmation" ? (
          <>
            <Button disabled={busy} onClick={() => void run({ status: "paid" }, "Оплата подтверждена")}>Да, получил</Button>
            <Button variant="outline" disabled={busy} onClick={() => void run({ status: "unpaid" }, "Вы ответили, что деньги не получили")}>Нет, не получил</Button>
          </>
        ) : null}
      </div>
      <DeleteReceiptDialog
        receipt={null}
        subject={work.title}
        open={confirmDelete}
        pending={busy}
        onOpenChange={setConfirmDelete}
        onConfirm={() => onDeleted()}
      />
    </div>
  );
}

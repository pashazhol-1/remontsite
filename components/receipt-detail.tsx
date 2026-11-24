"use client";

import { useApp } from "@/components/app-provider";
import { DeleteReceiptDialog } from "@/components/delete-receipt-dialog";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { assessRecognition, itemsSum, statusAfterRecognition } from "@/lib/ai/assess";
import { builderMayDeleteReceipt } from "@/lib/payments";
import { recognizeReceiptPhotos } from "@/lib/ai/client";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import type { Receipt, ReceiptItem, WorkCategory } from "@/types";
import { Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

function copyItems(items: ReceiptItem[]) {
  return items.map((item) => ({ ...item }));
}

export function ReceiptDetail({
  receipt,
  categories,
  onUpdated,
  onDeleted,
}: {
  receipt: Receipt;
  categories: WorkCategory[];
  onUpdated: (receipt: Receipt) => void;
  onDeleted?: () => void;
}) {
  const { profile, repo } = useApp();
  const canEdit = profile?.role === "admin";
  const canRemove =
    canEdit ||
    (profile?.role === "builder" && profile.id === receipt.userId && builderMayDeleteReceipt(receipt.status));
  const [saving, setSaving] = useState(false);
  const [reading, setReading] = useState(false);
  const [paying, setPaying] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [form, setForm] = useState(() => ({
    storeName: receipt.storeName ?? "",
    receiptDate: receipt.receiptDate ?? "",
    receiptNumber: receipt.receiptNumber ?? "",
    totalAmount: receipt.totalAmount?.toString() ?? "",
    currency: receipt.currency,
    categoryId: receipt.categoryId,
    commentText: receipt.commentText ?? "",
    items: copyItems(receipt.items),
  }));

  useEffect(() => {
    setForm({
      storeName: receipt.storeName ?? "",
      receiptDate: receipt.receiptDate ?? "",
      receiptNumber: receipt.receiptNumber ?? "",
      totalAmount: receipt.totalAmount?.toString() ?? "",
      currency: receipt.currency,
      categoryId: receipt.categoryId,
      commentText: receipt.commentText ?? "",
      items: copyItems(receipt.items),
    });
  }, [receipt]);

  function updateItem(id: string, patch: Partial<ReceiptItem>) {
    setForm((current) => ({
      ...current,
      items: current.items.map((item) => {
        if (item.id !== id) return item;
        const next = { ...item, ...patch };
        if ("quantity" in patch || "unitPrice" in patch) {
          next.totalPrice = Math.round(next.quantity * next.unitPrice * 100) / 100;
        }
        return next;
      }),
    }));
  }

  async function save() {
    setSaving(true);
    try {
      const total = form.totalAmount ? Number(form.totalAmount.replace(",", ".")) : null;
      const assessed = assessRecognition({
        provider: "manual",
        model: "edited",
        storeName: form.storeName || null,
        receiptDate: form.receiptDate || null,
        receiptNumber: form.receiptNumber || null,
        currency: form.currency || "BYN",
        totalAmount: total,
        confidence: 1,
        items: form.items,
      });
      const updated = await repo.updateReceipt(receipt.id, {
        storeName: assessed.storeName,
        receiptDate: assessed.receiptDate,
        receiptNumber: assessed.receiptNumber,
        totalAmount: assessed.totalAmount,
        currency: assessed.currency,
        categoryId: form.categoryId,
        commentText: form.commentText || null,
        items: form.items,
        status: statusAfterRecognition(receipt.status, assessed.needsReview),
        recognition: {
          provider: receipt.recognition?.provider ?? "manual",
          model: "edited",
          confidence: 1,
          needsReview: assessed.needsReview,
          reviewReason: assessed.reviewReason,
        },
      });
      onUpdated(updated);
      toast.success("Чек обновлён");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    setDeleting(true);
    try {
      await repo.deleteReceipt(receipt.id);
      toast.success("Чек удалён");
      onDeleted?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось удалить чек");
      setDeleting(false);
    }
  }

  useEffect(() => {
    function onExternalUpdate(event: Event) {
      const next = (event as CustomEvent<Receipt>).detail;
      if (next?.id === receipt.id) onUpdated(next);
    }
    window.addEventListener("otchet-receipt-updated", onExternalUpdate);
    return () => window.removeEventListener("otchet-receipt-updated", onExternalUpdate);
  }, [onUpdated, receipt.id]);

  async function changePayment(status: "awaiting_confirmation" | "unpaid" | "paid", success: string) {
    setPaying(true);
    try {
      const updated = await repo.updateReceipt(receipt.id, { status });
      onUpdated(updated);
      window.dispatchEvent(new Event("otchet-notifications-changed"));
      toast.success(success);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось изменить оплату");
    } finally {
      setPaying(false);
    }
  }

  async function reread() {
    setReading(true);
    try {
      const blobs = await Promise.all(
        receipt.images.map(async (image) => {
          const response = await fetch(image.url);
          return response.blob();
        }),
      );
      const result = await recognizeReceiptPhotos(blobs);
      const updated = await repo.updateReceipt(receipt.id, {
        storeName: result.storeName,
        receiptDate: result.receiptDate,
        receiptNumber: result.receiptNumber,
        totalAmount: result.totalAmount,
        currency: result.currency,
        items: result.items.map((item) => ({ id: crypto.randomUUID(), ...item })),
        status: statusAfterRecognition(receipt.status, result.needsReview),
        recognition: {
          provider: result.provider,
          model: result.model,
          confidence: result.confidence,
          needsReview: result.needsReview,
          reviewReason: result.reviewReason,
        },
      });
      onUpdated(updated);
      toast.success(result.provider === "demo" ? "Подставлен учебный пример" : "Чек прочитан заново");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось прочитать фото");
    } finally {
      setReading(false);
    }
  }

  const shownItems = canEdit ? form.items : receipt.items;
  const shownTotal = canEdit
    ? form.totalAmount
      ? Number(form.totalAmount.replace(",", "."))
      : null
    : receipt.totalAmount;
  const shownCurrency = canEdit ? form.currency : receipt.currency;
  const lineSum = itemsSum(shownItems);
  const sumsDiffer =
    shownTotal != null && shownItems.length > 0 && Math.abs(lineSum - shownTotal) > 0.05;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {receipt.storeName || "Чек без магазина"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {receipt.categoryName} · {receipt.userName} · {formatDateTime(receipt.createdAt)}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            <StatusBadge status={receipt.status} />
            {canRemove ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-destructive"
                aria-label="Удалить чек"
                disabled={deleting}
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 />
              </Button>
            ) : null}
          </div>
          {canEdit && receipt.status !== "paid" && receipt.status !== "awaiting_confirmation" ? (
            <Button onClick={() => void changePayment("awaiting_confirmation", "Ждём подтверждения строителя")} disabled={paying}>
              {paying ? "Сохранение..." : "Оплатил"}
            </Button>
          ) : null}
          {canEdit && receipt.status === "awaiting_confirmation" ? (
            <Button variant="outline" onClick={() => void changePayment("unpaid", "Отметка об оплате отменена")} disabled={paying}>
              Отменить отметку
            </Button>
          ) : null}
        </div>
      </div>
      {canEdit && receipt.status === "pending_review" ? (
        <p className="text-sm text-muted-foreground">
          Чек ещё на проверке. «Оплатил» не закроет его сразу: строитель должен подтвердить, что получил деньги.
        </p>
      ) : null}
      {canEdit && receipt.status === "awaiting_confirmation" ? (
        <p className="text-sm text-muted-foreground">
          Строитель ещё не подтвердил получение денег. Пока он не ответил, отметку можно отменить.
        </p>
      ) : null}
      {!canEdit && receipt.status === "awaiting_confirmation" ? (
        <div className="rounded-xl border bg-white p-4">
          <p className="font-medium">Заказчик отметил этот чек оплаченным.</p>
          <p className="mt-1 text-sm text-muted-foreground">Вы получили эти деньги?</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button disabled={paying} onClick={() => void changePayment("paid", "Оплата подтверждена")}>
              Да, получил
            </Button>
            <Button variant="outline" disabled={paying} onClick={() => void changePayment("unpaid", "Вы ответили, что деньги не получили")}>
              Нет, не получил
            </Button>
          </div>
        </div>
      ) : null}

      {!receipt.recognition && receipt.status === "pending_review" ? (
        <p className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950">
          Фото ещё читается. Магазин, товары и сумма появятся сами.
        </p>
      ) : null}
      {receipt.recognition?.provider === "demo" ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Это учебная расшифровка, не текст с фотографии. Настоящее чтение включится после бесплатного ключа OpenRouter.
        </p>
      ) : null}
      {receipt.recognition?.needsReview ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Нужна проверка{receipt.recognition.reviewReason ? `: ${receipt.recognition.reviewReason}` : ""}.
          {receipt.recognition.confidence != null
            ? ` Уверенность ${Math.round(receipt.recognition.confidence * 100)}%.`
            : ""}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        {receipt.images.map((image) => (
          <a key={image.id} href={image.url} target="_blank" rel="noreferrer" className="overflow-hidden rounded-xl border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image.url} alt="Фото чека" className="h-72 w-full object-cover" />
          </a>
        ))}
      </div>

      {canEdit ? (
        <div className="grid gap-4 rounded-xl border bg-white p-4">
          <div className="grid gap-2">
            <Label htmlFor="store">Магазин</Label>
            <Input id="store" value={form.storeName} onChange={(event) => setForm({ ...form, storeName: event.target.value })} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="date">Дата покупки</Label>
              <Input id="date" type="date" value={form.receiptDate} onChange={(event) => setForm({ ...form, receiptDate: event.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="number">Номер чека</Label>
              <Input id="number" value={form.receiptNumber} onChange={(event) => setForm({ ...form, receiptNumber: event.target.value })} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="grid gap-2">
              <Label htmlFor="amount">Сумма</Label>
              <Input id="amount" inputMode="decimal" value={form.totalAmount} onChange={(event) => setForm({ ...form, totalAmount: event.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="currency">Валюта</Label>
              <Input id="currency" value={form.currency} onChange={(event) => setForm({ ...form, currency: event.target.value.toUpperCase() })} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="category">Вид работ</Label>
              <select
                id="category"
                className="h-8 rounded-lg border bg-background px-2.5 text-sm"
                value={form.categoryId}
                onChange={(event) => setForm({ ...form, categoryId: event.target.value })}
              >
                {categories.filter((category) => category.isActive || category.id === form.categoryId).map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="comment">Комментарий</Label>
            <Textarea id="comment" value={form.commentText} onChange={(event) => setForm({ ...form, commentText: event.target.value })} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void save()} disabled={saving}>
              {saving ? "Сохранение..." : "Сохранить изменения"}
            </Button>
            <Button variant="outline" onClick={() => void reread()} disabled={reading || receipt.images.length === 0}>
              {reading ? "Чтение..." : "Прочитать фото снова"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-2 text-sm">
          <p><span className="text-muted-foreground">Дата покупки:</span> {receipt.receiptDate ? formatDate(receipt.receiptDate) : "ещё не указана"}</p>
          <p><span className="text-muted-foreground">Сумма:</span> {formatMoney(receipt.totalAmount, receipt.currency)}</p>
          <p><span className="text-muted-foreground">Комментарий:</span> {receipt.commentText || "нет"}</p>
          <p className="text-muted-foreground">Вид работ выбран строителем и не меняется при чтении фото.</p>
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-medium">Товары</h2>
          {canEdit ? (
            <Button
              variant="outline"
              onClick={() =>
                setForm({
                  ...form,
                  items: [
                    ...form.items,
                    { id: crypto.randomUUID(), name: "", quantity: 1, unitPrice: 0, totalPrice: 0 },
                  ],
                })
              }
            >
              Добавить строку
            </Button>
          ) : null}
        </div>
        {shownItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">Позиции пока не заполнены.</p>
        ) : (
          <div className="space-y-3">
            {canEdit ? (
              <div className="hidden gap-2 rounded-lg bg-muted px-3 py-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase sm:grid sm:grid-cols-12">
                <span className="sm:col-span-5">Наименование</span>
                <span className="sm:col-span-2">Количество</span>
                <span className="sm:col-span-2">Цена</span>
                <span className="sm:col-span-2">Сумма</span>
              </div>
            ) : (
              <div className="hidden gap-2 rounded-lg bg-muted px-4 py-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase sm:grid sm:grid-cols-4">
                <span>Наименование</span>
                <span>Количество</span>
                <span>Цена</span>
                <span>Сумма</span>
              </div>
            )}
            {shownItems.map((item) =>
              canEdit ? (
                <div key={item.id} className="grid gap-2 rounded-xl border bg-white p-3 sm:grid-cols-12">
                  <label className="grid gap-1 sm:col-span-5">
                    <span className="text-xs text-muted-foreground sm:sr-only">Наименование</span>
                    <Input value={item.name} aria-label="Наименование" onChange={(event) => updateItem(item.id, { name: event.target.value })} />
                  </label>
                  <label className="grid gap-1 sm:col-span-2">
                    <span className="text-xs text-muted-foreground sm:sr-only">Количество</span>
                    <Input inputMode="decimal" value={String(item.quantity)} aria-label="Количество" onChange={(event) => updateItem(item.id, { quantity: Number(event.target.value.replace(",", ".")) || 0 })} />
                  </label>
                  <label className="grid gap-1 sm:col-span-2">
                    <span className="text-xs text-muted-foreground sm:sr-only">Цена</span>
                    <Input inputMode="decimal" value={String(item.unitPrice)} aria-label="Цена" onChange={(event) => updateItem(item.id, { unitPrice: Number(event.target.value.replace(",", ".")) || 0 })} />
                  </label>
                  <label className="grid gap-1 sm:col-span-2">
                    <span className="text-xs text-muted-foreground sm:sr-only">Сумма</span>
                    <Input inputMode="decimal" value={String(item.totalPrice)} aria-label="Сумма" onChange={(event) => updateItem(item.id, { totalPrice: Number(event.target.value.replace(",", ".")) || 0 })} />
                  </label>
                  <Button
                    variant="ghost"
                    className="sm:col-span-1"
                    onClick={() => setForm({ ...form, items: form.items.filter((row) => row.id !== item.id) })}
                  >
                    Удалить
                  </Button>
                </div>
              ) : (
                <div key={item.id} className="grid grid-cols-4 gap-2 rounded-xl border bg-white px-4 py-3 text-sm">
                  <span className="col-span-4 font-medium sm:col-span-1">{item.name}</span>
                  <span>{item.quantity}</span>
                  <span>{formatMoney(item.unitPrice, receipt.currency)}</span>
                  <span>{formatMoney(item.totalPrice, receipt.currency)}</span>
                </div>
              ),
            )}
          </div>
        )}
        <p className={`text-sm ${sumsDiffer ? "text-amber-800" : "text-muted-foreground"}`}>
          Сумма позиций: {formatMoney(lineSum, shownCurrency)}. Итог чека: {formatMoney(shownTotal, shownCurrency)}.
          {sumsDiffer ? " Суммы не сходятся." : ""}
        </p>
      </div>

      {receipt.audioUrl ? (
        <div className="space-y-2">
          <div className="text-sm font-medium">Голосовой комментарий</div>
          <audio controls src={receipt.audioUrl} className="w-full" />
          <p className="text-sm">{receipt.audioTranscription || "Текст речи не распознан. Запись можно прослушать."}</p>
        </div>
      ) : null}
      {canRemove ? (
        <DeleteReceiptDialog
          receipt={receipt}
          open={confirmDelete}
          pending={deleting}
          onOpenChange={setConfirmDelete}
          onConfirm={() => void remove()}
        />
      ) : null}
    </div>
  );
}

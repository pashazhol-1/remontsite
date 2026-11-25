"use client";

import { useApp } from "@/components/app-provider";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatDateTime } from "@/lib/format";
import type { AppNotification, Receipt } from "@/types";
import { Bell, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

export function NotificationBell() {
  const { profile, repo } = useApp();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    setItems(await repo.listNotifications());
  }, [profile, repo]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 15000);
    const refresh = () => void load();
    window.addEventListener("otchet-notifications-changed", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("otchet-notifications-changed", refresh);
    };
  }, [load]);

  const unreadItems = items.filter((item) => !item.readAt && item.kind !== "payment_confirmed");
  const unread = unreadItems.length;

  async function openReceipt(item: AppNotification) {
    if (!item.readAt) {
      await repo.markNotificationRead(item.id);
      setItems((current) =>
        current.map((entry) => (entry.id === item.id ? { ...entry, readAt: new Date().toISOString() } : entry)),
      );
    }
    setOpen(false);
    const role = profile?.role === "admin" ? "admin" : "builder";
    if (item.workId) router.push(`/${role}/works/${item.workId}`);
    else if (item.receiptId) router.push(`/${role}/receipts/${item.receiptId}`);
  }

  async function remove(item: AppNotification) {
    setBusyId(item.id);
    try {
      await repo.deleteNotification(item.id);
      setItems((current) => current.filter((entry) => entry.id !== item.id));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось удалить уведомление", { position: "top-center" });
    } finally {
      setBusyId(null);
    }
  }

  async function answer(item: AppNotification, accept: boolean) {
    setBusyId(item.id);
    try {
      const status = accept ? "paid" : "unpaid";
      if (item.workId) await repo.updateWork(item.workId, { status });
      else {
        const updated = await repo.updateReceipt(item.receiptId ?? "", { status });
        window.dispatchEvent(new CustomEvent<Receipt>("otchet-receipt-updated", { detail: updated }));
      }
      if (!item.readAt) await repo.markNotificationRead(item.id);
      toast.success(accept ? "Оплата подтверждена" : "Оплата не подтверждена");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось ответить");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="relative"
        aria-label={unread ? `Уведомления, непрочитанных: ${unread}` : "Уведомления"}
        onClick={() => {
          setOpen(true);
          void load();
        }}
      >
        <Bell />
        {unread > 0 ? (
          <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-600 px-1 text-[10px] font-medium text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </Button>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Уведомления</SheetTitle>
        </SheetHeader>
        <div className="px-4">
          <p className="text-sm text-muted-foreground">{unread ? `${unread} новых` : "Новых нет"}</p>
        </div>
        <div className="flex-1 space-y-2 overflow-y-auto px-4 pb-4">
          {unreadItems.length === 0 ? <p className="text-sm text-muted-foreground">Здесь появятся новые чеки, работы и оплаты.</p> : null}
          {unreadItems.map((item) => (
            <div key={item.id} className="rounded-xl border bg-emerald-50 p-3">
              <div className="flex items-start gap-2">
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => void openReceipt(item)}>
                  <div className="font-medium">{item.title}</div>
                  <div className="mt-1 text-sm">{item.body}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{formatDateTime(item.createdAt)}</div>
                </button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
                  aria-label="Удалить уведомление"
                  disabled={busyId === item.id}
                  onClick={() => void remove(item)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
              {item.kind === "payment_requested" ? (
                <div className="mt-3 flex gap-2">
                  <Button size="sm" disabled={busyId === item.id} onClick={() => void answer(item, true)}>
                    Да, получил
                  </Button>
                  <Button size="sm" variant="outline" disabled={busyId === item.id} onClick={() => void answer(item, false)}>
                    Нет, не получил
                  </Button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}

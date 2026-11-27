"use client";

import { useApp } from "@/components/app-provider";
import { PeriodFilter } from "@/components/period-filter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatMoney, receiptCountLabel } from "@/lib/format";
import { defaultPeriod, matchesPeriod, moneyOf, type PeriodValue } from "@/lib/period";
import type { Profile, Receipt, WorkCategory, WorkRecord } from "@/types";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export default function CategoriesPage() {
  const { repo } = useApp();
  const [categories, setCategories] = useState<WorkCategory[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [works, setWorks] = useState<WorkRecord[]>([]);
  const [masters, setMasters] = useState<Profile[]>([]);
  const [period, setPeriod] = useState<PeriodValue>(defaultPeriod);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [editing, setEditing] = useState<WorkCategory | null>(null);

  async function reload() {
    const [nextCategories, nextReceipts, nextWorks, users] = await Promise.all([
      repo.listCategories(),
      repo.listReceipts("all"),
      repo.listWorks("all"),
      repo.listUsers(),
    ]);
    setCategories(nextCategories);
    setReceipts(nextReceipts);
    setWorks(nextWorks);
    setMasters(users.filter((user) => user.role === "builder"));
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    try {
      if (editing) {
        await repo.updateCategory(editing.id, {
          name,
          description,
          isActive: editing.isActive,
          assigneeIds,
        });
        toast.success("Вид работ обновлён");
      } else {
        await repo.createCategory({ name, description, isActive: true, assigneeIds });
        toast.success("Вид работ добавлен");
      }
      setName("");
      setDescription("");
      setAssigneeIds([]);
      setEditing(null);
      await reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ошибка сохранения");
    }
  }

  async function toggle(category: WorkCategory) {
    await repo.updateCategory(category.id, {
      name: category.name,
      description: category.description,
      isActive: !category.isActive,
      assigneeIds: category.assigneeIds,
    });
    await reload();
  }

  async function remove(category: WorkCategory) {
    try {
      await repo.deleteCategory(category.id);
      toast.success("Удалено");
      await reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось удалить");
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Виды работ</h1>
          <p className="text-muted-foreground">Назначьте мастеров: в чеке и в работе им будут видны только свои виды.</p>
        </div>
        <PeriodFilter value={period} onChange={setPeriod} />
        <div className="space-y-3">
          {categories.map((category) => {
            const own = receipts.filter(
              (receipt) => receipt.categoryId === category.id && matchesPeriod(receipt, period),
            );
            const ownWorks = works.filter(
              (work) => work.categoryId === category.id && matchesPeriod({ receiptDate: work.startDate, createdAt: work.createdAt }, period),
            );
            const masterNames = masters.filter((master) => category.assigneeIds.includes(master.id)).map((master) => master.name);
            return (
            <div key={category.id} className="flex flex-col gap-3 rounded-lg border bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="font-medium">{category.name}</div>
                <div className="text-sm text-muted-foreground">
                  {receiptCountLabel(own.length)} · всего {formatMoney(moneyOf(own))}
                </div>
                <div className="text-sm text-muted-foreground">
                  Оплачено {formatMoney(moneyOf(own, "paid"))} · ждёт подтверждения {formatMoney(moneyOf(own, "awaiting_confirmation"))} · не оплачено {formatMoney(moneyOf(own, "unpaid"))}
                  {moneyOf(own, "pending_review") > 0
                    ? ` · на проверке ${formatMoney(moneyOf(own, "pending_review"))}`
                    : ""}
                </div>
                <div className="text-sm text-muted-foreground">
                  Мастера: {masterNames.length ? masterNames.join(", ") : "не назначены"} · работы {formatMoney(ownWorks.reduce((sum, work) => sum + (work.totalAmount ?? 0), 0))}
                </div>
                <div className="text-sm text-muted-foreground">
                  {category.isActive ? "Активен" : "Отключён"}
                  {category.description ? ` · ${category.description}` : ""}
                </div>
                <Link href={`/admin/categories/${category.id}`} className="text-sm underline">
                  Открыть чеки
                </Link>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditing(category);
                    setName(category.name);
                    setDescription(category.description);
                    setAssigneeIds(category.assigneeIds);
                  }}
                >
                  Изменить
                </Button>
                <Button variant="ghost" onClick={() => void toggle(category)}>
                  {category.isActive ? "Отключить" : "Включить"}
                </Button>
                <Button variant="destructive" onClick={() => void remove(category)}>
                  Удалить
                </Button>
              </div>
            </div>
            );
          })}
        </div>
      </div>
      <form onSubmit={(event) => void save(event)} className="h-fit space-y-4 rounded-lg border bg-white p-4">
        <h2 className="font-medium">{editing ? "Редактирование" : "Новый вид работ"}</h2>
        <div className="grid gap-2">
          <Label htmlFor="cat-name">Название</Label>
          <Input id="cat-name" value={name} onChange={(event) => setName(event.target.value)} required />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="cat-desc">Описание</Label>
          <Input id="cat-desc" value={description} onChange={(event) => setDescription(event.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label>Мастера</Label>
          {masters.length === 0 ? <p className="text-sm text-muted-foreground">Строители появятся после регистрации.</p> : null}
          {masters.map((master) => (
            <label key={master.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={assigneeIds.includes(master.id)}
                onChange={(event) => {
                  setAssigneeIds((current) =>
                    event.target.checked ? [...current, master.id] : current.filter((id) => id !== master.id),
                  );
                }}
              />
              {master.name}
            </label>
          ))}
        </div>
        <div className="flex gap-2">
          <Button type="submit">{editing ? "Сохранить" : "Добавить"}</Button>
          {editing ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setEditing(null);
                setName("");
                setDescription("");
                setAssigneeIds([]);
              }}
            >
              Отмена
            </Button>
          ) : null}
        </div>
      </form>
    </div>
  );
}

"use client";

import { DeleteReceiptDialog } from "@/components/delete-receipt-dialog";
import { PeriodFilter } from "@/components/period-filter";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDate, formatMoney, statusLabel } from "@/lib/format";
import { defaultPeriod, matchesPeriod, receiptMoment, type PeriodValue } from "@/lib/period";
import type { Receipt, ReceiptStatus, WorkCategory } from "@/types";
import { ArrowUpDown, CircleDot, Hammer, Search, Trash2, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type SortKey = "date-desc" | "date-asc" | "amount-desc" | "amount-asc";

export function ReceiptList({
  receipts,
  hrefFor,
  categories,
  detailed = false,
  onDelete,
}: {
  receipts: Receipt[];
  hrefFor: (receipt: Receipt) => string;
  categories?: WorkCategory[];
  detailed?: boolean;
  onDelete?: (receipt: Receipt) => Promise<void>;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<ReceiptStatus | "all">("all");
  const [categoryId, setCategoryId] = useState("all");
  const [sort, setSort] = useState<SortKey>("date-desc");
  const [period, setPeriod] = useState<PeriodValue>(defaultPeriod);
  const [pendingDelete, setPendingDelete] = useState<Receipt | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function confirmDelete() {
    if (!onDelete || !pendingDelete || deletingId) return;
    setDeletingId(pendingDelete.id);
    try {
      await onDelete(pendingDelete);
      setPendingDelete(null);
    } finally {
      setDeletingId(null);
    }
  }
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const next = receipts.filter((receipt) => {
      if (detailed && status !== "all" && receipt.status !== status) return false;
      if (detailed && categoryId !== "all" && receipt.categoryId !== categoryId) return false;
      if (detailed && !matchesPeriod(receipt, period)) return false;
      if (!needle) return true;
      return [receipt.storeName, receipt.categoryName, receipt.userName, receipt.commentText]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(needle));
    });
    next.sort((left, right) => {
      if (sort.startsWith("amount")) {
        const diff = (left.totalAmount ?? 0) - (right.totalAmount ?? 0);
        return sort === "amount-asc" ? diff : -diff;
      }
      const leftTime = receiptMoment(left)?.getTime() ?? 0;
      const rightTime = receiptMoment(right)?.getTime() ?? 0;
      return sort === "date-asc" ? leftTime - rightTime : rightTime - leftTime;
    });
    return next;
  }, [categoryId, detailed, period, query, receipts, sort, status]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Поиск"
            className="pl-8"
            aria-label="Поиск по магазину, виду работ, комментарию"
          />
        </div>
        {detailed ? (
          <>
            <IconSelect icon={CircleDot} label="Статус" value={status} onChange={(value) => setStatus(value as ReceiptStatus | "all")} className="w-40">
              <option value="all">Все статусы</option>
              <option value="pending_review">{statusLabel("pending_review")}</option>
              <option value="unpaid">{statusLabel("unpaid")}</option>
              <option value="paid">{statusLabel("paid")}</option>
            </IconSelect>
            <IconSelect icon={Hammer} label="Вид работ" value={categoryId} onChange={setCategoryId} className="w-44">
              <option value="all">Все виды работ</option>
              {(categories ?? []).map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </IconSelect>
            <IconSelect icon={ArrowUpDown} label="Сортировка" value={sort} onChange={(value) => setSort(value as SortKey)} className="w-48">
              <option value="date-desc">Сначала новые</option>
              <option value="date-asc">Сначала старые</option>
              <option value="amount-desc">Сначала большие суммы</option>
              <option value="amount-asc">Сначала маленькие суммы</option>
            </IconSelect>
            <PeriodFilter compact value={period} onChange={setPeriod} />
          </>
        ) : null}
      </div>
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
          Чеков пока нет
        </div>
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {filtered.map((receipt) => (
              <div key={receipt.id} className="rounded-xl border bg-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <Link href={hrefFor(receipt)} className="min-w-0">
                    <div className="font-medium">{receipt.storeName || "Магазин не указан"}</div>
                    <div className="text-sm text-muted-foreground">{receipt.categoryName}</div>
                  </Link>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={receipt.status} />
                    {onDelete ? (
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        aria-label="Удалить чек"
                        disabled={deletingId === receipt.id}
                        onClick={() => setPendingDelete(receipt)}
                      >
                        <Trash2 />
                      </Button>
                    ) : null}
                  </div>
                </div>
                <Link href={hrefFor(receipt)} className="mt-3 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{formatDate(receipt.receiptDate || receipt.createdAt)}</span>
                  <span className="font-medium">{formatMoney(receipt.totalAmount, receipt.currency)}</span>
                </Link>
              </div>
            ))}
          </div>
          <div className="hidden overflow-hidden rounded-xl border md:block">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium">Дата</th>
                  <th className="px-4 py-3 font-medium">Магазин</th>
                  <th className="px-4 py-3 font-medium">Вид работ</th>
                  <th className="px-4 py-3 font-medium">Строитель</th>
                  <th className="px-4 py-3 font-medium">Сумма</th>
                  <th className="px-4 py-3 font-medium">Статус</th>
                  {onDelete ? <th className="px-4 py-3 font-medium"><span className="sr-only">Удаление</span></th> : null}
                </tr>
              </thead>
              <tbody>
                {filtered.map((receipt) => (
                  <tr
                    key={receipt.id}
                    className="cursor-pointer border-t hover:bg-muted/40"
                    onClick={() => router.push(hrefFor(receipt))}
                  >
                    <td className="px-4 py-3">{formatDate(receipt.receiptDate || receipt.createdAt)}</td>
                    <td className="px-4 py-3 font-medium">
                      <Link href={hrefFor(receipt)} className="hover:underline" onClick={(event) => event.stopPropagation()}>
                        {receipt.storeName || "Магазин не указан"}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{receipt.categoryName}</td>
                    <td className="px-4 py-3">{receipt.userName}</td>
                    <td className="px-4 py-3">{formatMoney(receipt.totalAmount, receipt.currency)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={receipt.status} />
                    </td>
                    {onDelete ? (
                      <td className="px-4 py-3 text-right">
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          aria-label="Удалить чек"
                          disabled={deletingId === receipt.id}
                          onClick={(event) => {
                            event.stopPropagation();
                            setPendingDelete(receipt);
                          }}
                        >
                          <Trash2 />
                        </Button>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      <DeleteReceiptDialog
        receipt={pendingDelete}
        open={pendingDelete !== null}
        pending={deletingId !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}

function IconSelect({
  icon: Icon,
  label,
  value,
  onChange,
  className,
  children,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={`relative block shrink-0 ${className ?? ""}`}>
      <Icon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <select
        aria-label={label}
        className="h-8 w-full rounded-lg border bg-white pr-2 pl-8 text-sm"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {children}
      </select>
    </label>
  );
}

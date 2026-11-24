"use client";

import { DeleteReceiptDialog } from "@/components/delete-receipt-dialog";
import { PeriodFilter } from "@/components/period-filter";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDate, formatMoney, progressLabel, statusLabel } from "@/lib/format";
import { defaultPeriod, matchesPeriod, type PeriodValue } from "@/lib/period";
import type { Receipt, ReceiptStatus, WorkCategory, WorkRecord } from "@/types";
import { ArrowUpDown, CircleDot, Hammer, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Row =
  | { kind: "receipt"; receipt: Receipt; date: string | null; title: string }
  | { kind: "work"; work: WorkRecord; date: string | null; title: string };

export function SummaryTable({
  receipts,
  works,
  categories,
  detailed = false,
  hrefForReceipt,
  hrefForWork,
  onDeleteReceipt,
  onDeleteWork,
  canDeleteReceipt = () => true,
  canDeleteWork = () => true,
}: {
  receipts: Receipt[];
  works: WorkRecord[];
  categories?: WorkCategory[];
  detailed?: boolean;
  hrefForReceipt: (receipt: Receipt) => string;
  hrefForWork: (work: WorkRecord) => string;
  onDeleteReceipt?: (receipt: Receipt) => Promise<void>;
  onDeleteWork?: (work: WorkRecord) => Promise<void>;
  canDeleteReceipt?: (receipt: Receipt) => boolean;
  canDeleteWork?: (work: WorkRecord) => boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<"all" | "receipt" | "work">("all");
  const [status, setStatus] = useState<ReceiptStatus | "all">("all");
  const [categoryId, setCategoryId] = useState("all");
  const [sort, setSort] = useState("date-desc");
  const [period, setPeriod] = useState<PeriodValue>(defaultPeriod);
  const [pending, setPending] = useState<Row | null>(null);
  const [deleting, setDeleting] = useState(false);

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const next: Row[] = [
      ...receipts.map((receipt) => ({
        kind: "receipt" as const,
        receipt,
        date: receipt.receiptDate || receipt.createdAt,
        title: receipt.storeName || "Магазин не указан",
      })),
      ...works.map((work) => ({
        kind: "work" as const,
        work,
        date: work.startDate || work.createdAt,
        title: work.title,
      })),
    ].filter((row) => {
      if (kind !== "all" && row.kind !== kind) return false;
      const source = row.kind === "receipt" ? row.receipt : row.work;
      if (detailed && status !== "all" && source.status !== status) return false;
      if (detailed && categoryId !== "all" && source.categoryId !== categoryId) return false;
      if (detailed && !matchesPeriod({ receiptDate: row.date, createdAt: source.createdAt }, period)) return false;
      if (!needle) return true;
      return [row.title, source.categoryName, source.userName, source.commentText]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(needle));
    });
    next.sort((left, right) => {
      const leftAmount = left.kind === "receipt" ? left.receipt.totalAmount ?? 0 : left.work.totalAmount ?? 0;
      const rightAmount = right.kind === "receipt" ? right.receipt.totalAmount ?? 0 : right.work.totalAmount ?? 0;
      if (sort.startsWith("amount")) return sort === "amount-asc" ? leftAmount - rightAmount : rightAmount - leftAmount;
      const leftTime = new Date(left.date ?? 0).getTime();
      const rightTime = new Date(right.date ?? 0).getTime();
      return sort === "date-asc" ? leftTime - rightTime : rightTime - leftTime;
    });
    return next;
  }, [categoryId, detailed, kind, period, query, receipts, sort, status, works]);

  function href(row: Row) {
    return row.kind === "receipt" ? hrefForReceipt(row.receipt) : hrefForWork(row.work);
  }

  function canDelete(row: Row) {
    if (row.kind === "receipt") return Boolean(onDeleteReceipt) && canDeleteReceipt(row.receipt);
    return Boolean(onDeleteWork) && canDeleteWork(row.work);
  }

  async function confirmDelete() {
    if (!pending || deleting) return;
    setDeleting(true);
    try {
      if (pending.kind === "receipt") await onDeleteReceipt?.(pending.receipt);
      else await onDeleteWork?.(pending.work);
      setPending(null);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Поиск" className="pl-8" aria-label="Поиск" />
        </div>
        <FilterSelect icon={CircleDot} label="Тип" value={kind} onChange={(value) => setKind(value as typeof kind)}>
          <option value="all">Чеки и работы</option>
          <option value="receipt">Только чеки</option>
          <option value="work">Только работы</option>
        </FilterSelect>
        {detailed ? (
          <>
            <FilterSelect icon={CircleDot} label="Статус оплаты" value={status} onChange={(value) => setStatus(value as typeof status)}>
              <option value="all">Все статусы</option>
              <option value="pending_review">{statusLabel("pending_review")}</option>
              <option value="unpaid">{statusLabel("unpaid")}</option>
              <option value="awaiting_confirmation">{statusLabel("awaiting_confirmation")}</option>
              <option value="paid">{statusLabel("paid")}</option>
            </FilterSelect>
            <FilterSelect icon={Hammer} label="Вид работ" value={categoryId} onChange={setCategoryId}>
              <option value="all">Все виды работ</option>
              {(categories ?? []).map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </FilterSelect>
            <FilterSelect icon={ArrowUpDown} label="Сортировка" value={sort} onChange={setSort}>
              <option value="date-desc">Сначала новые</option>
              <option value="date-asc">Сначала старые</option>
              <option value="amount-desc">Сначала большие суммы</option>
              <option value="amount-asc">Сначала маленькие суммы</option>
            </FilterSelect>
            <PeriodFilter compact value={period} onChange={setPeriod} />
          </>
        ) : null}
      </div>
      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-white p-8 text-center text-muted-foreground">Пока ничего нет</div>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-white">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
              <tr>
                <th className="px-4 py-3">Дата</th>
                <th className="px-4 py-3">Тип</th>
                <th className="px-4 py-3">Название</th>
                <th className="hidden px-4 py-3 md:table-cell">Вид работ</th>
                <th className="hidden px-4 py-3 lg:table-cell">Мастер</th>
                <th className="px-4 py-3">Сумма</th>
                <th className="px-4 py-3">Статус</th>
                <th className="px-4 py-3"><span className="sr-only">Удаление</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const source = row.kind === "receipt" ? row.receipt : row.work;
                return (
                  <tr key={`${row.kind}-${source.id}`} className="cursor-pointer border-t hover:bg-muted/40" onClick={() => router.push(href(row))}>
                    <td className="px-4 py-3.5 text-muted-foreground">{formatDate(row.date)}</td>
                    <td className="px-4 py-3.5">{row.kind === "receipt" ? "Чек" : "Работа"}</td>
                    <td className="px-4 py-3.5 font-medium">{row.title}</td>
                    <td className="hidden px-4 py-3.5 md:table-cell">{source.categoryName}</td>
                    <td className="hidden px-4 py-3.5 lg:table-cell">{source.userName}</td>
                    <td className="px-4 py-3.5 font-medium">{formatMoney(source.totalAmount, source.currency)}</td>
                    <td className="px-4 py-3.5">
                      <div className="flex flex-wrap gap-1">
                        {row.kind === "work" ? (
                          <span className="rounded-full bg-accent px-2 py-0.5 text-xs text-accent-foreground">{progressLabel(row.work.progress)}</span>
                        ) : null}
                        <StatusBadge status={source.status} />
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      {canDelete(row) ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-destructive"
                          aria-label="Удалить"
                          onClick={(event) => {
                            event.stopPropagation();
                            setPending(row);
                          }}
                        >
                          <Trash2 />
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <DeleteReceiptDialog
        receipt={pending?.kind === "receipt" ? pending.receipt : null}
        subject={pending?.kind === "work" ? pending.work.title : undefined}
        open={pending !== null}
        pending={deleting}
        onOpenChange={(open) => {
          if (!open) setPending(null);
        }}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}

function FilterSelect({
  icon: Icon,
  label,
  value,
  onChange,
  children,
}: {
  icon: typeof Search;
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="relative block w-44 shrink-0">
      <Icon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <select aria-label={label} className="h-9 w-full rounded-xl border bg-white pr-2 pl-8 text-sm" value={value} onChange={(event) => onChange(event.target.value)}>
        {children}
      </select>
    </label>
  );
}

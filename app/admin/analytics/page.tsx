"use client";

import { useApp } from "@/components/app-provider";
import { PeriodFilter } from "@/components/period-filter";
import { StatCard } from "@/components/stat-card";
import { formatMoney, statusLabel } from "@/lib/format";
import { defaultPeriod, matchesPeriod, moneyOf, receiptMoment, type PeriodValue } from "@/lib/period";
import type { Receipt, ReceiptStatus, WorkRecord } from "@/types";
import { useEffect, useMemo, useState } from "react";

export default function AnalyticsPage() {
  const { repo } = useApp();
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [works, setWorks] = useState<WorkRecord[]>([]);
  const [slice, setSlice] = useState<"all" | "receipts" | "works">("all");
  const [period, setPeriod] = useState<PeriodValue>(defaultPeriod);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void Promise.all([repo.listReceipts("all"), repo.listWorks("all")]).then(([nextReceipts, nextWorks]) => {
      setReceipts(nextReceipts);
      setWorks(nextWorks);
      setLoading(false);
    });
  }, [repo]);

  const visible = useMemo(() => {
    const receiptRows: MoneyEntry[] = receipts
      .filter((receipt) => matchesPeriod(receipt, period))
      .map((receipt) => ({
        totalAmount: receipt.totalAmount,
        status: receipt.status,
        receiptDate: receipt.receiptDate,
        createdAt: receipt.createdAt,
        categoryName: receipt.categoryName,
      }));
    const workRows: MoneyEntry[] = works
      .filter((work) => matchesPeriod({ receiptDate: work.startDate, createdAt: work.createdAt }, period))
      .map((work) => ({
        totalAmount: work.totalAmount,
        status: work.status,
        receiptDate: work.startDate,
        createdAt: work.createdAt,
        categoryName: work.categoryName,
      }));
    if (slice === "receipts") return receiptRows;
    if (slice === "works") return workRows;
    return [...receiptRows, ...workRows];
  }, [period, receipts, slice, works]);
  const withAmount = visible.filter((receipt) => receipt.totalAmount != null);
  const average = withAmount.length === 0 ? null : moneyOf(withAmount) / withAmount.length;
  const months = useMemo(() => groupByMonth(visible), [visible]);
  const categories = useMemo(() => groupByCategory(visible), [visible]);
  const maxMonth = Math.max(1, ...months.map((month) => month.total));
  const maxCategory = Math.max(1, ...categories.map((category) => category.total));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Аналитика</h1>
        <p className="text-muted-foreground">Чеки, работы мастеров и выбранный период.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {([
          ["all", "Всё"],
          ["receipts", "Материалы"],
          ["works", "Работы"],
        ] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setSlice(value)}
            className={`rounded-lg px-3 py-1.5 text-sm ${slice === value ? "bg-primary text-primary-foreground" : "bg-white text-muted-foreground ring-1 ring-border"}`}
          >
            {label}
          </button>
        ))}
      </div>
      <PeriodFilter value={period} onChange={setPeriod} />
      {loading ? <p className="text-muted-foreground">Загрузка...</p> : null}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="Сумма за период" value={formatMoney(moneyOf(visible))} />
        <StatCard label="Средний чек" value={formatMoney(average)} hint={withAmount.length ? `${withAmount.length} с суммой` : undefined} />
        <StatCard label="Оплачено" value={formatMoney(moneyOf(visible, "paid"))} hint="Строитель подтвердил" />
        <StatCard label="Ждёт подтверждения" value={formatMoney(moneyOf(visible, "awaiting_confirmation"))} />
        <StatCard label="Не оплачено" value={formatMoney(moneyOf(visible, "unpaid"))} />
      </div>

      <section className="space-y-3 rounded-xl border bg-white p-4">
        <h2 className="font-medium">Оплачено и не оплачено</h2>
        <StatusBar receipts={visible} />
      </section>

      <section className="space-y-3 rounded-xl border bg-white p-4">
        <h2 className="font-medium">Расходы по месяцам</h2>
        {months.length === 0 ? <p className="text-sm text-muted-foreground">За этот период чеков нет.</p> : null}
        {months.map((month) => (
          <Bar key={month.key} label={month.label} value={formatMoney(month.total)} width={(month.total / maxMonth) * 100} />
        ))}
      </section>

      <section className="space-y-3 rounded-xl border bg-white p-4">
        <h2 className="font-medium">Расходы по видам работ</h2>
        {categories.length === 0 ? <p className="text-sm text-muted-foreground">За этот период чеков нет.</p> : null}
        {categories.map((category) => (
          <Bar key={category.name} label={category.name} value={formatMoney(category.total)} width={(category.total / maxCategory) * 100} />
        ))}
      </section>
    </div>
  );
}

type MoneyEntry = {
  totalAmount: number | null;
  status: ReceiptStatus;
  receiptDate: string | null;
  createdAt: string;
  categoryName: string;
};

function StatusBar({ receipts }: { receipts: MoneyEntry[] }) {
  const parts: ReceiptStatus[] = ["paid", "awaiting_confirmation", "unpaid", "pending_review"];
  const total = Math.max(1, moneyOf(receipts));
  return (
    <div className="space-y-3">
      <div className="flex h-3 overflow-hidden rounded-full bg-muted">
        {parts.map((status) => {
          const amount = moneyOf(receipts, status);
          if (amount <= 0) return null;
          const color =
            status === "paid"
              ? "bg-emerald-600"
              : status === "awaiting_confirmation"
                ? "bg-emerald-300"
                : status === "unpaid"
                  ? "bg-orange-400"
                  : "bg-amber-300";
          return <div key={status} className={color} style={{ width: `${(amount / total) * 100}%` }} />;
        })}
      </div>
      <div className="grid gap-2 text-sm sm:grid-cols-2">
        {parts.map((status) => (
          <div key={status}>
            <div className="text-muted-foreground">{statusLabel(status)}</div>
            <div className="font-medium">{formatMoney(moneyOf(receipts, status))}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Bar({ label, value, width }: { label: string; value: string; width: number }) {
  return (
    <div className="grid gap-1">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span>{label}</span>
        <span className="font-medium">{value}</span>
      </div>
      <div className="h-2 rounded-full bg-muted">
        <div className="h-2 rounded-full bg-primary" style={{ width: `${Math.max(width, 2)}%` }} />
      </div>
    </div>
  );
}

function groupByMonth(receipts: MoneyEntry[]) {
  const groups = new Map<string, number>();
  for (const receipt of receipts) {
    const date = receiptMoment(receipt);
    if (!date) continue;
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    groups.set(key, (groups.get(key) ?? 0) + (receipt.totalAmount ?? 0));
  }
  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, total]) => {
      const [year, month] = key.split("-");
      const label = new Date(Number(year), Number(month) - 1, 1).toLocaleDateString("ru-RU", {
        month: "long",
        year: "numeric",
      });
      return { key, label, total };
    });
}

function groupByCategory(receipts: MoneyEntry[]) {
  const groups = new Map<string, number>();
  for (const receipt of receipts) {
    groups.set(receipt.categoryName, (groups.get(receipt.categoryName) ?? 0) + (receipt.totalAmount ?? 0));
  }
  return [...groups.entries()]
    .map(([name, total]) => ({ name, total }))
    .sort((left, right) => right.total - left.total);
}

"use client";

import type { PeriodPreset, PeriodValue } from "@/lib/period";
import { CalendarRange } from "lucide-react";

const options: Array<{ id: PeriodPreset; label: string }> = [
  { id: "all", label: "За всё время" },
  { id: "month", label: "Текущий месяц" },
  { id: "week", label: "Последние 7 дней" },
  { id: "custom", label: "Произвольный период" },
];

export function PeriodFilter({
  value,
  onChange,
  compact = false,
}: {
  value: PeriodValue;
  onChange: (value: PeriodValue) => void;
  compact?: boolean;
}) {
  const select = (
    <select
      aria-label="Период"
      className={compact ? "h-8 w-full rounded-md border bg-white pr-2 pl-8 text-sm" : "h-10 rounded-md border bg-white px-3"}
      value={value.preset}
      onChange={(event) => onChange({ ...value, preset: event.target.value as PeriodPreset })}
    >
      {options.map((option) => (
        <option key={option.id} value={option.id}>
          {option.label}
        </option>
      ))}
    </select>
  );

  return (
    <div className={compact ? "flex shrink-0 items-center gap-2" : "flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end"}>
      {compact ? (
        <label className="relative block w-44">
          <CalendarRange className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          {select}
        </label>
      ) : (
      <label className="grid gap-1 text-sm">
        <span className="text-muted-foreground">Период</span>
        {select}
      </label>
      )}
      {value.preset === "custom" ? (
        compact ? (
          <>
            <input
              type="date"
              aria-label="С"
              className="h-8 rounded-md border bg-white px-2 text-sm"
              value={value.from}
              onChange={(event) => onChange({ ...value, from: event.target.value })}
            />
            <input
              type="date"
              aria-label="По"
              className="h-8 rounded-md border bg-white px-2 text-sm"
              value={value.to}
              onChange={(event) => onChange({ ...value, to: event.target.value })}
            />
          </>
        ) : (
        <>
          <label className="grid gap-1 text-sm">
            <span className="text-muted-foreground">С</span>
            <input
              type="date"
              className="h-10 rounded-md border bg-white px-3"
              value={value.from}
              onChange={(event) => onChange({ ...value, from: event.target.value })}
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-muted-foreground">По</span>
            <input
              type="date"
              className="h-10 rounded-md border bg-white px-3"
              value={value.to}
              onChange={(event) => onChange({ ...value, to: event.target.value })}
            />
          </label>
        </>
        )
      ) : null}
    </div>
  );
}

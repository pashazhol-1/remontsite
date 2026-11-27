"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";

const SLIDES = [
  {
    title: "Учёт строительного бюджета",
    body: "Чеки, работы и оплаты в одной сводке. Сразу видно, сколько уже потрачено и что ещё не оплачено.",
    kind: "budget",
  },
  {
    title: "Удобная связь с мастерами",
    body: "Назначьте вид работ мастеру. Он видит только своё и подтверждает, что деньги получил.",
    kind: "masters",
  },
  {
    title: "ИИ-помощник",
    body: "Фото чека читается само: магазин и сумма появляются без ручного ввода. Голос тоже превращается в текст.",
    kind: "ai",
  },
] as const;

function ScreenPlaceholder({ kind }: { kind: (typeof SLIDES)[number]["kind"] }) {
  return (
    <div className="mt-6 flex flex-1 flex-col rounded-lg bg-white p-4 text-foreground shadow-lg">
      <div className="flex items-center gap-2">
        <span className="size-2 rounded-full bg-slate-200" />
        <span className="h-2 w-20 rounded-full bg-slate-200" />
      </div>
      {kind === "masters" ? (
        <div className="mt-4 space-y-2">
          <div className="h-10 rounded-md bg-slate-100" />
          <div className="h-10 rounded-md bg-slate-100" />
          <div className="h-10 w-2/3 rounded-md bg-primary/15" />
        </div>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="h-14 rounded-md bg-primary/15" />
            <div className="h-14 rounded-md bg-slate-100" />
            <div className="h-14 rounded-md bg-slate-100" />
          </div>
          <div className="mt-3 flex h-24 items-end gap-1.5">
            {[40, 65, 48, 80, 56, 72, 44].map((height) => (
              <div key={height} className="flex-1 rounded-sm bg-primary/70" style={{ height: `${height}%` }} />
            ))}
          </div>
        </>
      )}
      <p className="mt-auto pt-3 text-center text-xs text-slate-400">Здесь будет экран приложения</p>
    </div>
  );
}

function SlidePanel({
  slide,
  children,
}: {
  slide: (typeof SLIDES)[number];
  children?: React.ReactNode;
}) {
  return (
    <section className="flex min-h-[460px] flex-col bg-primary p-6 text-primary-foreground lg:m-3 lg:min-h-[520px] lg:rounded-lg" aria-label={slide.title}>
      <h2 className="text-center text-xl font-semibold tracking-tight">«{slide.title}»</h2>
      <p className="mx-auto mt-2 max-w-sm text-center text-sm leading-5 text-primary-foreground/80">{slide.body}</p>
      <ScreenPlaceholder kind={slide.kind} />
      {children}
    </section>
  );
}

export function LoginOnboarding({ variant = "admin" }: { variant?: "admin" | "builder" }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (variant === "builder") return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % SLIDES.length);
    }, 5500);
    return () => window.clearInterval(timer);
  }, [variant]);

  if (variant === "builder") {
    return <SlidePanel slide={SLIDES[2]} />;
  }

  const slide = SLIDES[index];

  function step(direction: number) {
    setIndex((current) => (current + direction + SLIDES.length) % SLIDES.length);
  }

  return (
    <SlidePanel slide={slide}>
      <div className="mt-4 flex items-center justify-between">
        <button type="button" className="flex size-8 items-center justify-center rounded-full bg-white/15 hover:bg-white/25" aria-label="Предыдущий экран" onClick={() => step(-1)}>
          <ChevronLeft className="size-4" />
        </button>
        <div className="flex gap-1.5" aria-label="Возможности ZholBuild">
          {SLIDES.map((item, itemIndex) => (
            <button
              key={item.kind}
              type="button"
              aria-label={item.title}
              aria-current={itemIndex === index ? "true" : undefined}
              className={itemIndex === index ? "h-1.5 w-5 rounded-full bg-white" : "size-1.5 rounded-full bg-white/40"}
              onClick={() => setIndex(itemIndex)}
            />
          ))}
        </div>
        <button type="button" className="flex size-8 items-center justify-center rounded-full bg-white/15 hover:bg-white/25" aria-label="Следующий экран" onClick={() => step(1)}>
          <ChevronRight className="size-4" />
        </button>
      </div>
    </SlidePanel>
  );
}

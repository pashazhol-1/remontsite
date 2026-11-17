"use client";

import { useApp } from "@/components/app-provider";
import { resetDemoData } from "@/lib/demo/repository";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { APP_NAME, APP_TAGLINE } from "@/lib/config";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export default function LoginPage() {
  const { repo, profile, ready, isDemo } = useApp();
  const router = useRouter();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!ready || !profile) return;
    router.replace(profile.role === "admin" ? "/admin" : "/builder");
  }, [ready, profile, router]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      const next = await repo.signIn(login, password);
      router.replace(next.role === "admin" ? "/admin" : "/builder");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось войти");
    } finally {
      setLoading(false);
    }
  }

  async function demo(kind: "zakazchik" | "stroitel") {
    setLoading(true);
    try {
      const next = await repo.signIn(kind, "demo");
      router.replace(next.role === "admin" ? "/admin" : "/builder");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось войти");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f7f6f3] px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border bg-white p-6 shadow-sm">
        <div className="mb-6">
          <span className="mb-3 inline-flex size-16 overflow-hidden">
            <img src="/logo.jpg" alt={APP_NAME} className="size-16 scale-[1.7] object-cover" />
          </span>
          <p className="text-muted-foreground">{APP_TAGLINE}</p>
        </div>

        {isDemo ? (
          <div className="mb-6 space-y-2 rounded-xl bg-muted p-4">
            <p className="text-sm font-medium">Демо-режим</p>
            <p className="text-sm text-muted-foreground">
              Можно сразу войти без настройки базы. Пароль у обоих: <b>demo</b>
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Button type="button" className="h-11" onClick={() => void demo("zakazchik")} disabled={loading}>
                Я заказчик
              </Button>
              <Button type="button" variant="outline" className="h-11" onClick={() => void demo("stroitel")} disabled={loading}>
                Я строитель
              </Button>
            </div>
          </div>
        ) : null}

        <form onSubmit={(event) => void submit(event)} className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="login">Логин или email</Label>
            <Input
              id="login"
              autoComplete="username"
              value={login}
              onChange={(event) => setLogin(event.target.value)}
              placeholder="ivan или ivan@email.com"
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password">Пароль</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>
          <Button type="submit" className="h-11 w-full" disabled={loading}>
            {loading ? "Вход..." : "Войти"}
          </Button>
        </form>

        {isDemo ? (
          <Button
            type="button"
            variant="ghost"
            className="mt-3 w-full"
            onClick={() => {
              resetDemoData();
              toast.success("Демо-данные сброшены. Войдите снова.");
            }}
          >
            Сбросить демо-данные
          </Button>
        ) : null}

        <p className="mt-4 text-center text-sm text-muted-foreground">
          Нет аккаунта?{" "}
          <Link href="/register" className="font-medium text-foreground underline">
            Зарегистрироваться
          </Link>
        </p>
        {isDemo ? (
          <p className="mt-3 text-xs leading-5 text-muted-foreground">
            Демо-логины: zakazchik и stroitel, пароль demo. Новый человек на странице регистрации станет строителем.
          </p>
        ) : null}
      </div>
    </div>
  );
}

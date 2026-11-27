"use client";

import { useApp } from "@/components/app-provider";
import { AuthShell } from "@/components/auth-shell";
import { resetDemoData } from "@/lib/demo/repository";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { APP_TAGLINE } from "@/lib/config";
import type { Profile } from "@/types";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { toast } from "sonner";

function doorMessage(expected: Profile["role"]) {
  return expected === "builder"
    ? "Этот вход для строителя. Заказчик заходит обычной кнопкой «Войти»."
    : "Этот вход для заказчика. Строитель заходит кнопкой «Войти как строитель».";
}

function LoginForm() {
  const { repo, profile, ready, isDemo } = useApp();
  const router = useRouter();
  const asBuilder = useSearchParams().get("as") === "builder";
  const expected: Profile["role"] = asBuilder ? "builder" : "admin";
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [holdRedirect, setHoldRedirect] = useState(false);

  useEffect(() => {
    if (holdRedirect || !ready || !profile) return;
    router.replace(profile.role === "admin" ? "/admin" : "/builder");
  }, [holdRedirect, ready, profile, router]);

  async function enter(next: Profile) {
    if (next.role !== expected) {
      await repo.signOut();
      toast.error(doorMessage(expected));
      return;
    }
    router.replace(next.role === "admin" ? "/admin" : "/builder");
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setHoldRedirect(true);
    setLoading(true);
    try {
      await enter(await repo.signIn(login, password));
    } catch (error) {
      setHoldRedirect(false);
      toast.error(error instanceof Error ? error.message : "Не удалось войти");
    } finally {
      setLoading(false);
    }
  }

  async function demo(kind: "zakazchik" | "stroitel") {
    setHoldRedirect(true);
    setLoading(true);
    try {
      await enter(await repo.signIn(kind, "demo"));
    } catch (error) {
      setHoldRedirect(false);
      toast.error(error instanceof Error ? error.message : "Не удалось войти");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell variant={expected}>
      <div className="mb-6">
        <p className="mb-3 text-3xl font-extrabold tracking-tight text-foreground">
          <span className="text-primary">Zhol</span>Build
        </p>
        <p className="text-muted-foreground">{asBuilder ? "Вход для строителя" : APP_TAGLINE}</p>
      </div>

      {isDemo ? (
        <div className="mb-6 space-y-2 rounded-lg bg-muted p-4">
          <p className="text-sm font-medium">Демо-режим</p>
          <Button
            type="button"
            className="h-11 w-full"
            variant={asBuilder ? "outline" : "default"}
            onClick={() => void demo(asBuilder ? "stroitel" : "zakazchik")}
            disabled={loading}
          >
            {asBuilder ? "Я строитель" : "Я заказчик"}
          </Button>
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
            className="bg-white"
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
            className="bg-white"
            required
          />
        </div>
        <Button type="submit" className="h-11 w-full" disabled={loading}>
          {loading ? "Вход..." : "Войти"}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-11 w-full"
          onClick={() => router.push(asBuilder ? "/login" : "/login?as=builder")}
        >
          {asBuilder ? "Войти как заказчик" : "Войти как строитель"}
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
        <Link href={asBuilder ? "/register?as=builder" : "/register"} className="font-medium text-foreground underline">
          Зарегистрироваться
        </Link>
      </p>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

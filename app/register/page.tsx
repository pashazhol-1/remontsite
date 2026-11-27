"use client";

import { useApp } from "@/components/app-provider";
import { AuthShell } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Profile } from "@/types";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { toast } from "sonner";

function RegisterForm() {
  const { repo, profile, ready } = useApp();
  const router = useRouter();
  const asBuilder = useSearchParams().get("as") === "builder";
  const expected: Profile["role"] = asBuilder ? "builder" : "admin";
  const [name, setName] = useState("");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [holdRedirect, setHoldRedirect] = useState(false);

  useEffect(() => {
    if (holdRedirect || !ready || !profile) return;
    router.replace(profile.role === "admin" ? "/admin" : "/builder");
  }, [holdRedirect, ready, profile, router]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (password.length < 6) {
      toast.error("Пароль должен быть не короче 6 символов");
      return;
    }
    setHoldRedirect(true);
    setLoading(true);
    try {
      const next = await repo.signUp(name, login, password, expected);
      if (next.role !== expected) {
        await repo.signOut();
        toast.error("Роль не сохранилась. В SQL Editor ещё раз выполните файл supabase/works.sql и зарегистрируйтесь снова.");
        return;
      }
      toast.success(next.role === "admin" ? "Вы зарегистрированы как заказчик" : "Вы зарегистрированы как строитель");
      router.replace(next.role === "admin" ? "/admin" : "/builder");
    } catch (error) {
      setHoldRedirect(false);
      toast.error(error instanceof Error ? error.message : "Не удалось зарегистрироваться");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell variant={expected}>
      <p className="mb-3 text-3xl font-extrabold tracking-tight text-foreground">
        <span className="text-primary">Zhol</span>Build
      </p>
      <p className="mb-6 text-muted-foreground">{asBuilder ? "Регистрация строителя" : "Регистрация заказчика"}</p>
      <form onSubmit={(event) => void submit(event)} className="space-y-4">
        <div className="grid gap-2">
          <Label htmlFor="name">Имя</Label>
          <Input id="name" value={name} onChange={(event) => setName(event.target.value)} required placeholder="Иван" className="bg-white" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="login">Логин или email</Label>
          <Input
            id="login"
            value={login}
            onChange={(event) => setLogin(event.target.value)}
            required
            placeholder="ivan или почта"
            className="bg-white"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="password">Пароль</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength={6}
            className="bg-white"
          />
        </div>
        <Button type="submit" className="h-11 w-full" disabled={loading}>
          {loading ? "Создание..." : "Создать аккаунт"}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-11 w-full"
          onClick={() => router.push(asBuilder ? "/register" : "/register?as=builder")}
        >
          {asBuilder ? "Зарегистрироваться как заказчик" : "Зарегистрироваться как строитель"}
        </Button>
      </form>
      <p className="mt-4 text-center text-sm text-muted-foreground">
        Уже есть аккаунт?{" "}
        <Link href={asBuilder ? "/login?as=builder" : "/login"} className="font-medium text-foreground underline">
          Войти
        </Link>
      </p>
    </AuthShell>
  );
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  );
}

"use client";

import { useApp } from "@/components/app-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export default function RegisterPage() {
  const { repo, profile, ready } = useApp();
  const router = useRouter();
  const [name, setName] = useState("");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!ready || !profile) return;
    router.replace(profile.role === "admin" ? "/admin" : "/builder");
  }, [ready, profile, router]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (password.length < 6) {
      toast.error("Пароль должен быть не короче 6 символов");
      return;
    }
    setLoading(true);
    try {
      const next = await repo.signUp(name, login, password);
      toast.success(next.role === "admin" ? "Вы зарегистрированы как заказчик" : "Вы зарегистрированы как строитель");
      router.replace(next.role === "admin" ? "/admin" : "/builder");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось зарегистрироваться");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border bg-white p-7 shadow-sm">
        <p className="mb-3 text-3xl font-extrabold tracking-tight text-foreground">
          <span className="text-primary">Zhol</span>Build
        </p>
        <p className="mb-6 text-muted-foreground">Создание аккаунта</p>
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
              placeholder="stroitel1 или почта"
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
        </form>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Уже есть аккаунт?{" "}
          <Link href="/login" className="font-medium text-foreground underline">
            Войти
          </Link>
        </p>
      </div>
    </div>
  );
}

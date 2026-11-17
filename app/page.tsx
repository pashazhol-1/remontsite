"use client";

import { useApp } from "@/components/app-provider";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function HomePage() {
  const { ready, profile } = useApp();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    if (!profile) {
      router.replace("/login");
      return;
    }
    router.replace(profile.role === "admin" ? "/admin" : "/builder");
  }, [ready, profile, router]);

  return (
    <div className="flex min-h-screen items-center justify-center text-muted-foreground">
      Загрузка...
    </div>
  );
}

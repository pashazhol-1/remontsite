"use client";

import { useApp } from "@/components/app-provider";
import type { UserRole } from "@/types";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

export function RequireAuth({
  role,
  children,
}: {
  role: UserRole;
  children: ReactNode;
}) {
  const { ready, profile } = useApp();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    if (!profile) {
      router.replace("/login");
      return;
    }
    if (profile.role !== role) {
      router.replace(profile.role === "admin" ? "/admin" : "/builder");
    }
  }, [ready, profile, role, router]);

  if (!ready || !profile || profile.role !== role) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Загрузка...
      </div>
    );
  }

  return <>{children}</>;
}

"use client";

import { AppHeader } from "@/components/app-header";
import { RequireAuth } from "@/components/require-auth";
import type { UserRole } from "@/types";
import type { ReactNode } from "react";

export function AppShell({
  role,
  children,
}: {
  role: UserRole;
  children: ReactNode;
}) {
  return (
    <RequireAuth role={role}>
      <div className="min-h-screen bg-[#f7f6f3]">
        <AppHeader />
        <main className="mx-auto w-full max-w-6xl px-4 py-6">{children}</main>
      </div>
    </RequireAuth>
  );
}

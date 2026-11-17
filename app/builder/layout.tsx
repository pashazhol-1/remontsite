"use client";

import { AppShell } from "@/components/app-shell";
import type { ReactNode } from "react";

export default function BuilderLayout({ children }: { children: ReactNode }) {
  return <AppShell role="builder">{children}</AppShell>;
}

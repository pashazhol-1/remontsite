"use client";

import { useApp } from "@/components/app-provider";
import { Button } from "@/components/ui/button";
import { APP_NAME } from "@/lib/config";
import { roleLabel } from "@/lib/format";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

const adminLinks = [
  { href: "/admin", label: "Чеки" },
  { href: "/admin/analytics", label: "Аналитика" },
  { href: "/admin/categories", label: "Виды работ" },
  { href: "/admin/team", label: "Команда" },
];

const builderLinks = [
  { href: "/builder", label: "Мои чеки" },
  { href: "/builder/new", label: "Добавить чек" },
];

function linkIsActive(href: string, pathname: string) {
  if (href === "/admin") return pathname === "/admin" || pathname.startsWith("/admin/receipts");
  if (href === "/builder") return pathname === "/builder" || pathname.startsWith("/builder/receipts");
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppHeader() {
  const { profile, repo, isDemo } = useApp();
  const pathname = usePathname();
  const router = useRouter();
  const links = profile?.role === "admin" ? adminLinks : builderLinks;

  async function logout() {
    await repo.signOut();
    router.replace("/login");
  }

  return (
    <header className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
        <Link href={profile?.role === "admin" ? "/admin" : "/builder"} className="inline-flex size-10 shrink-0 overflow-hidden" aria-label={APP_NAME}>
          <img src="/logo.jpg" alt="" className="size-10 scale-[1.7] object-cover" />
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {links.map((link) => {
            const active = linkIsActive(link.href, pathname);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-lg px-3 py-1.5 text-sm ${
                  active ? "bg-muted font-medium" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {isDemo ? (
            <span className="hidden rounded-full border px-2 py-0.5 text-xs text-muted-foreground sm:inline">
              Демо
            </span>
          ) : null}
          <img
            src="/avatar.jpg"
            alt=""
            className="size-9 rounded-full object-cover"
          />
          <div className="hidden text-right sm:block">
            <div className="text-sm font-medium">{profile?.name}</div>
            <div className="text-xs text-muted-foreground">
              {profile ? roleLabel(profile.role) : ""}
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={() => void logout()} aria-label="Выйти">
            <LogOut />
          </Button>
        </div>
      </div>
      <nav className="flex gap-1 overflow-x-auto px-4 pb-3 md:hidden">
        {links.map((link) => {
          const active = linkIsActive(link.href, pathname);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-full px-3 py-1 text-sm whitespace-nowrap ${
                active ? "bg-foreground text-background" : "bg-muted text-muted-foreground"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}

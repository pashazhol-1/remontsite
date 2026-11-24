"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";

export function AddEntryMenu({
  receiptHref,
  workHref,
}: {
  receiptHref: string;
  workHref: string;
}) {
  const router = useRouter();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button className="h-11 px-5" />}>
        <Plus />
        Добавить
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-40">
        <DropdownMenuItem onClick={() => router.push(receiptHref)}>Чек</DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push(workHref)}>Работу</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

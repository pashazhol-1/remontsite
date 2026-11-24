"use client";

import { useApp } from "@/components/app-provider";
import { roleLabel } from "@/lib/format";
import type { Profile } from "@/types";
import { useEffect, useState } from "react";

export default function TeamPage() {
  const { repo } = useApp();
  const [users, setUsers] = useState<Profile[]>([]);

  useEffect(() => {
    void repo.listUsers().then(setUsers);
  }, [repo]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Команда</h1>
        <p className="max-w-2xl text-muted-foreground">
          Заказчик в системе один — тот, кто зарегистрировался первым. Строители регистрируются сами:
          придумывают логин и пароль на странице регистрации или входят через Google.
        </p>
      </div>
      <div className="overflow-hidden rounded-xl border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
            <tr>
              <th className="px-4 py-3">Имя</th>
              <th className="px-4 py-3">Логин</th>
              <th className="px-4 py-3">Роль</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-t">
                <td className="px-4 py-3">{user.name}</td>
                <td className="px-4 py-3">{user.login}</td>
                <td className="px-4 py-3">{roleLabel(user.role)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

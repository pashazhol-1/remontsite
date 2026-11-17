"use client";

import { createRepository } from "@/lib/data";
import type { AppRepository } from "@/lib/data/repository";
import { isDemoMode } from "@/lib/config";
import type { Profile } from "@/types";
import { ThemeProvider } from "next-themes";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type AppContextValue = {
  ready: boolean;
  profile: Profile | null;
  isDemo: boolean;
  repo: AppRepository;
  refresh: () => Promise<void>;
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const repo = useMemo(() => createRepository(), []);
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);

  async function refresh() {
    const next = await repo.getSession();
    setProfile(next);
    setReady(true);
  }

  useEffect(() => {
    void refresh();
    return repo.onAuthChange((next) => {
      setProfile(next);
      setReady(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repo]);

  return (
    <ThemeProvider attribute="class" defaultTheme="light" forcedTheme="light">
      <AppContext.Provider
        value={{ ready, profile, isDemo: isDemoMode(), repo, refresh }}
      >
        {children}
      </AppContext.Provider>
    </ThemeProvider>
  );
}

export function useApp() {
  const value = useContext(AppContext);
  if (!value) {
    throw new Error("useApp должен вызываться внутри AppProvider");
  }
  return value;
}

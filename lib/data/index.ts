import { hasSupabaseConfig, isDemoMode } from "@/lib/config";
import type { AppRepository } from "@/lib/data/repository";
import { createDemoRepository } from "@/lib/demo/repository";
import { createSupabaseRepository } from "@/lib/supabase/repository";

export function createRepository(): AppRepository {
  if (isDemoMode() || !hasSupabaseConfig()) {
    return createDemoRepository();
  }
  return createSupabaseRepository();
}

export const APP_NAME = "ОтчетСтроителя";
export const APP_TAGLINE = "Учёт расходов на ремонт";
export const DEFAULT_CURRENCY = "BYN";

export function isDemoMode() {
  if (process.env.NEXT_PUBLIC_DEMO_MODE === "true") return true;
  if (process.env.NEXT_PUBLIC_DEMO_MODE === "false") return false;
  return !process.env.NEXT_PUBLIC_SUPABASE_URL;
}

export function hasSupabaseConfig() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

export function toAuthEmail(login: string) {
  const value = login.trim().toLowerCase();
  if (value.includes("@")) return value;
  return `${value}@local.otchetstroitelya`;
}

export function loginFromEmail(email: string | null | undefined) {
  if (!email) return "";
  if (email.endsWith("@local.otchetstroitelya")) {
    return email.replace("@local.otchetstroitelya", "");
  }
  return email;
}

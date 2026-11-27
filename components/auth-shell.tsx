import { LoginOnboarding } from "@/components/login-onboarding";

export function AuthShell({
  variant,
  children,
}: {
  variant: "admin" | "builder";
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f4f4f5] px-4 py-8">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-lg bg-white shadow-[0_20px_60px_rgba(20,16,40,0.08)] lg:grid-cols-2">
        <LoginOnboarding variant={variant} />
        <div className="flex items-center px-7 py-10 sm:px-10">
          <div className="w-full">{children}</div>
        </div>
      </div>
    </div>
  );
}

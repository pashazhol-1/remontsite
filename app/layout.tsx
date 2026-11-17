import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import { AppProvider } from "@/components/app-provider";
import { Toaster } from "@/components/ui/sonner";
import { APP_NAME, APP_TAGLINE } from "@/lib/config";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin", "cyrillic"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: APP_NAME,
  description: APP_TAGLINE,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru" className={`${manrope.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col font-sans">
        <AppProvider>
          {children}
          <Toaster />
        </AppProvider>
      </body>
    </html>
  );
}

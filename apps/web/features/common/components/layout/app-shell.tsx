"use client";

import { AppModeProvider, ModeBanner, useAppMode } from "@/features/mode";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

import { Footer } from "./footer";
import { Header } from "./header";

function isAdminPath(pathname: string) {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

function ShellFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { mode } = useAppMode();
  const isAdminRoute = isAdminPath(pathname);
  const activeMode = isAdminRoute ? "admin" : mode;

  // Dialogs and toasts render in portals outside this frame, so mirror the mode on <html>.
  useEffect(() => {
    document.documentElement.dataset.mode = activeMode;
    return () => {
      delete document.documentElement.dataset.mode;
    };
  }, [activeMode]);

  return (
    <div data-mode={activeMode} className="min-h-screen bg-[var(--mode-page)] text-foreground">
      <Header />
      {isAdminRoute ? null : <ModeBanner />}
      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-12">{children}</main>
      <Footer />
    </div>
  );
}

/** Wraps route content with the shared Highrable navigation shell. */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isMarketingRoute = pathname === "/" || pathname === "/home";

  if (isMarketingRoute) {
    return <>{children}</>;
  }

  return (
    <AppModeProvider>
      <ShellFrame>{children}</ShellFrame>
    </AppModeProvider>
  );
}

"use client";

import { AppModeProvider, ModeBanner, useAppMode } from "@/features/mode";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import { Footer } from "./footer";
import { Header } from "./header";

function isAdminPath(pathname: string) {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

/**
 * Starts each newly visited page at the top. Next.js only scrolls when the new
 * page is out of view, which misses pages under our sticky header. Back/forward
 * navigation is left alone so the browser can restore the previous position.
 */
function useScrollToTopOnNavigate(pathname: string) {
  const isHistoryNavigation = useRef(false);
  const previousPathname = useRef(pathname);

  useEffect(() => {
    const handlePopState = () => {
      isHistoryNavigation.current = true;
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    if (previousPathname.current === pathname) return;
    previousPathname.current = pathname;

    if (isHistoryNavigation.current) {
      isHistoryNavigation.current = false;
      return;
    }
    if (window.location.hash) return;

    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname]);
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
    <div
      data-mode={activeMode}
      className="flex min-h-screen flex-col bg-[var(--mode-page)] text-foreground"
    >
      <Header />
      {isAdminRoute ? null : <ModeBanner />}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8">{children}</main>
      <Footer />
    </div>
  );
}

/** Wraps route content with the shared Highrable navigation shell. */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isMarketingRoute = pathname === "/" || pathname === "/home";

  useScrollToTopOnNavigate(pathname);

  if (isMarketingRoute) {
    return <>{children}</>;
  }

  return (
    <AppModeProvider>
      <ShellFrame>{children}</ShellFrame>
    </AppModeProvider>
  );
}

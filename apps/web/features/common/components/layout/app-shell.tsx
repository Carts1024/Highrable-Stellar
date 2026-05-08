"use client";

import { usePathname } from "next/navigation";

import { Header } from "./header";

/** Wraps route content with the shared Highrable navigation shell. */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isMarketingRoute = pathname === "/" || pathname === "/home";

  if (isMarketingRoute) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}

"use client";

import { usePathname } from "next/navigation";

import { Footer } from "./footer";
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
      <main className="mx-auto w-full max-w-7xl px-6 py-10 sm:py-12">{children}</main>
      <Footer />
    </div>
  );
}

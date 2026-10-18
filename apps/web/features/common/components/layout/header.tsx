"use client";

import { WalletAccountButton } from "@/core/wallet/components/wallet-account-button";
import { WalletConnectTrigger } from "@/core/wallet/components/wallet-connect-trigger";
import { useHighrableWalletIdentity } from "@/core/wallet/hooks/use-highrable-wallet-identity";
import {
  MODE_COPY,
  MODE_NAVIGATION,
  ModeSwitch,
  useAppMode,
  type IModeNavItem,
} from "@/features/mode";
import { V2_PAGE_CONTAINER_CLASS } from "@repo/ui/components/highrable/v2-theme";
import { cn } from "@repo/ui/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const ADMIN_NAVIGATION: readonly IModeNavItem[] = [
  { name: "Overview", href: "/admin", description: "Platform totals and recent activity" },
  { name: "Disputes", href: "/admin/disputes", description: "Review and settle cases" },
  { name: "Admins", href: "/admin/admins", description: "Who can use this area" },
];

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

// Shared nav link styles — keep in sync with v2-navbar.tsx
const NAV_LINK_BASE =
  "flex items-center gap-2 rounded-lg px-3 py-2 font-mono text-xs tracking-[0.06em] uppercase transition-colors";
const NAV_LINK_INACTIVE = "text-[#6b6b6b] hover:text-foreground hover:bg-muted";
const NAV_LINK_ACTIVE = "hr-v2-button-primary";

/** Renders the shared navigation and wallet controls for the Highrable app. */
export function Header() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const walletIdentity = useHighrableWalletIdentity();
  const { mode } = useAppMode();
  const isAdminRoute = pathname === "/admin" || pathname.startsWith("/admin/");
  const navigation = isAdminRoute ? ADMIN_NAVIGATION : MODE_NAVIGATION[mode];
  const navLabel = isAdminRoute ? "Admin navigation" : `${MODE_COPY[mode].label} navigation`;

  const walletActionClass = "hidden px-4 py-2 font-mono text-xs tracking-widest uppercase sm:block";
  const walletDrawerActionClass = "w-full px-4 py-2 font-mono text-xs tracking-widest uppercase";
  const connectedWalletClass =
    "hidden rounded-lg border border-border bg-white px-4 py-2 font-mono text-xs tracking-[0.06em] text-[#0a0a0a] uppercase transition-colors hover:border-highrable-orange-3 sm:inline-flex";

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 8);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 bg-white transition-shadow duration-300",
        isScrolled ? "shadow-[0_1px_0_var(--color-border)]" : "",
      )}
    >
      <nav className={cn(V2_PAGE_CONTAINER_CLASS, "flex h-16 items-center justify-between gap-3")}>
        {/* Logo */}
        <Link href="/home" className="flex shrink-0 items-center gap-2.5">
          <motion.div
            whileHover={{ scale: 1.03 }}
            transition={{ type: "spring", stiffness: 300 }}
            className="flex items-center gap-2.5"
          >
            <img
              src="/logo/highrable-landscape.png"
              alt="Highrable logo"
              className="h-8 w-auto max-w-[128px] object-contain"
            />
          </motion.div>
        </Link>

        {/* Desktop nav — only pages that belong to the current mode */}
        <div className="hidden items-center gap-1 md:flex" role="navigation" aria-label={navLabel}>
          {navigation.map(({ href, name }) => (
            <Link
              key={name}
              href={href}
              aria-current={isActivePath(pathname, href) ? "page" : undefined}
              className={cn(
                NAV_LINK_BASE,
                isActivePath(pathname, href) ? NAV_LINK_ACTIVE : NAV_LINK_INACTIVE,
              )}
            >
              <span>{name}</span>
            </Link>
          ))}
        </div>

        {/* Mode switch + wallet + mobile toggle */}
        <div className="flex items-center gap-3">
          {isAdminRoute ? null : <ModeSwitch className="hidden sm:inline-flex" />}
          {!walletIdentity.isConnected ? (
            <WalletConnectTrigger className={walletActionClass} />
          ) : (
            <WalletAccountButton className={connectedWalletClass} />
          )}
          <button
            className="rounded-lg p-2 text-[#6b6b6b] transition-colors hover:bg-muted hover:text-foreground md:hidden"
            onClick={() => setMobileMenuOpen((v) => !v)}
            aria-label="Toggle navigation menu"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </nav>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="absolute inset-x-0 top-16 overflow-hidden border-t border-border bg-white shadow-[0_16px_32px_rgba(10,10,10,0.08)] md:hidden"
          >
            <div className={cn(V2_PAGE_CONTAINER_CLASS, "space-y-1 py-4")}>
              {isAdminRoute ? null : (
                <div className="pb-3">
                  <p className="mb-2 font-mono text-[11px] tracking-[0.08em] text-muted-foreground uppercase">
                    I am using Highrable as a
                  </p>
                  <ModeSwitch size="large" className="w-full justify-between" />
                </div>
              )}
              {navigation.map(({ href, name, description }) => (
                <Link
                  key={name}
                  href={href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    NAV_LINK_BASE,
                    "flex-col items-start gap-0.5 text-sm",
                    isActivePath(pathname, href) ? NAV_LINK_ACTIVE : NAV_LINK_INACTIVE,
                  )}
                >
                  <span>{name}</span>
                  <span className="font-sans text-xs font-normal tracking-normal normal-case opacity-80">
                    {description}
                  </span>
                </Link>
              ))}
              <div className="border-t border-border pt-3">
                {!walletIdentity.isConnected ? (
                  <WalletConnectTrigger className={walletDrawerActionClass} />
                ) : (
                  <WalletAccountButton
                    className={cn(
                      walletDrawerActionClass,
                      "border border-border bg-white text-[#0a0a0a]",
                    )}
                  />
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

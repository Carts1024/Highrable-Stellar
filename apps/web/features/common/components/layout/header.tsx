"use client";

import { WalletConnectTrigger } from "@/core/wallet/components/wallet-connect-trigger";
import { useHighrableWalletIdentity } from "@/core/wallet/hooks/use-highrable-wallet-identity";
import { useIsVerifiedAdminOwner } from "@/features/admin/lib/admin-session-query";
import { MODE_COPY, MODE_NAVIGATION, useAppMode, type IModeNavItem } from "@/features/mode";
import { ThemeToggle } from "@repo/ui/components/highrable/theme-toggle";
import { V2_PAGE_CONTAINER_CLASS } from "@repo/ui/components/highrable/v2-theme";
import { cn } from "@repo/ui/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { HeaderProfileLink } from "./header-profile-link";

interface IAdminNavItem extends IModeNavItem {
  /** Shown only to the verified platform owner; the page itself also enforces this. */
  readonly ownerOnly?: boolean;
}

const ADMIN_NAVIGATION: readonly IAdminNavItem[] = [
  {
    name: "Overview",
    href: "/admin",
    description: "Platform totals and recent activity",
    ownerOnly: true,
  },
  { name: "Disputes", href: "/admin/disputes", description: "Review and settle cases" },
  { name: "Admins", href: "/admin/admins", description: "Who can use this area", ownerOnly: true },
];

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

// The active page is marked with a short bar in the mode colour (gradient in admin).
const NAV_LINK_BASE =
  "relative flex items-center gap-2 px-3 py-2 font-sans text-sm transition-colors";
const NAV_LINK_INACTIVE = "text-muted-foreground hover:text-foreground";
const NAV_LINK_ACTIVE =
  "font-medium text-foreground after:absolute after:inset-x-3 after:-bottom-[14px] after:h-0.5 after:rounded-full after:bg-(image:--mode-gradient)";
const NAV_LINK_ACTIVE_MOBILE = "font-medium text-foreground bg-muted";

/** Renders the shared navigation and wallet controls for the Highrable app. */
export function Header() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const walletIdentity = useHighrableWalletIdentity();
  const { mode } = useAppMode();
  const isAdminRoute = pathname === "/admin" || pathname.startsWith("/admin/");
  // Owner tabs stay hidden until the server verifies the owner, so dispute admins never see them.
  const isVerifiedAdminOwner = useIsVerifiedAdminOwner({ enabled: isAdminRoute });
  const navigation = isAdminRoute
    ? ADMIN_NAVIGATION.filter((item) => !item.ownerOnly || isVerifiedAdminOwner)
    : MODE_NAVIGATION[mode];
  const navLabel = isAdminRoute ? "Admin navigation" : `${MODE_COPY[mode].label} navigation`;

  const walletActionClass = "hidden px-4 py-2 text-sm sm:block";
  const walletDrawerActionClass = "w-full px-4 py-2 text-sm";

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 8);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 border-b bg-background transition-colors",
        isScrolled ? "border-border" : "border-transparent",
      )}
    >
      <nav className={cn(V2_PAGE_CONTAINER_CLASS, "flex h-16 items-center justify-between gap-3")}>
        {/* Logo */}
        <Link href="/home" className="flex shrink-0 items-center gap-2.5">
          <img
            src="/logo/highrable-landscape.png"
            alt="Highrable logo"
            className="h-8 w-auto max-w-[128px] object-contain"
          />
        </Link>

        {/* Desktop nav — only pages that belong to the current mode */}
        <div
          className="ml-auto hidden items-center md:flex"
          role="navigation"
          aria-label={navLabel}
        >
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

        {/* Mode switch + wallet + theme + mobile toggle */}
        <div className="flex items-center gap-3">
          {isAdminRoute ? null : <HeaderProfileLink />}
          {!walletIdentity.isConnected ? (
            <WalletConnectTrigger className={walletActionClass} />
          ) : null}
          <ThemeToggle />
          <button
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:hidden"
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
            className="absolute inset-x-0 top-16 overflow-hidden border-y border-border bg-background md:hidden"
          >
            <div className={cn(V2_PAGE_CONTAINER_CLASS, "space-y-1 py-4")}>
              {navigation.map(({ href, name, description }) => (
                <Link
                  key={name}
                  href={href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    NAV_LINK_BASE,
                    "flex-col items-start gap-0.5 rounded-md",
                    isActivePath(pathname, href) ? NAV_LINK_ACTIVE_MOBILE : NAV_LINK_INACTIVE,
                  )}
                >
                  <span>{name}</span>
                  <span className="hr-text-muted text-xs font-normal">{description}</span>
                </Link>
              ))}
              {isAdminRoute ? null : (
                <div className="pt-2">
                  <HeaderProfileLink
                    showLabel
                    className="w-full"
                    onNavigate={() => setMobileMenuOpen(false)}
                  />
                </div>
              )}
              {!walletIdentity.isConnected ? (
                <div className="border-t border-border pt-3">
                  <WalletConnectTrigger className={walletDrawerActionClass} />
                </div>
              ) : null}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

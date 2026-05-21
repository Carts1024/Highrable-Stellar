"use client";

import { APP_NAME } from "@/core/constants";
import { WalletAccountButton } from "@/core/wallet/components/wallet-account-button";
import { WalletConnectTrigger } from "@/core/wallet/components/wallet-connect-trigger";
import { useHighrableWalletIdentity } from "@/core/wallet/hooks/use-highrable-wallet-identity";
import { V2_PAGE_CONTAINER_CLASS, V2_THEME } from "@repo/ui/components/highrable/v2-theme";
import { cn } from "@repo/ui/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import { Award, Briefcase, Menu, Users, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const navigation = [
  { name: "Browse Jobs", href: "/jobs", icon: Briefcase },
  { name: "Find Talent", href: "/talent", icon: Users },
  { name: "Dashboard", href: "/dashboard", icon: Award },
] as const;

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Renders the shared navigation and wallet controls for the Highrable app. */
export function Header() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const walletIdentity = useHighrableWalletIdentity();

  const inactiveNavigationClass =
    "hr-text-secondary hover:hr-text-accent font-mono text-xs tracking-[0.06em] uppercase transition-colors";
  const walletActionClass = "hidden px-4 py-2 font-mono text-xs tracking-widest uppercase sm:block";
  const walletDrawerActionClass = "w-full px-4 py-2 font-mono text-xs tracking-widest uppercase";
  const connectedWalletClass =
    "hidden rounded-lg border border-[#e8e8e8] bg-white px-4 py-2 font-mono text-xs tracking-[0.06em] text-[#0a0a0a] uppercase transition-colors hover:border-[#FF7003] hover:text-[#FF7003] sm:inline-flex";

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
      <nav className={cn(V2_PAGE_CONTAINER_CLASS, "flex h-16 items-center justify-between")}>
        <Link href="/home" className="flex items-center gap-2.5">
          <img
            src="/logo/highrable-icon.jpg"
            alt="Highrable logo"
            className="h-8 w-8 rounded-md object-cover"
          />
          <span className="hr-text-primary font-semibold tracking-tight">{APP_NAME}</span>
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          {navigation.map(({ href, icon: Icon, name }) => (
            <Link
              key={name}
              href={href}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 font-mono text-xs tracking-[0.06em] uppercase transition-colors ${
                isActivePath(pathname, href)
                  ? "hr-v2-button-primary text-white"
                  : inactiveNavigationClass
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{name}</span>
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-3">
          {!walletIdentity.isConnected ? (
            <WalletConnectTrigger className={walletActionClass} />
          ) : (
            <WalletAccountButton className={connectedWalletClass} />
          )}
          <button
            className="hr-text-secondary rounded-lg p-2 transition-colors hover:bg-secondary hover:text-(--highrable-orange-2) md:hidden"
            onClick={() => setMobileMenuOpen((currentValue) => !currentValue)}
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

      </nav>
      <AnimatePresence>
        {mobileMenuOpen ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="absolute inset-x-0 top-16 overflow-hidden border-t border-border bg-white shadow-[0_16px_32px_rgba(10,10,10,0.08)] md:hidden"
          >
            <div className={cn(V2_PAGE_CONTAINER_CLASS, "space-y-3 py-4")}>
              {navigation.map(({ href, icon: Icon, name }) => (
                <Link
                  key={name}
                  href={href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 font-mono text-xs tracking-[0.06em] uppercase transition-colors ${
                    isActivePath(pathname, href)
                      ? `${V2_THEME.gradients.primaryStrong} text-white`
                      : inactiveNavigationClass
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span>{name}</span>
                </Link>
              ))}
              <div className="border-t border-border pt-3">
                {!walletIdentity.isConnected ? (
                  <WalletConnectTrigger className={walletDrawerActionClass} />
                ) : (
                  <WalletAccountButton
                    className={`${walletDrawerActionClass} border border-[#e8e8e8] bg-white text-[#0a0a0a]`}
                  />
                )}
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </header>
  );
}

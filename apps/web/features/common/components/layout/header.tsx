"use client";

import { APP_NAME } from "@/core/constants";
import { WalletAccountButton } from "@/core/wallet/components/wallet-account-button";
import { WalletConnectTrigger } from "@/core/wallet/components/wallet-connect-trigger";
import { useWallet } from "@/core/wallet/hooks/use-wallet";
import { V2_THEME } from "@/features/common/lib/v2-theme";
import { AnimatePresence, motion } from "framer-motion";
import { Award, Briefcase, Menu, Users, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

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
  const { isConnected } = useWallet();

  return (
    <header className="sticky top-0 z-50 border-b border-[#e8e8e8] bg-white/95 backdrop-blur-sm">
      <nav className="mx-auto max-w-7xl px-6">
        <div className="flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <img
              src="/logo/highrable-icon.jpg"
              alt="Highrable logo"
              className="h-8 w-8 rounded-md object-cover"
            />
            <span
              className={`bg-clip-text text-xl font-semibold tracking-tight text-transparent ${V2_THEME.gradients.primaryStrong}`}
            >
              {APP_NAME}
            </span>
          </Link>

          <div className="hidden items-center gap-8 md:flex">
            {navigation.map(({ href, icon: Icon, name }) => (
              <Link
                key={name}
                href={href}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 font-mono text-xs tracking-[0.06em] uppercase transition-colors ${
                  isActivePath(pathname, href)
                    ? `${V2_THEME.gradients.primaryStrong} text-white`
                    : "text-[#5f5f5f] hover:bg-[#f5f5f5] hover:text-[#FF7003]"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{name}</span>
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:block">
              {!isConnected ? (
                <WalletConnectTrigger
                  className={`rounded-lg px-6 py-2 font-mono text-xs tracking-[0.08em] text-white uppercase transition-all hover:brightness-105 ${V2_THEME.gradients.primary}`}
                />
              ) : (
                <WalletAccountButton className="rounded-lg border border-[#e8e8e8] bg-white px-4 py-2 font-mono text-xs tracking-[0.06em] text-[#0a0a0a] uppercase transition-colors hover:border-[#FF7003] hover:text-[#FF7003]" />
              )}
            </div>

            <button
              className="rounded-lg p-2 text-[#5f5f5f] transition-colors hover:bg-[#f5f5f5] hover:text-[#FF7003] md:hidden"
              onClick={() => setMobileMenuOpen((currentValue) => !currentValue)}
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {mobileMenuOpen ? (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="border-t border-[#e8e8e8] bg-white md:hidden"
            >
              <div className="space-y-3 px-4 py-4">
                {navigation.map(({ href, icon: Icon, name }) => (
                  <Link
                    key={name}
                    href={href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 font-mono text-xs tracking-[0.06em] uppercase transition-colors ${
                      isActivePath(pathname, href)
                        ? `${V2_THEME.gradients.primaryStrong} text-white`
                        : "text-[#5f5f5f] hover:bg-[#f5f5f5] hover:text-[#FF7003]"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    <span>{name}</span>
                  </Link>
                ))}
                <div className="border-t border-[#e8e8e8] pt-3">
                  {!isConnected ? (
                    <WalletConnectTrigger
                      className={`w-full rounded-lg px-4 py-2 font-mono text-xs tracking-[0.08em] text-white uppercase ${V2_THEME.gradients.primary}`}
                    />
                  ) : (
                    <WalletAccountButton className="w-full rounded-lg border border-[#e8e8e8] px-4 py-2 font-mono text-xs tracking-[0.06em] text-[#0a0a0a] uppercase" />
                  )}
                </div>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </nav>
    </header>
  );
}

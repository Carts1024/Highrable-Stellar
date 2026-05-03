"use client";

import { APP_NAME } from "@/core/constants";
import { WalletAccountButton } from "@/core/wallet/components/wallet-account-button";
import { WalletConnectTrigger } from "@/core/wallet/components/wallet-connect-trigger";
import { useWallet } from "@/core/wallet/hooks/use-wallet";
import { AnimatePresence, motion } from "framer-motion";
import { Award, Briefcase, Menu, Users, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const navigation = [
  { name: "Browse Jobs", href: "/jobs", icon: Briefcase },
  { name: "Find Talent", href: "/post-job", icon: Users },
  { name: "Dashboard", href: "/dashboard", icon: Award },
] as const;

/** Renders the shared navigation and wallet controls for the Highrable app. */
export function Header() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { isConnected } = useWallet();

  return (
    <header className="sticky top-0 z-50 border-b border-gray-100 bg-white/95 backdrop-blur-sm">
      <nav className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center space-x-2">
            <img
              src="/logo/stellar/Stellar_Symbol.png"
              alt="Highrable logo"
              className="h-8 w-8 rounded-md object-contain"
            />
            <span className="bg-linear-to-r from-[#FF7003] to-[#FF8801] bg-clip-text text-xl font-bold text-transparent">
              {APP_NAME}
            </span>
          </Link>

          <div className="hidden items-center space-x-8 md:flex">
            {navigation.map(({ href, icon: Icon, name }) => (
              <Link
                key={name}
                href={href}
                className={`flex items-center space-x-2 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 ${
                  pathname === href
                    ? "bg-linear-to-r from-[#FF7003] to-[#FF8801] text-white shadow-lg"
                    : "text-gray-600 hover:bg-gray-50 hover:text-[#FF7003]"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{name}</span>
              </Link>
            ))}
          </div>

          <div className="flex items-center space-x-4">
            <div className="hidden md:block">
              {!isConnected ? (
                <WalletConnectTrigger className="rounded-lg bg-linear-to-r from-[#FF7003] to-[#FF8801] px-6 py-2 font-medium text-white shadow-lg transition-all duration-200 hover:from-[#E85D00] hover:to-[#E87A00] hover:shadow-xl" />
              ) : (
                <WalletAccountButton className="rounded-lg border-2 border-[#FF7003] bg-white px-4 py-2 font-medium text-[#FF7003] transition-all duration-200 hover:bg-[#FF7003] hover:text-white" />
              )}
            </div>

            <button
              className="rounded-lg p-2 text-gray-600 transition-colors hover:bg-gray-50 hover:text-[#FF7003] md:hidden"
              onClick={() => setMobileMenuOpen((currentValue) => !currentValue)}
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
              className="border-t border-gray-100 bg-white md:hidden"
            >
              <div className="space-y-3 px-4 py-4">
                {navigation.map(({ href, icon: Icon, name }) => (
                  <Link
                    key={name}
                    href={href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center space-x-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 ${
                      pathname === href
                        ? "bg-linear-to-r from-[#FF7003] to-[#FF8801] text-white"
                        : "text-gray-600 hover:bg-gray-50 hover:text-[#FF7003]"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    <span>{name}</span>
                  </Link>
                ))}
                <div className="border-t border-gray-100 pt-3">
                  {!isConnected ? (
                    <WalletConnectTrigger className="w-full rounded-lg bg-linear-to-r from-[#FF7003] to-[#FF8801] px-4 py-2 font-medium text-white" />
                  ) : (
                    <WalletAccountButton className="w-full rounded-lg border border-[#FF7003] px-4 py-2 font-medium text-[#FF7003]" />
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

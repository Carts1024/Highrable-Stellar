"use client";

import {
  V2_BUTTON_PRIMARY_CLASS,
  V2_BUTTON_SECONDARY_CLASS,
  V2_PAGE_CONTAINER_CLASS,
} from "@repo/ui/components/highrable/v2-theme";
import { cn } from "@repo/ui/lib/utils";
import { motion } from "framer-motion";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { NAV_LINKS } from "../constants/landing-v2.constants";

// Shared nav link styles — keep in sync with header.tsx
const NAV_LINK_BASE =
  "flex items-center gap-2 rounded-lg px-3 py-2 font-mono whitespace-nowrap text-xs tracking-[0.06em] uppercase transition-colors";
const NAV_LINK_INACTIVE = "hr-text-secondary hover:text-highrable-orange-1";
const NAV_LINK_ACTIVE = "hr-v2-button-primary text-white";

function Logo() {
  return (
    <Link href="/home" className="flex items-center gap-2.5">
      <motion.div
        whileHover={{ scale: 1.03 }}
        transition={{ type: "spring", stiffness: 300 }}
        className="flex items-center gap-2.5"
      >
        <img
          src="/logo/highrable-landscape.png"
          alt="Highrable logo"
          className="h-7 w-auto max-w-[8rem] object-contain sm:h-9 sm:max-w-[9.5rem]"
        />
      </motion.div>
    </Link>
  );
}

function NavLinks({ pathname }: { pathname: string }) {
  return (
    <nav className="hidden items-center gap-1 lg:flex">
      {NAV_LINKS.map((link) => {
        const isActive = pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <a
            key={link.href}
            href={link.href}
            className={cn(NAV_LINK_BASE, isActive ? NAV_LINK_ACTIVE : NAV_LINK_INACTIVE)}
          >
            {link.label}
          </a>
        );
      })}
    </nav>
  );
}

function NavActions() {
  const router = useRouter();

  return (
    <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
      <button
        type="button"
        onClick={() => router.push("/jobs")}
        className={`${V2_BUTTON_SECONDARY_CLASS} px-2.5 py-2 font-mono text-[0.6rem] tracking-wide uppercase sm:px-4 sm:text-xs sm:tracking-widest`}
      >
        Find Work
      </button>
      <button
        type="button"
        onClick={() => router.push("/post-job")}
        className={`${V2_BUTTON_PRIMARY_CLASS} px-2.5 py-2 font-mono text-[0.6rem] tracking-wide uppercase sm:px-4 sm:text-xs sm:tracking-widest`}
      >
        Post a Job
      </button>
    </div>
  );
}

/** Sticky top navigation bar with scroll-aware shadow transition. */
export function V2Navbar() {
  const pathname = usePathname();
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 8);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <motion.header
      initial={{ y: -8, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.35 }}
      className={cn(
        "fixed inset-x-0 top-0 z-50 bg-background transition-shadow duration-300",
        isScrolled ? "shadow-[0_1px_0_var(--color-border)]" : "",
      )}
    >
      <div
        className={cn(
          V2_PAGE_CONTAINER_CLASS,
          "flex h-16 items-center justify-between gap-2 px-4 sm:px-6",
        )}
      >
        <Logo />
        <div className="ml-auto flex items-center gap-1 sm:gap-3">
          <NavLinks pathname={pathname} />
          <NavActions />
        </div>
      </div>
    </motion.header>
  );
}

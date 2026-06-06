"use client";

import { APP_NAME } from "@/core/constants";
import {
  V2_BUTTON_PRIMARY_CLASS,
  V2_BUTTON_SECONDARY_CLASS,
  V2_PAGE_CONTAINER_CLASS,
} from "@repo/ui/components/highrable/v2-theme";
import { cn } from "@repo/ui/lib/utils";
import { motion } from "framer-motion";
import Link from "next/link";
import { useEffect, useState } from "react";

import { NAV_LINKS } from "../constants/landing-v2.constants";

function Logo() {
  return (
    <Link href="/home" className="flex items-center gap-2.5">
      <motion.div
        whileHover={{ scale: 1.03 }}
        transition={{ type: "spring", stiffness: 300 }}
        className="flex items-center gap-2.5"
      >
        <img
          src="/logo/highrable-icon.jpg"
          alt="Highrable logo"
          className="h-8 w-8 rounded-md object-cover"
        />
        <span className="hr-text-primary font-semibold tracking-tight text-lg">{APP_NAME}</span>
      </motion.div>
    </Link>
  );
}

function NavLinks() {
  return (
    <nav className="hidden items-center gap-8 md:flex">
      {NAV_LINKS.map((link) => (
        <a
          key={link.href}
          href={link.href}
          className="hr-text-secondary hover:hr-text-accent font-mono text-xs tracking-[0.06em] uppercase transition-colors"
        >
          {link.label}
        </a>
      ))}
    </nav>
  );
}

function NavActions() {
  return (
    <div className="flex items-center gap-3">
      <Link
        href="/jobs"
        className={`${V2_BUTTON_SECONDARY_CLASS} hidden px-4 py-2 font-mono text-xs tracking-widest uppercase sm:block`}
      >
        Find Work
      </Link>
      <Link
        href="/post-job"
        className={`${V2_BUTTON_PRIMARY_CLASS} px-4 py-2 font-mono text-xs tracking-widest uppercase`}
      >
        Post a Job
      </Link>
    </div>
  );
}

/** Sticky top navigation bar with scroll-aware shadow transition. */
export function V2Navbar() {
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
        "fixed inset-x-0 top-0 z-50 bg-white transition-shadow duration-300",
        isScrolled ? "shadow-[0_1px_0_theme(colors.border)]" : "",
      )}
    >
      <div className={cn(V2_PAGE_CONTAINER_CLASS, "flex h-16 items-center justify-between")}>
        <Logo />
        <NavLinks />
        <NavActions />
      </div>
    </motion.header>
  );
}

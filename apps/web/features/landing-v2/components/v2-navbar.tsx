"use client";

import { APP_NAME } from "@/core/constants";
import { cn } from "@repo/ui/lib/utils";
import Link from "next/link";
import { useEffect, useState } from "react";

import { NAV_LINKS } from "../constants/landing-v2.constants";

function Logo() {
  return (
    <Link href="/home" className="flex items-center gap-2.5">
      <img
        src="/logo/highrable-icon.jpg"
        alt="Highrable logo"
        className="h-8 w-8 rounded-md object-cover"
      />
      <span className="font-semibold tracking-tight text-[#0a0a0a]">{APP_NAME}</span>
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
          className="font-mono text-xs tracking-[0.06em] text-[#5f5f5f] uppercase transition-colors hover:text-[#FF7003]"
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
        className="hidden border border-[#e8e8e8] bg-white px-4 py-2 font-mono text-xs tracking-widest text-[#0a0a0a] uppercase transition-colors hover:border-[#FF7003] hover:text-[#FF7003] sm:block"
      >
        Find Work
      </Link>
      <Link
        href="/post-job"
        className="bg-[#0a0a0a] px-4 py-2 font-mono text-xs tracking-widest text-white uppercase transition-colors hover:bg-[#1a1a1a]"
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
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 bg-white transition-shadow duration-300",
        isScrolled ? "shadow-[0_1px_0_#e8e8e8]" : "",
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Logo />
        <NavLinks />
        <NavActions />
      </div>
    </header>
  );
}

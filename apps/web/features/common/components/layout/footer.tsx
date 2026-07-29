import { APP_NAME } from "@/core/constants";
import {
  HighrableV2Footer,
  type THighrableV2FooterLink,
  type THighrableV2FooterSection,
} from "@repo/ui/components/highrable/v2-footer";
import Link from "next/link";

const FOOTER_SECTIONS = [
  {
    title: "Platform",
    links: [
      { label: "Find Jobs", href: "/jobs" },
      { label: "Post a Job", href: "/post-job" },
      { label: "Dashboard", href: "/dashboard" },
      { label: "How It Works", href: "/home#how-it-works" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Documentation", href: "#" },
      {
        label: "Whitepaper",
        href: "https://highrable-or-a-web-3-stellar-int.gitbook.io/highrable-docs",
      },
      { label: "Security", href: "#" },
      { label: "FAQ", href: "#" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About Us", href: "#" },
      { label: "Blog", href: "#" },
      { label: "Privacy Policy", href: "#" },
      { label: "Terms of Service", href: "#" },
    ],
  },
] satisfies readonly THighrableV2FooterSection[];

const WAITLIST_FOOTER_SECTIONS = FOOTER_SECTIONS.map((section) =>
  section.title === "Platform"
    ? {
        ...section,
        links: section.links.filter((link) => link.href.startsWith("/home")),
      }
    : section,
);

const TRUST_SIGNALS = ["Escrow-backed", "Stellar payments", "Verified reputation"] as const;

function renderFooterLink(link: THighrableV2FooterLink, className: string) {
  const marker = (
    <span
      className="h-1 w-1 bg-current opacity-50 transition-opacity group-hover:opacity-100"
      aria-hidden="true"
    />
  );

  if (link.href === "#") {
    return (
      <span className={className}>
        {marker}
        {link.label}
      </span>
    );
  }

  return (
    <Link href={link.href} className={className}>
      {marker}
      {link.label}
    </Link>
  );
}

/** Renders the shared Highrable marketing footer with app-specific links and assets. */
export function Footer({ waitlistMode = false }: { readonly waitlistMode?: boolean }) {
  return (
    <HighrableV2Footer
      brand={{
        name: APP_NAME,
        description:
          "A Stellar-native freelance marketplace for escrow-backed work, faster stablecoin payouts, and portable on-chain reputation.",
        logoSrc: "/logo/highrable-icon.jpg",
        logoAlt: "Highrable logo",
      }}
      sections={waitlistMode ? WAITLIST_FOOTER_SECTIONS : FOOTER_SECTIONS}
      trustSignals={TRUST_SIGNALS}
      network={{
        label: "Built on",
        name: "Stellar Network",
        logoSrc: "/logo/stellar/Stellar_Symbol.png",
        logoAlt: "Stellar Network",
      }}
      copyright={`© 2026 ${APP_NAME}. All rights reserved.`}
      renderLink={renderFooterLink}
    />
  );
}

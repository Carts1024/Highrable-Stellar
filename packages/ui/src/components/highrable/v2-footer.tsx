import { cn } from "@repo/ui/lib/utils";

import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { V2_GRID_OVERLAY_CLASS, V2_PAGE_CONTAINER_CLASS } from "./v2-theme";

export type THighrableV2FooterLink = {
  readonly label: string;
  readonly href: string;
};

export type THighrableV2FooterSection = {
  readonly title: string;
  readonly links: readonly THighrableV2FooterLink[];
};

export type THighrableV2FooterSocialLink = {
  readonly label: string;
  readonly href: string;
  readonly icon: ReactNode;
};

export type THighrableV2FooterBrand = {
  readonly name: string;
  readonly description: string;
  readonly logoSrc: string;
  readonly logoAlt: string;
  readonly socialLinks?: readonly THighrableV2FooterSocialLink[];
};

export type THighrableV2FooterNetwork = {
  readonly label: string;
  readonly name: string;
  readonly logoSrc: string;
  readonly logoAlt: string;
};

export interface IHighrableV2FooterProps extends ComponentPropsWithoutRef<"footer"> {
  readonly brand: THighrableV2FooterBrand;
  readonly sections: readonly THighrableV2FooterSection[];
  readonly network: THighrableV2FooterNetwork;
  readonly copyright: string;
  readonly renderLink?: (link: THighrableV2FooterLink, className: string) => ReactNode;
}

const SAFE_URL_PATTERN = /^(?:\/(?!\/)|#|https:\/\/|http:\/\/)/i;
const FALLBACK_HREF = "#";

const footerLinkClassName =
  "group inline-flex min-h-8 items-center gap-2 font-mono text-xs tracking-[0.05em] text-white/50 uppercase transition-colors hover:text-white focus-visible:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30";

function normalizeSafeUrl(value: string): string {
  const sanitized = value.trim();
  if (!sanitized || !SAFE_URL_PATTERN.test(sanitized)) return FALLBACK_HREF;
  return sanitized;
}

function isExternalUrl(href: string): boolean {
  return /^https?:\/\//i.test(href);
}

function renderDefaultLink(link: THighrableV2FooterLink, className: string): ReactNode {
  const href = normalizeSafeUrl(link.href);
  return (
    <a
      href={href}
      className={className}
      rel={isExternalUrl(href) ? "noreferrer noopener" : undefined}
      target={isExternalUrl(href) ? "_blank" : undefined}
    >
      {link.label}
    </a>
  );
}

function FooterLink({
  link,
  renderLink,
}: {
  readonly link: THighrableV2FooterLink;
  readonly renderLink?: IHighrableV2FooterProps["renderLink"];
}) {
  const safeLink = { ...link, href: normalizeSafeUrl(link.href) };
  return (
    <li>
      {renderLink
        ? renderLink(safeLink, footerLinkClassName)
        : renderDefaultLink(safeLink, footerLinkClassName)}
    </li>
  );
}

function FooterSection({
  section,
  renderLink,
}: {
  readonly section: THighrableV2FooterSection;
  readonly renderLink?: IHighrableV2FooterProps["renderLink"];
}) {
  return (
    <nav aria-label={section.title}>
      {/* Orange left-border accent instead of bullet + label */}
      <h2 className="mb-5 border-l-2 border-[#FF7003] pl-3 font-mono text-[0.7rem] tracking-widest text-white/90 uppercase">
        {section.title}
      </h2>
      <ul className="space-y-3">
        {section.links.map((link) => (
          <FooterLink
            key={`${section.title}-${link.href}-${link.label}`}
            link={link}
            renderLink={renderLink}
          />
        ))}
      </ul>
    </nav>
  );
}

function BrandMark({ brand }: { readonly brand: THighrableV2FooterBrand }) {
  return (
    <div className="flex items-center gap-3">
      <img
        src={normalizeSafeUrl(brand.logoSrc)}
        alt={brand.logoAlt}
        className="h-10 w-10 rounded-lg object-cover"
      />
      <div>
        <p className="text-xl font-semibold leading-none tracking-tight text-white">{brand.name}</p>
        <p className="mt-1 font-mono text-[0.65rem] tracking-[0.08em] text-white/40 uppercase">
          Stellar-native work
        </p>
      </div>
    </div>
  );
}

function SocialLinks({ items }: { readonly items?: readonly THighrableV2FooterSocialLink[] }) {
  if (!items?.length) return null;

  return (
    <div className="mt-7 flex items-center gap-1.5">
      {items.map((social) => (
        <a
          key={social.label}
          href={normalizeSafeUrl(social.href)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={social.label}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-white/40 transition-all hover:border-[#FF7003]/50 hover:bg-[#FF7003]/10 hover:text-[#FF7003] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF7003]/50"
        >
          {social.icon}
        </a>
      ))}
    </div>
  );
}

function NetworkMark({ network }: { readonly network: THighrableV2FooterNetwork }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="font-mono text-[0.65rem] tracking-[0.08em] text-white/36 uppercase">
        {network.label}
      </span>
      <div className="flex items-center gap-2 rounded-md border border-white/10 bg-white/4 px-3 py-1.5">
        <img
          src={normalizeSafeUrl(network.logoSrc)}
          alt={network.logoAlt}
          className="h-4 w-4 opacity-80"
        />
        <span className="font-mono text-[0.7rem] tracking-[0.05em] text-white/60">
          {network.name}
        </span>
      </div>
    </div>
  );
}

/** High-contrast marketing footer — Highrable landing v2 visual system. */
export function HighrableV2Footer({
  brand,
  sections,
  network,
  copyright,
  renderLink,
  className,
  ...props
}: IHighrableV2FooterProps) {
  return (
    <footer
      className={cn("relative overflow-hidden bg-[#0a0a0a] text-white", className)}
      {...props}
    >
      {/* Subtle grid texture */}
      <div
        className={`${V2_GRID_OVERLAY_CLASS} pointer-events-none absolute inset-0 opacity-[0.03] invert`}
      />
      {/* Orange top rule */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px hr-gradient-primary" />

      <div className={cn(V2_PAGE_CONTAINER_CLASS, "relative py-16 md:py-20")}>
        {/* Main grid: brand col + links col */}
        <div className="grid gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">

          {/* Brand column */}
          <div className="flex flex-col">
            <BrandMark brand={brand} />
            <p className="mt-5 max-w-xs text-sm leading-7 text-white/52">
              {brand.description}
            </p>
            <SocialLinks items={brand.socialLinks} />
          </div>

          {/* Links columns */}
          <div className="grid grid-cols-2 gap-10 sm:grid-cols-3">
            {sections.map((section) => (
              <FooterSection key={section.title} section={section} renderLink={renderLink} />
            ))}
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-14 border-t border-white/8 pt-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="font-mono text-[0.7rem] tracking-[0.05em] text-white/36">{copyright}</p>
            <NetworkMark network={network} />
          </div>
        </div>
      </div>
    </footer>
  );
}
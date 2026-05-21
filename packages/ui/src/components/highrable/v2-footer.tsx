import { cn } from "@repo/ui/lib/utils";

import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { HighrableV2Bullet } from "./v2-marketing";
import { V2_GRID_OVERLAY_CLASS, V2_PAGE_CONTAINER_CLASS } from "./v2-theme";

export type THighrableV2FooterLink = {
  readonly label: string;
  readonly href: string;
};

export type THighrableV2FooterSection = {
  readonly title: string;
  readonly links: readonly THighrableV2FooterLink[];
};

export type THighrableV2FooterBrand = {
  readonly name: string;
  readonly description: string;
  readonly logoSrc: string;
  readonly logoAlt: string;
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
  readonly trustSignals?: readonly string[];
  readonly renderLink?: (link: THighrableV2FooterLink, className: string) => ReactNode;
}

const SAFE_URL_PATTERN = /^(?:\/(?!\/)|#|https:\/\/|http:\/\/)/i;
const FALLBACK_HREF = "#";

const footerLinkClassName =
  "group inline-flex min-h-8 items-center gap-2 text-sm leading-relaxed text-white/64 transition-colors hover:text-white focus-visible:text-white focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:outline-none";

function normalizeSafeUrl(value: string): string {
  const sanitizedValue = value.trim();

  if (sanitizedValue.length === 0 || !SAFE_URL_PATTERN.test(sanitizedValue)) {
    return FALLBACK_HREF;
  }

  return sanitizedValue;
}

function isExternalUrl(href: string): boolean {
  return /^https?:\/\//i.test(href);
}

function renderDefaultLink(link: THighrableV2FooterLink, className: string): ReactNode {
  const href = normalizeSafeUrl(link.href);
  const rel = isExternalUrl(href) ? "noreferrer noopener" : undefined;
  const target = isExternalUrl(href) ? "_blank" : undefined;

  return (
    <a href={href} className={className} rel={rel} target={target}>
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
      <div className="mb-4 inline-flex items-center gap-2">
        <HighrableV2Bullet tone="inverse" aria-hidden="true" />
        <h2 className="font-mono text-[0.7rem] tracking-[0.08em] text-white/80 uppercase">
          {section.title}
        </h2>
      </div>
      <ul className="space-y-1.5">
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
  const logoSrc = normalizeSafeUrl(brand.logoSrc);

  return (
    <div className="flex items-center gap-3">
      <img src={logoSrc} alt={brand.logoAlt} className="h-10 w-10 rounded-lg object-cover" />
      <div>
        <p className="text-xl leading-none font-semibold tracking-tight text-white">{brand.name}</p>
        <p className="mt-1 font-mono text-[0.65rem] tracking-[0.08em] text-white/44 uppercase">
          Stellar-native work
        </p>
      </div>
    </div>
  );
}

function TrustSignals({ items }: { readonly items?: readonly string[] }) {
  if (!items?.length) {
    return null;
  }

  return (
    <ul className="mt-8 grid gap-2 sm:grid-cols-3 lg:max-w-2xl">
      {items.map((item) => (
        <li
          key={item}
          className="border border-white/12 bg-white/[0.03] px-3 py-2 font-mono text-[0.65rem] tracking-[0.06em] text-white/68 uppercase"
        >
          {item}
        </li>
      ))}
    </ul>
  );
}

function NetworkMark({ network }: { readonly network: THighrableV2FooterNetwork }) {
  const logoSrc = normalizeSafeUrl(network.logoSrc);

  return (
    <div className="flex items-center gap-3">
      <span className="font-mono text-[0.7rem] tracking-[0.08em] text-white/44 uppercase">
        {network.label}
      </span>
      <span className="inline-flex items-center gap-2 border border-white/12 bg-white/[0.03] px-3 py-2">
        <img src={logoSrc} alt={network.logoAlt} className="h-5 w-5" />
        <span className="text-sm text-white/72">{network.name}</span>
      </span>
    </div>
  );
}

/** High-contrast marketing footer that follows the Highrable landing v2 visual system. */
export function HighrableV2Footer({
  brand,
  sections,
  network,
  copyright,
  trustSignals,
  renderLink,
  className,
  ...props
}: IHighrableV2FooterProps) {
  return (
    <footer
      className={cn("relative overflow-hidden bg-[#0a0a0a] text-white", className)}
      {...props}
    >
      <div
        className={`${V2_GRID_OVERLAY_CLASS} pointer-events-none absolute inset-0 opacity-[0.035] invert`}
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px hr-gradient-primary" />

      <div className={cn(V2_PAGE_CONTAINER_CLASS, "relative py-14 md:py-16")}>
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1.75fr)]">
          <div>
            <BrandMark brand={brand} />
            <p className="mt-5 max-w-md text-sm leading-7 text-white/64">{brand.description}</p>
            <TrustSignals items={trustSignals} />
          </div>

          <div className="grid gap-8 sm:grid-cols-3">
            {sections.map((section) => (
              <FooterSection key={section.title} section={section} renderLink={renderLink} />
            ))}
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-5 border-t border-white/12 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-white/44">{copyright}</p>
          <NetworkMark network={network} />
        </div>
      </div>
    </footer>
  );
}

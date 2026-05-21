import { cn } from "@repo/ui/lib/utils";

import type { ComponentPropsWithoutRef, ReactNode } from "react";

import {
  V2_BADGE_ACCENT_CLASS,
  V2_BADGE_SOLID_CLASS,
  V2_NUMBER_BADGE_CLASS,
  V2_PAGE_CONTAINER_CLASS,
  V2_PANEL_CLASS,
  V2_PANEL_INTERACTIVE_CLASS,
  V2_SECTION_SPACING_CLASS,
  V2_STEP_BADGE_CLASS,
  V2_SURFACE_MUTED_CLASS,
} from "./v2-theme";

export interface IHighrableV2SectionLabelProps extends ComponentPropsWithoutRef<"div"> {
  readonly children: string;
}

export interface IHighrableV2PageContainerProps extends ComponentPropsWithoutRef<"div"> {
  readonly children: ReactNode;
}

export interface IHighrableV2SectionProps extends ComponentPropsWithoutRef<"section"> {
  readonly children: ReactNode;
  readonly surface?: "default" | "muted";
}

export interface IHighrableV2PanelProps extends ComponentPropsWithoutRef<"div"> {
  readonly children: ReactNode;
  readonly interactive?: boolean;
}

export interface IHighrableV2BadgeProps extends ComponentPropsWithoutRef<"span"> {
  readonly children: ReactNode;
  readonly tone?: "accent" | "solid";
}

export interface IHighrableV2NumberBadgeProps extends ComponentPropsWithoutRef<"div"> {
  readonly children: ReactNode;
  readonly variant?: "number" | "step";
}

export interface IHighrableV2BulletProps extends ComponentPropsWithoutRef<"span"> {
  readonly tone?: "accent" | "muted" | "inverse";
}

/** Square-dot prefixed, monospaced uppercase label for section headers. */
export function HighrableV2SectionLabel({
  children,
  className,
  ...props
}: IHighrableV2SectionLabelProps) {
  return (
    <div className={cn("inline-flex items-center gap-2", className)} {...props}>
      <HighrableV2Bullet aria-hidden="true" />
      <span className="hr-text-accent font-mono text-[0.7rem] font-medium tracking-[0.08em] uppercase">
        {children}
      </span>
    </div>
  );
}

export function HighrableV2PageContainer({
  children,
  className,
  ...props
}: IHighrableV2PageContainerProps) {
  return (
    <div className={cn(V2_PAGE_CONTAINER_CLASS, className)} {...props}>
      {children}
    </div>
  );
}

export function HighrableV2Section({
  children,
  className,
  surface = "default",
  ...props
}: IHighrableV2SectionProps) {
  return (
    <section
      className={cn(
        surface === "muted" ? V2_SURFACE_MUTED_CLASS : "bg-white",
        V2_SECTION_SPACING_CLASS,
        className,
      )}
      {...props}
    >
      {children}
    </section>
  );
}

export function HighrableV2Panel({
  children,
  className,
  interactive = false,
  ...props
}: IHighrableV2PanelProps) {
  return (
    <div
      className={cn(interactive ? V2_PANEL_INTERACTIVE_CLASS : V2_PANEL_CLASS, className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function HighrableV2Badge({
  children,
  className,
  tone = "accent",
  ...props
}: IHighrableV2BadgeProps) {
  return (
    <span
      className={cn(
        "inline-block px-2.5 py-0.5 font-mono text-[0.6rem] tracking-[0.08em] uppercase",
        tone === "solid" ? V2_BADGE_SOLID_CLASS : V2_BADGE_ACCENT_CLASS,
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}

export function HighrableV2NumberBadge({
  children,
  className,
  variant = "number",
  ...props
}: IHighrableV2NumberBadgeProps) {
  return (
    <div
      className={cn(
        variant === "step" ? V2_STEP_BADGE_CLASS : V2_NUMBER_BADGE_CLASS,
        "flex shrink-0 items-center justify-center",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function HighrableV2Bullet({
  className,
  tone = "accent",
  ...props
}: IHighrableV2BulletProps) {
  return (
    <span
      className={cn(
        "inline-block h-1 w-1 shrink-0 bg-current",
        tone === "accent" ? "hr-text-accent" : undefined,
        tone === "muted" ? "text-border" : undefined,
        tone === "inverse" ? "text-white/80" : undefined,
        className,
      )}
      {...props}
    />
  );
}

export { HighrableV2SectionLabel as SectionLabel };

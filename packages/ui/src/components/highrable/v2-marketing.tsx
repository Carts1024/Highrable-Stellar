"use client";

import { cn } from "@repo/ui/lib/utils";
import { Info } from "lucide-react";

import type { TTooltipTone } from "../ui/tooltip";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";
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

export interface IHighrableV2MetricProps extends ComponentPropsWithoutRef<"div"> {
  readonly label: string;
  readonly value: ReactNode;
  readonly description?: ReactNode;
}

export interface IHighrableV2IconNoticeProps extends ComponentPropsWithoutRef<"span"> {
  readonly label: string;
  readonly message: ReactNode;
  readonly tone?: "neutral" | "warning" | "danger" | "success";
}

const ICON_NOTICE_CLASSES: Record<Required<IHighrableV2IconNoticeProps>["tone"], string> = {
  neutral: "border-border bg-background text-muted-foreground",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
  danger: "border-red-200 bg-red-50 text-red-600",
  success: "border-emerald-200 bg-emerald-50 text-emerald-600",
};

const NOTICE_TO_TOOLTIP_TONE: Record<Required<IHighrableV2IconNoticeProps>["tone"], TTooltipTone> =
  {
    neutral: "neutral",
    warning: "warning",
    danger: "danger",
    success: "success",
  };

/** Square-dot prefixed, monospaced uppercase label for section headers. */
export function HighrableV2SectionLabel({
  children,
  className,
  ...props
}: IHighrableV2SectionLabelProps) {
  return (
    <div className={cn("inline-flex items-center gap-2", className)} {...props}>
      <HighrableV2Bullet aria-hidden="true" />
      <span className="hr-text-accent font-mono text-[0.7rem] font-medium tracking-widest uppercase">
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

export function HighrableV2Metric({
  label,
  value,
  description,
  className,
  ...props
}: IHighrableV2MetricProps) {
  return (
    <div className={cn("border-l border-border pl-4", className)} {...props}>
      <p className="hr-label-caps hr-text-muted">{label}</p>
      <div className="hr-text-primary mt-1 text-2xl leading-none font-semibold">{value}</div>
      {description ? (
        <p className="hr-text-secondary mt-2 text-xs leading-relaxed">{description}</p>
      ) : null}
    </div>
  );
}

/**
 * Inline info icon that reveals a tooltip on hover.
 * Replaces the previous click-to-open Popover pattern.
 * The trigger is a non-interactive `<span>` so it doesn't
 * accidentally submit forms or steal focus from neighbouring controls.
 */
export function HighrableV2IconNotice({
  label,
  message,
  tone = "neutral",
  className,
  ...props
}: IHighrableV2IconNoticeProps) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          {/* span instead of button — purely presentational, no click action */}
          <span
            role="img"
            aria-label={label}
            className={cn(
              "inline-flex h-5 w-5 shrink-0 cursor-default select-none items-center justify-center rounded-md border transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden",
              ICON_NOTICE_CLASSES[tone],
              className,
            )}
            {...props}
          >
            <Info className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          sideOffset={6}
          tone={NOTICE_TO_TOOLTIP_TONE[tone]}
          className="max-w-xs text-sm leading-relaxed"
        >
          {message}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export { HighrableV2SectionLabel as SectionLabel };

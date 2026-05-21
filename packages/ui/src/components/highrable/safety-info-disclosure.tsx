"use client";

import { ShieldAlert } from "lucide-react";
import * as React from "react";

import type { ReactNode } from "react";

import { cn } from "../../lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";

/**
 * Interface for SafetyInfoDisclosure props.
 * Prefixed with 'I' as per coding preferences.
 */
export interface ISafetyInfoDisclosureProps {
  /** The content (warnings, notices, or info) to be revealed on click. */
  readonly children: ReactNode;
  /** Optional container class names for the trigger button. */
  readonly className?: string;
  /** Custom icon for the disclosure trigger. Defaults to ShieldAlert. */
  readonly icon?: ReactNode;
  /** Accessibility label for the disclosure button. */
  readonly label?: string;
  /** Visual tone for the trigger button. */
  readonly tone?: "warning" | "info" | "neutral";
}

/**
 * A production-grade disclosure component that minimizes UI clutter by hiding
 * multiple warnings or informational notices behind a contextually relevant icon.
 *
 * This component follows the Single Responsibility Principle by focusing solely on
 * the toggle and display mechanism for supplementary information.
 */
export function SafetyInfoDisclosure({
  children,
  className,
  icon,
  label = "View safety and security information",
  tone = "warning",
}: ISafetyInfoDisclosureProps) {
  // Use React.Children.toArray to filter out null/undefined/false children accurately
  const validChildren = React.Children.toArray(children).filter(Boolean);

  // Do not render anything if there are no active notices
  if (validChildren.length === 0) {
    return null;
  }

  const toneClasses = {
    warning:
      "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 focus-visible:ring-amber-500",
    info: "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 focus-visible:ring-blue-500",
    neutral:
      "border-border bg-background text-muted-foreground hover:bg-accent focus-visible:ring-ring",
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex h-8 w-8 items-center justify-center rounded-none border transition-all focus-visible:ring-2 focus-visible:outline-hidden",
            toneClasses[tone],
            className,
          )}
          aria-label={label}
        >
          {icon ?? <ShieldAlert className="h-4 w-4" aria-hidden="true" />}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[380px] max-w-[90vw] p-0 shadow-xl border-amber-100"
        side="bottom"
        align="end"
        sideOffset={8}
      >
        <div className="flex flex-col">
          <header className="border-b border-amber-100 bg-amber-50/50 px-4 py-2.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-amber-900/70">
              Safety & Security Notices ({validChildren.length})
            </h3>
          </header>
          <div className="max-h-[60vh] overflow-y-auto p-4">
            <div className="grid gap-3">
              {validChildren.map((child, index) => (
                <div
                  key={`notice-${index}`}
                  className="animate-in fade-in slide-in-from-top-1 duration-200"
                >
                  {child}
                </div>
              ))}
            </div>
          </div>
          <footer className="border-t border-[#f0f0f0] bg-[#fafafa] px-4 py-2 text-[10px] text-[#8f8f8f]">
            These notices are provided for your protection on the Stellar network.
          </footer>
        </div>
      </PopoverContent>
    </Popover>
  );
}

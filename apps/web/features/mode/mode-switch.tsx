"use client";

import { cn } from "@repo/ui/lib/utils";
import React from "react";

import { MODE_COPY, type TAppMode } from "./mode-config";
import { useAppMode } from "./mode-provider";

const MODES: readonly TAppMode[] = ["freelancer", "client"];

interface IModeSwitchProps {
  readonly className?: string;
  /** "compact" is used in the header; "large" is used in banners and gates. */
  readonly size?: "compact" | "large";
  /** Stretches the switch across its container, with each option sharing the space equally. */
  readonly fullWidth?: boolean;
  /** Called after the mode changes, with the new mode. */
  readonly onChange?: (mode: TAppMode) => void;
}

/** Two-option switch: orange for Freelancer, yellow for Client. */
export function ModeSwitch({
  className,
  size = "compact",
  fullWidth = false,
  onChange,
}: IModeSwitchProps) {
  const { mode, setMode } = useAppMode();

  return (
    <div
      role="radiogroup"
      aria-label="Choose how you are using Highrable"
      className={cn(
        "items-center gap-1 rounded-lg border border-border bg-muted p-1",
        fullWidth ? "flex w-full" : "inline-flex",
        className,
      )}
    >
      {MODES.map((value) => {
        const copy = MODE_COPY[value];
        const Icon = copy.icon;
        const isSelected = mode === value;

        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => {
              setMode(value);
              onChange?.(value);
            }}
            data-mode-option={value}
            className={cn(
              "inline-flex items-center justify-center gap-1.5 rounded-md font-sans whitespace-nowrap transition-colors",
              size === "large" ? "px-4 py-2 text-sm" : "px-3 py-1 text-xs",
              fullWidth && "flex-1",
              isSelected
                ? value === "client"
                  ? "bg-[#facc15] font-medium text-[#3b2f00]"
                  : "bg-[#ff7003] font-medium text-white"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            {copy.shortLabel}
          </button>
        );
      })}
    </div>
  );
}

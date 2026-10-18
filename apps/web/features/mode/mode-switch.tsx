"use client";

import { cn } from "@repo/ui/lib/utils";

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
        "items-center gap-1 rounded-full border border-border bg-muted p-1",
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
              "inline-flex items-center justify-center gap-1.5 rounded-full font-mono tracking-[0.06em] whitespace-nowrap uppercase transition-colors",
              size === "large" ? "px-5 py-2.5 text-xs" : "px-3 py-1.5 text-[11px]",
              fullWidth && "flex-1 py-3.5 text-sm sm:py-4",
              isSelected
                ? value === "client"
                  ? "bg-[#facc15] text-[#3b2f00] shadow-sm"
                  : "bg-[#ff7003] text-white shadow-sm"
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

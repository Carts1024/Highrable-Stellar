"use client";

import type { TDashboardMode } from "@/features/dashboard/types";

interface IDashboardModeSwitchProps {
  readonly selectedMode: TDashboardMode;
  readonly onModeChange: (mode: TDashboardMode) => void;
}

const MODES: { value: TDashboardMode; label: string }[] = [
  { value: "freelancer", label: "Freelancer Mode" },
  { value: "client", label: "Client Mode" },
];

export function DashboardModeSwitch({ selectedMode, onModeChange }: IDashboardModeSwitchProps) {
  return (
    <div className="flex w-full items-center gap-1 rounded-lg border border-border bg-muted p-1 md:w-72">
      {MODES.map(({ value, label }) => (
        <button
          key={value}
          type="button"
          onClick={() => onModeChange(value)}
          className={`flex-1 rounded-md px-3 py-1.5 font-mono text-xs tracking-widest whitespace-nowrap uppercase transition-all duration-150 ${
            selectedMode === value
              ? "border border-highrable-orange-2 bg-highrable-orange-2 text-white shadow-sm"
              : "bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

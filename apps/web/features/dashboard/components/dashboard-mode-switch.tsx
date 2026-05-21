"use client";

import { Tabs, TabsList, TabsTrigger } from "@repo/ui/components/ui/tabs";

import type { TDashboardMode } from "@/features/dashboard/types";

interface IDashboardModeSwitchProps {
  readonly selectedMode: TDashboardMode;
  readonly onModeChange: (mode: TDashboardMode) => void;
}

export function DashboardModeSwitch({ selectedMode, onModeChange }: IDashboardModeSwitchProps) {
  return (
    <Tabs
      value={selectedMode}
      onValueChange={(value) => {
        if (value === "client" || value === "freelancer") {
          onModeChange(value);
        }
      }}
      className="w-full md:w-auto"
    >
      <TabsList className="grid w-full grid-cols-2 rounded-none border border-[#e8e8e8] bg-[#fafafa] p-1 md:w-72">
        <TabsTrigger
          value="freelancer"
          className="rounded-none font-mono text-xs tracking-[0.06em] text-[#5f5f5f] uppercase data-[state=active]:bg-[#0a0a0a] data-[state=active]:text-white"
        >
          Freelancer Mode
        </TabsTrigger>
        <TabsTrigger
          value="client"
          className="rounded-none font-mono text-xs tracking-[0.06em] text-[#5f5f5f] uppercase data-[state=active]:bg-[#0a0a0a] data-[state=active]:text-white"
        >
          Client Mode
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}

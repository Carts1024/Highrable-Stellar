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
      <TabsList className="hr-panel hr-surface-muted grid w-full grid-cols-2 p-1 md:w-72">
        <TabsTrigger
          value="freelancer"
          className="hr-label-caps hr-text-secondary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
        >
          Freelancer Mode
        </TabsTrigger>
        <TabsTrigger
          value="client"
          className="hr-label-caps hr-text-secondary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
        >
          Client Mode
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}

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
      <TabsList className="grid w-full grid-cols-2 md:w-65">
        <TabsTrigger value="freelancer">Freelancer Mode</TabsTrigger>
        <TabsTrigger value="client">Client Mode</TabsTrigger>
      </TabsList>
    </Tabs>
  );
}

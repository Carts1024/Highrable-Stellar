"use client";

import "./styles/globals.css";
import { Toaster } from "./components/ui-customs/sonner";
import { TooltipProvider } from "./components/ui/tooltip";
import { ThemeProvider } from "./theme-provider";

export default function UiProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <TooltipProvider>
        {children}
        <Toaster />
      </TooltipProvider>
    </ThemeProvider>
  );
}

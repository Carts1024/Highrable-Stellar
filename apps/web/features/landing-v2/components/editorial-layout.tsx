import type { ReactNode } from "react";

import { V2Reveal } from "./v2-animated-elements";

export const EDITORIAL_SECTION_CLASS =
  "relative flex min-h-[100svh] items-center overflow-hidden border-b border-border bg-background px-4 py-20 text-foreground sm:px-6 sm:py-24";

export const EDITORIAL_CONTAINER_CLASS = "mx-auto w-full max-w-6xl";

export function EditorialSectionLabel({ children }: { readonly children: ReactNode }) {
  return (
    <V2Reveal
      as="p"
      className="mb-5 font-mono text-[0.65rem] font-semibold tracking-[0.12em] text-highrable-text-accent uppercase"
    >
      {children}
    </V2Reveal>
  );
}

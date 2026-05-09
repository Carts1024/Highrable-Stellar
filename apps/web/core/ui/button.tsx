import { Button as BaseButton } from "@repo/ui/components/ui/button";
import { cn } from "@repo/ui/lib/utils";

import type { ComponentProps } from "react";

export type TAppButtonVariant = "primary" | "secondary" | "ghost" | "outline";

interface IAppButtonProps extends ComponentProps<typeof BaseButton> {
  appVariant?: TAppButtonVariant;
}

const APP_BUTTON_VARIANTS: Record<TAppButtonVariant, string> = {
  primary:
    "rounded-lg bg-linear-to-r from-[#FF8801] via-[#FF7003] to-[#E85D00] text-white hover:brightness-105",
  secondary:
    "rounded-lg border border-[#e8e8e8] bg-white text-[#0a0a0a] hover:border-[#FF7003] hover:text-[#FF7003]",
  ghost: "rounded-lg bg-transparent text-[#0a0a0a] hover:bg-[#f5f5f5]",
  outline:
    "rounded-lg border border-[#0a0a0a] bg-white text-[#0a0a0a] hover:bg-[#0a0a0a] hover:text-white",
};

export function AppButton({ appVariant = "primary", className, ...props }: IAppButtonProps) {
  return <BaseButton className={cn(APP_BUTTON_VARIANTS[appVariant], className)} {...props} />;
}

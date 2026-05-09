import { Input as BaseInput } from "@repo/ui/components/ui/input";
import { cn } from "@repo/ui/lib/utils";

import type { ComponentProps } from "react";

interface IAppInputProps extends ComponentProps<typeof BaseInput> {}

export function AppInput({ className, ...props }: IAppInputProps) {
  return (
    <BaseInput
      className={cn(
        "h-11 rounded-lg border-[#e8e8e8] bg-white text-[#0a0a0a] placeholder:text-[#7f7f7f] focus-visible:border-[#FF7003] focus-visible:ring-[#FF7003]/30",
        className,
      )}
      {...props}
    />
  );
}

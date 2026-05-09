import { Textarea as BaseTextarea } from "@repo/ui/components/ui/textarea";
import { cn } from "@repo/ui/lib/utils";

import type { ComponentProps } from "react";

interface IAppTextareaProps extends ComponentProps<typeof BaseTextarea> {}

export function AppTextarea({ className, ...props }: IAppTextareaProps) {
  return (
    <BaseTextarea
      className={cn(
        "rounded-lg border-[#e8e8e8] bg-white text-[#0a0a0a] placeholder:text-[#7f7f7f] focus-visible:border-[#FF7003] focus-visible:ring-[#FF7003]/30",
        className,
      )}
      {...props}
    />
  );
}

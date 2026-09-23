import { cn } from "@repo/ui/lib/utils";
import { Tooltip as TooltipPrimitive } from "radix-ui";
import * as React from "react";

type TTooltipTone = "default" | "neutral" | "warning" | "danger" | "success";

const TOOLTIP_TONE_CONTENT: Record<TTooltipTone, string> = {
  default: "bg-highrable-orange-1 text-background",
  neutral: "bg-popover text-popover-foreground border border-border shadow-sm",
  warning: "bg-amber-50 text-amber-800 border border-amber-200",
  danger: "bg-red-50 text-red-600 border border-red-200",
  success: "bg-emerald-50 text-emerald-700 border border-emerald-200",
};

const TOOLTIP_TONE_ARROW: Record<TTooltipTone, string> = {
  default: "bg-highrable-orange-1 fill-highrable-orange-1",
  neutral: "bg-border fill-border",
  warning: "bg-amber-200 fill-amber-200",
  danger: "bg-red-200 fill-red-200",
  success: "bg-emerald-200 fill-emerald-200",
};

function TooltipProvider({
  delayDuration = 0,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delayDuration={delayDuration}
      {...props}
    />
  );
}

function Tooltip({ ...props }: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  return <TooltipPrimitive.Root data-slot="tooltip" {...props} />;
}

function TooltipTrigger({ ...props }: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />;
}

function TooltipContent({
  className,
  sideOffset = 0,
  tone = "default",
  children,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content> & { tone?: TTooltipTone }) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        className={cn(
          "z-50 w-fit origin-(--radix-tooltip-content-transform-origin) animate-in rounded-md px-3 py-1.5 text-xs text-balance font-sans fade-in-0 zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
          TOOLTIP_TONE_CONTENT[tone],
          className,
        )}
        {...props}
      >
        {children}
        <TooltipPrimitive.Arrow
          className={cn(
            "z-50 size-2.5 translate-y-[calc(-50%-2px)] rotate-45 rounded-[2px]",
            TOOLTIP_TONE_ARROW[tone],
          )}
        />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  );
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
export type { TTooltipTone };

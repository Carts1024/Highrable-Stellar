import { Card, CardDescription, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import { cn } from "@repo/ui/lib/utils";
import React from "react";

import type { ComponentProps, ReactNode } from "react";

interface IRoutePanelProps extends ComponentProps<typeof Card> {}

interface IRoutePanelHeaderProps extends Omit<ComponentProps<typeof CardHeader>, "title"> {
  readonly title: ReactNode;
  readonly description?: ReactNode;
  readonly eyebrow?: ReactNode;
  readonly icon?: ReactNode;
  readonly action?: ReactNode;
}

type TRouteCalloutTone = "neutral" | "warning" | "danger" | "success";

interface IRouteCalloutProps extends ComponentProps<"div"> {
  readonly tone?: TRouteCalloutTone;
  readonly icon?: ReactNode;
}

interface IRouteEmptyStateProps extends Omit<ComponentProps<"div">, "title"> {
  readonly title?: ReactNode;
  readonly description: ReactNode;
  readonly icon?: ReactNode;
  readonly action?: ReactNode;
}

const ROUTE_CALLOUT_CLASSES: Record<TRouteCalloutTone, string> = {
  neutral: "border-border hr-text-secondary",
  warning: "border-amber-400 bg-amber-50/60 text-amber-900",
  danger: "border-red-500 bg-red-50/60 text-red-800",
  success: "border-emerald-500 bg-emerald-50/60 text-emerald-900",
};

export function RoutePanel({ className, ...props }: IRoutePanelProps) {
  return (
    <Card className={cn("hr-panel gap-0 rounded-lg py-0 shadow-none", className)} {...props} />
  );
}

export function RoutePanelHeader({
  title,
  description,
  eyebrow,
  icon,
  action,
  className,
  ...props
}: IRoutePanelHeaderProps) {
  return (
    <CardHeader
      className={cn("gap-3 border-b px-5 pt-4 pb-4 [.border-b]:pb-4", className)}
      {...props}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          {eyebrow ? <p className="hr-text-muted font-mono text-xs">{eyebrow}</p> : null}
          <CardTitle className="hr-text-primary flex items-center gap-2 text-base leading-tight font-semibold">
            {icon ? (
              <span className="hr-text-muted shrink-0 [&_svg]:h-4 [&_svg]:w-4">{icon}</span>
            ) : null}
            {title}
          </CardTitle>
          {description ? (
            <CardDescription className="hr-text-secondary text-sm leading-relaxed">
              {description}
            </CardDescription>
          ) : null}
        </div>
        {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
      </div>
    </CardHeader>
  );
}

export function RouteCallout({
  tone = "neutral",
  icon,
  className,
  children,
  ...props
}: IRouteCalloutProps) {
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 border-l-2 py-2.5 pr-3 pl-3 text-sm leading-relaxed",
        ROUTE_CALLOUT_CLASSES[tone],
        className,
      )}
      {...props}
    >
      {icon ? <span className="mt-0.5 shrink-0">{icon}</span> : null}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export function RouteEmptyState({
  title,
  description,
  icon,
  action,
  className,
  ...props
}: IRouteEmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-start gap-1.5 rounded-lg border border-dashed border-border px-4 py-5 text-left",
        className,
      )}
      {...props}
    >
      <div className="flex items-start gap-2.5">
        {icon ? (
          <span className="hr-text-muted mt-0.5 shrink-0 [&_svg]:h-4 [&_svg]:w-4">{icon}</span>
        ) : null}
        <div className="min-w-0 space-y-0.5">
          {title ? <p className="hr-text-primary font-sans text-sm font-medium">{title}</p> : null}
          <p className="hr-text-secondary max-w-xl font-sans text-sm leading-relaxed">
            {description}
          </p>
        </div>
      </div>
      {action ? <div className={icon ? "pt-1.5 pl-6.5" : "pt-1.5"}>{action}</div> : null}
    </div>
  );
}

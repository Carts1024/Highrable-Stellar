import { Card, CardDescription, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import { cn } from "@repo/ui/lib/utils";

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
  neutral: "border-border bg-muted/40 hr-text-secondary",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  danger: "border-red-200 bg-red-50 text-red-700",
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

export function RoutePanel({ className, ...props }: IRoutePanelProps) {
  return <Card className={cn("hr-panel gap-4 py-0 shadow-none", className)} {...props} />;
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
    <CardHeader className={cn("gap-4 border-b pb-5", className)} {...props}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-2">
          {eyebrow ? <p className="hr-label-caps hr-text-muted">{eyebrow}</p> : null}
          <div className="flex items-start gap-3">
            {icon ? (
              <span className="hr-v2-badge-accent flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
                {icon}
              </span>
            ) : null}
            <div className="min-w-0 space-y-1.5">
              <CardTitle className="hr-text-primary text-xl leading-tight font-semibold">
                {title}
              </CardTitle>
              {description ? (
                <CardDescription className="hr-text-secondary text-sm leading-relaxed">
                  {description}
                </CardDescription>
              ) : null}
            </div>
          </div>
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
        "flex items-start gap-3 rounded-xl border px-4 py-3 text-sm",
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
        "hr-surface-muted flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-6 py-10 text-center",
        className,
      )}
      {...props}
    >
      {icon ? (
        <span className="hr-text-muted flex items-center justify-center rounded-full border border-border bg-background p-3">
          {icon}
        </span>
      ) : null}
      {title ? <p className="hr-text-primary font-sans text-sm font-semibold">{title}</p> : null}
      <p className="hr-text-secondary max-w-xl font-sans text-sm leading-relaxed">{description}</p>
      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  );
}

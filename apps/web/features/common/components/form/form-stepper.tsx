"use client";

import { Button as AppButton } from "@repo/ui/components/ui/button";
import { cn } from "@repo/ui/lib/utils";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { useId } from "react";

import type { ReactNode } from "react";

export interface IFormStep {
  readonly id: string;
  /** Short tab title ("Details"). */
  readonly title: string;
  /** One plain-language sentence that says what this step is for. */
  readonly hint: string;
  /** Marks the step as needing attention (for example after a failed submit). */
  readonly hasError?: boolean;
}

interface IFormStepTabsProps {
  readonly steps: readonly IFormStep[];
  readonly activeIndex: number;
  readonly onSelect: (index: number) => void;
  readonly idPrefix?: string;
  readonly className?: string;
}

/** Numbered tab strip that doubles as a progress indicator. Steps stay clickable. */
export function FormStepTabs({
  steps,
  activeIndex,
  onSelect,
  idPrefix,
  className,
}: IFormStepTabsProps) {
  const generatedId = useId();
  const prefix = idPrefix ?? generatedId;
  const active = steps[activeIndex];

  return (
    <div className={cn("space-y-3", className)}>
      <p className="text-xs text-muted-foreground">
        Step {activeIndex + 1} of {steps.length}
      </p>

      <div
        role="tablist"
        aria-label="Form steps"
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}
      >
        {steps.map((step, index) => {
          const isActive = index === activeIndex;
          const isDone = index < activeIndex && !step.hasError;

          return (
            <button
              key={step.id}
              type="button"
              role="tab"
              id={`${prefix}-tab-${step.id}`}
              aria-selected={isActive}
              aria-controls={`${prefix}-panel-${step.id}`}
              onClick={() => onSelect(index)}
              className={cn(
                "flex min-w-0 items-center gap-2 rounded-md border px-2 py-2 text-left transition-colors sm:px-3",
                isActive
                  ? "border-(--mode-solid) text-foreground"
                  : "border-border bg-card text-muted-foreground hover:text-foreground",
                step.hasError ? "border-red-300 bg-red-50 text-red-700" : "",
              )}
            >
              <span
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-medium",
                  step.hasError
                    ? "bg-red-600 text-white"
                    : isActive || isDone
                      ? "bg-(--mode-solid) text-(--mode-on)"
                      : "bg-muted text-muted-foreground",
                )}
              >
                {isDone ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : index + 1}
              </span>
              <span className="hidden min-w-0 truncate font-sans text-sm font-medium sm:block">
                {step.title}
              </span>
              <span className="sr-only sm:hidden">{step.title}</span>
            </button>
          );
        })}
      </div>

      {active ? (
        <div>
          <p className="hr-text-primary font-sans text-base font-semibold">{active.title}</p>
          <p className="hr-text-secondary mt-0.5 font-sans text-sm">{active.hint}</p>
        </div>
      ) : null}
    </div>
  );
}

interface IFormStepPanelProps {
  readonly stepId: string;
  readonly isActive: boolean;
  readonly idPrefix: string;
  readonly children: ReactNode;
  readonly className?: string;
}

/**
 * One tab's content. Inactive panels stay mounted (just hidden) so typed values, uploads and
 * validation state survive moving between steps.
 */
export function FormStepPanel({
  stepId,
  isActive,
  idPrefix,
  children,
  className,
}: IFormStepPanelProps) {
  return (
    <div
      role="tabpanel"
      id={`${idPrefix}-panel-${stepId}`}
      aria-labelledby={`${idPrefix}-tab-${stepId}`}
      hidden={!isActive}
      className={cn("space-y-8", className)}
    >
      {children}
    </div>
  );
}

interface IFormStepNavProps {
  readonly activeIndex: number;
  readonly stepCount: number;
  readonly onBack: () => void;
  readonly onNext: () => void;
  /** Rendered in place of the Next button on the last step (usually the submit button). */
  readonly finalAction?: ReactNode;
  readonly nextLabel?: string;
  readonly nextDisabled?: boolean;
  readonly className?: string;
}

/** Back / Next buttons shared by every stepped form. */
export function FormStepNav({
  activeIndex,
  stepCount,
  onBack,
  onNext,
  finalAction,
  nextLabel = "Next step",
  nextDisabled,
  className,
}: IFormStepNavProps) {
  const isLast = activeIndex === stepCount - 1;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 border-t border-border pt-6",
        className,
      )}
    >
      <AppButton
        type="button"
        variant="outline"
        onClick={onBack}
        disabled={activeIndex === 0}
        className="gap-2 rounded-md px-4"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back
      </AppButton>
      {isLast ? (
        finalAction
      ) : (
        <AppButton
          type="button"
          onClick={onNext}
          disabled={nextDisabled}
          className="hr-v2-button-primary gap-2 rounded-md px-4"
        >
          {nextLabel}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </AppButton>
      )}
    </div>
  );
}

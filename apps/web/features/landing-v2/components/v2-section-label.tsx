import { cn } from "@repo/ui/lib/utils";

interface ISectionLabelProps {
  readonly children: string;
  readonly className?: string;
}

/** Square-dot prefixed, monospaced uppercase label for section headers. */
export function SectionLabel({ children, className }: ISectionLabelProps) {
  return (
    <div className={cn("inline-flex items-center gap-2", className)}>
      <span
        className="hr-text-accent inline-block h-1 w-1 shrink-0 bg-current"
        aria-hidden="true"
      />
      <span className="hr-text-accent font-mono text-[0.7rem] font-medium tracking-[0.08em] uppercase">
        {children}
      </span>
    </div>
  );
}

import { cn } from "../../lib/utils";

interface IRichTextContentProps {
  html: string | undefined;
  fallbackText?: string | undefined;
  emptyLabel?: string;
  className?: string;
}

export function RichTextContent({
  html,
  fallbackText,
  emptyLabel = "No description provided.",
  className,
}: IRichTextContentProps) {
  if (html?.trim()) {
    return (
      <div
        className={cn(
          "issue-rich-text min-w-0 max-w-full text-sm leading-6 text-foreground",
          className,
        )}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }

  if (fallbackText?.trim()) {
    return (
      <p
        className={cn(
          "min-w-0 max-w-full whitespace-pre-wrap wrap-break-word text-sm leading-6 text-foreground",
          className,
        )}
      >
        {fallbackText}
      </p>
    );
  }

  return <p className={cn("text-sm text-[#9ca3af]", className)}>{emptyLabel}</p>;
}

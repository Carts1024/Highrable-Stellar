"use client";

import * as React from "react";

import { useMediaQuery } from "../../hooks/use-media-query";
import { cn } from "../../lib/utils";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "../ui/drawer";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./dialog";

/**
 * Responsive Dialog/Drawer component that automatically switches between
 * Dialog (desktop, ≥768px) and Drawer (mobile, <768px).
 *
 * Features:
 * - Automatic layout switching based on screen size
 * - Optimized scrolling for both dialog and drawer modes
 * - Consistent API across both implementations
 * - Proper mobile touch interactions
 */

interface ResponsiveDialogProps {
  readonly open?: boolean;
  readonly onOpenChange?: (open: boolean) => void;
  readonly children: React.ReactNode;
  readonly breakpoint?: string; // Default: "(min-width: 768px)"
}

interface ResponsiveDialogTriggerProps extends React.ComponentPropsWithoutRef<
  typeof DialogTrigger
> {
  readonly asChild?: boolean;
}

interface ResponsiveDialogContentProps {
  readonly className?: string;
  readonly children: React.ReactNode;
}

interface ResponsiveDialogHeaderProps extends React.ComponentPropsWithoutRef<typeof DialogHeader> {
  readonly className?: string;
}

interface ResponsiveDialogTitleProps extends React.ComponentPropsWithoutRef<typeof DialogTitle> {
  readonly className?: string;
}

interface ResponsiveDialogDescriptionProps extends React.ComponentPropsWithoutRef<
  typeof DialogDescription
> {
  readonly className?: string;
}

interface ResponsiveDialogFooterProps extends React.ComponentPropsWithoutRef<typeof DialogFooter> {
  readonly className?: string;
}

interface ResponsiveDialogBodyProps {
  readonly className?: string;
  readonly children: React.ReactNode;
}

/**
 * Root component - wraps both Dialog and Drawer
 */
const ResponsiveDialog = React.forwardRef<HTMLDivElement, ResponsiveDialogProps>(
  ({ open, onOpenChange, children, breakpoint = "(min-width: 768px)" }, _ref) => {
    const isDesktop = useMediaQuery(breakpoint);
    const [internalOpen, setInternalOpen] = React.useState(false);

    const controlledOpen = open !== undefined ? open : internalOpen;
    const handleOpenChange = onOpenChange
      ? (newOpen: boolean) => onOpenChange(newOpen)
      : setInternalOpen;

    if (isDesktop) {
      return (
        <Dialog open={controlledOpen} onOpenChange={handleOpenChange}>
          {children}
        </Dialog>
      );
    }

    return (
      <Drawer open={controlledOpen} onOpenChange={handleOpenChange}>
        {children}
      </Drawer>
    );
  },
);
ResponsiveDialog.displayName = "ResponsiveDialog";

/**
 * Trigger component - renders DialogTrigger or DrawerTrigger
 */
const ResponsiveDialogTrigger = React.forwardRef<HTMLButtonElement, ResponsiveDialogTriggerProps>(
  ({ asChild, ...props }, ref) => {
    const isDesktop = useMediaQuery("(min-width: 768px)");

    if (isDesktop) {
      return <DialogTrigger ref={ref} asChild={asChild} {...props} />;
    }

    return <DrawerTrigger ref={ref} asChild={asChild} {...props} />;
  },
);
ResponsiveDialogTrigger.displayName = "ResponsiveDialogTrigger";

/**
 * Content wrapper - handles dialog/drawer content with proper scrolling
 */
const ResponsiveDialogContent = React.forwardRef<HTMLDivElement, ResponsiveDialogContentProps>(
  ({ className, children }, ref) => {
    const isDesktop = useMediaQuery("(min-width: 768px)");

    if (isDesktop) {
      return (
        <DialogContent
          ref={ref}
          className={cn(
            "max-h-[min(90vh,calc(100vh-4rem))] w-[calc(100vw-2rem)] flex flex-col",
            className,
          )}
        >
          {children}
        </DialogContent>
      );
    }

    return (
      <DrawerContent ref={ref} className={cn("max-h-[90dvh] flex flex-col", className)}>
        {children}
      </DrawerContent>
    );
  },
);
ResponsiveDialogContent.displayName = "ResponsiveDialogContent";

/**
 * Header component
 */
const ResponsiveDialogHeader = ({ className, ...props }: ResponsiveDialogHeaderProps) => {
  const isDesktop = useMediaQuery("(min-width: 768px)");

  if (isDesktop) {
    return (
      <DialogHeader
        className={cn("border-b border-border px-5 py-4 sm:px-6", className)}
        {...props}
      />
    );
  }

  return <DrawerHeader className={cn("border-b border-border text-left", className)} {...props} />;
};
ResponsiveDialogHeader.displayName = "ResponsiveDialogHeader";

/**
 * Title component
 */
const ResponsiveDialogTitle = React.forwardRef<HTMLHeadingElement, ResponsiveDialogTitleProps>(
  ({ className, ...props }, ref) => {
    const isDesktop = useMediaQuery("(min-width: 768px)");

    if (isDesktop) {
      return (
        <DialogTitle
          ref={ref}
          className={cn("text-xl font-bold font-sans leading-none tracking-tight", className)}
          {...props}
        />
      );
    }

    return (
      <DrawerTitle
        ref={ref}
        className={cn("text-lg font-bold font-sans leading-none tracking-tight", className)}
        {...props}
      />
    );
  },
);
ResponsiveDialogTitle.displayName = "ResponsiveDialogTitle";

/**
 * Description component
 */
const ResponsiveDialogDescription = React.forwardRef<
  HTMLParagraphElement,
  ResponsiveDialogDescriptionProps
>(({ className, ...props }, ref) => {
  const isDesktop = useMediaQuery("(min-width: 768px)");

  if (isDesktop) {
    return (
      <DialogDescription
        ref={ref}
        className={cn("text-sm font-sans text-muted-foreground", className)}
        {...props}
      />
    );
  }

  return (
    <DrawerDescription
      ref={ref}
      className={cn("text-sm font-sans text-muted-foreground", className)}
      {...props}
    />
  );
});
ResponsiveDialogDescription.displayName = "ResponsiveDialogDescription";

/**
 * Body component - scrollable content area
 */
const ResponsiveDialogBody = React.forwardRef<HTMLDivElement, ResponsiveDialogBodyProps>(
  ({ className, children }, ref) => {
    const isDesktop = useMediaQuery("(min-width: 768px)");

    if (isDesktop) {
      return (
        <div
          ref={ref}
          className={cn(
            "max-h-[min(90vh,42rem)] overflow-x-hidden overflow-y-auto overscroll-contain p-5 sm:p-6",
            className,
          )}
        >
          {children}
        </div>
      );
    }

    return (
      <div
        ref={ref}
        className={cn(
          "max-h-[calc(90dvh-8rem)] overflow-x-hidden overflow-y-auto overscroll-contain px-4 py-4",
          className,
        )}
      >
        {children}
      </div>
    );
  },
);
ResponsiveDialogBody.displayName = "ResponsiveDialogBody";

/**
 * Footer component
 */
const ResponsiveDialogFooter = ({ className, ...props }: ResponsiveDialogFooterProps) => {
  const isDesktop = useMediaQuery("(min-width: 768px)");

  if (isDesktop) {
    return (
      <DialogFooter
        className={cn("border-t border-[#e8e8e8] px-5 py-4 sm:px-6", className)}
        {...props}
      />
    );
  }

  return <DrawerFooter className={cn("border-t border-[#e8e8e8] pt-2", className)} {...props} />;
};
ResponsiveDialogFooter.displayName = "ResponsiveDialogFooter";

/**
 * Close button component
 */
const ResponsiveDialogClose = React.forwardRef<
  HTMLButtonElement,
  React.ComponentPropsWithoutRef<typeof DialogClose>
>((props, ref) => {
  const isDesktop = useMediaQuery("(min-width: 768px)");

  if (isDesktop) {
    return <DialogClose ref={ref} {...props} style={{ color: "var(--foreground)" }} />;
  }

  return <DrawerClose ref={ref} {...props} style={{ color: "var(--foreground)" }} />;
});
ResponsiveDialogClose.displayName = "ResponsiveDialogClose";

export {
  ResponsiveDialog,
  ResponsiveDialogBody,
  ResponsiveDialogClose,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogTrigger,
};

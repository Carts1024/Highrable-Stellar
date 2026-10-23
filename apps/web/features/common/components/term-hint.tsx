"use client";

import { cn } from "@repo/ui/lib/utils";
import { HelpCircle } from "lucide-react";
import { useId, useState } from "react";

import type { ReactNode } from "react";

/** Plain-language explanations for words people often do not know. */
export const PLAIN_TERMS = {
  escrow:
    "A safe holding place for the payment. The client puts the money in first, and it is only released to the freelancer when the work is approved.",
  wallet:
    "Your account for sending and receiving money on the Stellar network. You sign in with it instead of a password.",
  passkey: "A way to sign in using your fingerprint, face or device PIN instead of a password.",
  stellar: "The payment network Highrable uses to move money quickly and cheaply.",
  stablecoin:
    "A digital dollar. Its value stays close to one US dollar, so the job price does not jump around.",
  xlm: "The native coin of the Stellar network. Its price can go up and down.",
  testnet:
    "A practice version of the network that uses play money. Nothing you do here costs real money.",
  onchain: "Recorded on the Stellar network, where it cannot be secretly changed.",
  transaction: "A payment or action that has been sent to the Stellar network.",
  milestone: "One part of a bigger job. Each milestone has its own goal, deadline and payment.",
  dispute:
    "A request for a Highrable reviewer to look at a problem between a client and a freelancer.",
  basisPoints: "A way to split money in percentages: 100 points = 1%, 10,000 points = 100%.",
  proof: "A public record showing that the payment was held and released.",
  reputation: "A history of completed jobs that anyone can check.",
} as const;

export type TPlainTerm = keyof typeof PLAIN_TERMS;

interface ITermHintProps {
  readonly term: TPlainTerm;
  /** The words to show. Defaults to the children you pass. */
  readonly children: ReactNode;
  readonly className?: string;
}

/**
 * Wraps a technical word with a small "?" that explains it in everyday language.
 * Works on hover, keyboard focus and tap.
 */
export function TermHint({ term, children, className }: ITermHintProps) {
  const id = useId();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <span className={cn("relative inline-flex items-center gap-1", className)}>
      <span className="underline decoration-dotted underline-offset-4">{children}</span>
      <button
        type="button"
        aria-label={`What does this mean? ${PLAIN_TERMS[term]}`}
        aria-describedby={isOpen ? id : undefined}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((value) => !value)}
        onBlur={() => setIsOpen(false)}
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
        className="hr-mode-text inline-flex h-4 w-4 items-center justify-center rounded-full align-middle"
      >
        <HelpCircle className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      {isOpen ? (
        <span
          id={id}
          role="tooltip"
          className="absolute top-full left-0 z-40 mt-2 w-64 rounded-lg border border-border bg-card p-3 text-left font-sans text-xs leading-relaxed font-normal tracking-normal text-foreground normal-case"
        >
          {PLAIN_TERMS[term]}
        </span>
      ) : null}
    </span>
  );
}

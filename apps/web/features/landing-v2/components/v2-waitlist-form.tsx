"use client";

import { api } from "@repo/convex-client";
import { V2_BUTTON_PRIMARY_CLASS } from "@repo/ui/components/highrable/v2-theme";
import { useMutation } from "convex/react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Check, Loader2, Mail } from "lucide-react";
import { useState } from "react";

import type { FormEvent } from "react";

type TWaitlistFormStatus = "idle" | "submitting" | "success" | "error";

type TConvexErrorData = {
  readonly message?: string;
};

type TConvexLikeError = {
  readonly data?: TConvexErrorData;
  readonly message?: string;
};

function readWaitlistErrorMessage(error: unknown): string {
  const fallbackMessage = "Unable to join the waitlist right now. Please try again.";

  if (!(error instanceof Error)) {
    return fallbackMessage;
  }

  const convexError = error as TConvexLikeError;
  const dataMessage = convexError.data?.message?.trim();

  if (dataMessage) {
    return dataMessage;
  }

  const message = convexError.message?.trim();

  if (!message) {
    return fallbackMessage;
  }

  return message.length > 160 ? fallbackMessage : message;
}

export function V2WaitlistForm({ id = "waitlist-input" }: { id?: string }) {
  const joinWaitlist = useMutation(api.waitlist.joinWaitlist);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<TWaitlistFormStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [copied, setCopied] = useState(false);

  const validateEmail = (val: string) => {
    const trimmed = val.trim();
    if (!trimmed) return "Email is required";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return "Please enter a valid email address";
    return "";
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage("");

    const err = validateEmail(email);
    if (err) {
      setErrorMessage(err);
      setStatus("error");
      return;
    }

    setStatus("submitting");
    try {
      await joinWaitlist({ email });
      setStatus("success");
    } catch (error) {
      setErrorMessage(readWaitlistErrorMessage(error));
      setStatus("error");
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText("https://highrable.work");
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
    "I just joined the @highrable waitlist — the next-gen freelance marketplace secured by Stellar smart contracts. Join here: https://highrable.work",
  )}`;

  return (
    <div className="mx-auto w-full max-w-md lg:mx-0">
      <AnimatePresence mode="wait">
        {status !== "success" ? (
          <motion.form
            key="form"
            onSubmit={handleSubmit}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
            noValidate
            className="space-y-3"
          >
            {/* INPUT + BUTTON WRAPPER */}
            <div className={`
                flex w-full flex-col gap-2 rounded-xl
                border bg-white/60
                p-1.5 backdrop-blur-sm transition-all duration-200 sm:flex-row
                sm:items-center sm:gap-0 dark:bg-neutral-900/60
                ${status === "error" ? "border-red-400 shadow-[0_0_0_3px_rgba(248,113,113,0.12)]" : "border-neutral-200 focus-within:border-orange-500 focus-within:shadow-[0_0_0_3px_rgba(255,112,3,0.12)] dark:border-neutral-800"}
              `}>
              {/* INPUT */}
              <div className="flex flex-1 items-center">
                <Mail className="ml-3 h-4 w-4 shrink-0 text-neutral-400 dark:text-neutral-500" />
                <input
                  id={id}
                  aria-label="Email address"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (status === "error") setStatus("idle");
                  }}
                  disabled={status === "submitting"}
                  className="
                    w-full flex-1 bg-transparent px-3 py-2.5
                    text-sm text-neutral-900
                    placeholder-neutral-400
                    focus:outline-none dark:text-neutral-100
                    dark:placeholder-neutral-600
                  "
                />
              </div>

              {/* BUTTON */}
              <button type="submit" disabled={status === "submitting"} className={`
                  ${V2_BUTTON_PRIMARY_CLASS}
                  flex w-full shrink-0 items-center justify-center gap-2 rounded-xl
                  px-5 py-2.5 text-sm font-semibold disabled:opacity-70
                  sm:w-auto
                `}>
                {status === "submitting" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <span>Join Waitlist</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </>
                )}
              </button>
            </div>

            {/* ERROR */}
            <AnimatePresence>
              {status === "error" && errorMessage && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="pl-1 text-xs font-medium text-red-500"
                >
                  {errorMessage}
                </motion.p>
              )}
            </AnimatePresence>
          </motion.form>
        ) : (
          /* SUCCESS STATE */
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.94 }}
            transition={{ type: "spring", stiffness: 140, damping: 18 }}
            className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 backdrop-blur-md dark:bg-emerald-950/20"
          >
            {/* HEADER */}
            <div className="mb-3 flex flex-col items-center gap-2 text-center sm:flex-row sm:items-start sm:gap-3 sm:text-left">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{
                  type: "spring",
                  stiffness: 220,
                  damping: 14,
                  delay: 0.1,
                }}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-500 sm:mt-0.5"
              >
                <Check className="h-4 w-4" strokeWidth={2.5} />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
              >
                <p className="text-sm font-bold text-neutral-900 dark:text-neutral-50">
                  You're in!
                </p>
                <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
                  Check your inbox for confirmation. Spread the word!
                </p>
              </motion.div>
            </div>

            {/* BUTTONS */}
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="flex flex-col gap-2 sm:flex-row"
            >
              <a
                href={twitterUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#1d9bf0] py-2 text-xs font-bold text-white hover:bg-[#1a8cd8]"
              >
                Share on X
              </a>

              <button
                onClick={handleCopy}
                className="flex flex-1 items-center justify-center rounded-lg border border-neutral-200 bg-white py-2 text-xs font-bold text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800"
              >
                {copied ? "Copied ✓" : "Copy Link"}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

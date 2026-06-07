"use client";

import { V2_BUTTON_PRIMARY_CLASS } from "@repo/ui/components/highrable/v2-theme";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Check, Loader2, Mail } from "lucide-react";
import { useState } from "react";

export function V2WaitlistForm({ id = "waitlist-input" }: { id?: string }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [copied, setCopied] = useState(false);

  const validateEmail = (val: string) => {
    const trimmed = val.trim();
    if (!trimmed) return "Email is required";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return "Please enter a valid email address";
    return "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    const err = validateEmail(email);
    if (err) {
      setErrorMessage(err);
      setStatus("error");
      return;
    }
    setStatus("submitting");
    await new Promise((r) => setTimeout(r, 1000));
    setStatus("success");
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText("https://highrable.work");
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* fallback */
    }
  };

  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
    "I just joined the @highrable waitlist — the next-gen freelance marketplace secured by Stellar smart contracts. Join here: https://highrable.work",
  )}`;

  return (
    <div className="w-full max-w-md">
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
            {/* Unified pill input + button */}
            <div
              className={`relative flex w-full items-center rounded-xl border bg-white/60 p-1.5 backdrop-blur-sm transition-all duration-200 dark:bg-neutral-900/60 ${
                status === "error"
                  ? "border-red-400 shadow-[0_0_0_3px_rgba(248,113,113,0.12)]"
                  : "border-neutral-200 focus-within:border-orange-500 focus-within:shadow-[0_0_0_3px_rgba(255,112,3,0.12)] dark:border-neutral-800"
              }`}
            >
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
                className="flex-1 bg-transparent px-3 py-2.5 text-sm text-neutral-900 placeholder-neutral-400 focus:outline-none dark:text-neutral-100 dark:placeholder-neutral-600"
              />
              <button
                type="submit"
                disabled={status === "submitting"}
                className={`${V2_BUTTON_PRIMARY_CLASS} flex shrink-0 cursor-pointer items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold disabled:opacity-70`}
              >
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

            {/* Inline error */}
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
          /* Success State */
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.94 }}
            transition={{ type: "spring", stiffness: 140, damping: 18 }}
            className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 backdrop-blur-md dark:bg-emerald-950/20"
          >
            {/* Top row: icon + text side by side */}
            <div className="mb-3 flex items-start gap-3">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 220, damping: 14, delay: 0.1 }}
                className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
              >
                <Check className="h-4 w-4" strokeWidth={2.5} />
              </motion.div>
              <motion.div
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
              >
                <p className="text-sm leading-tight font-bold text-neutral-900 dark:text-neutral-50">
                  You're in!
                </p>
                <p className="mt-0.5 text-xs leading-snug text-neutral-500 dark:text-neutral-400">
                  We'll reach out when access opens. Spread the word!
                </p>
              </motion.div>
            </div>

            {/* Share buttons */}
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="flex gap-2"
            >
              <a
                href={twitterUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#1d9bf0] py-2 text-xs font-bold text-white transition-colors hover:bg-[#1a8cd8]"
              >
                Share on X
              </a>
              <button
                onClick={handleCopy}
                className="flex-1 cursor-pointer rounded-lg border border-neutral-200 bg-white py-2 text-xs font-bold text-neutral-700 transition-colors hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800"
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

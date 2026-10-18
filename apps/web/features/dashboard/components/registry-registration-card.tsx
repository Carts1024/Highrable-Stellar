"use client";

import { useRegistryRegistration } from "@/features/onboarding/hooks/use-registry-registration";
import { Button } from "@repo/ui/components/ui/button";

export function RegistryRegistrationCard() {
  const registration = useRegistryRegistration();

  if (registration.isLoading || registration.isVerified) {
    return null;
  }

  const hasRecoverableTransaction =
    registration.hasPendingTransaction || registration.transaction?.status === "success";

  return (
    <section
      aria-labelledby="registry-registration-title"
      className="space-y-3 rounded-xl border border-border/80 bg-card p-5 shadow-sm"
    >
      <div className="space-y-1">
        <h2 id="registry-registration-title" className="font-sans text-lg font-semibold">
          Register Your Wallet on Stellar
        </h2>
        <p className="text-sm text-muted-foreground">
          Registration is optional for existing members. It stores your wallet address and public
          registration time on-chain. Transaction fees may apply.
        </p>
      </div>

      {registration.configurationError ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          {registration.configurationError}
        </p>
      ) : null}

      {registration.stepLabel ? (
        <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
          {registration.stepLabel}…
        </p>
      ) : null}

      {registration.error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {registration.error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        {hasRecoverableTransaction ? (
          <Button
            type="button"
            variant="outline"
            disabled={registration.isBusy || !registration.isConfigured}
            onClick={() => void registration.checkRegistration()}
          >
            Check registration
          </Button>
        ) : null}
        <Button
          type="button"
          disabled={registration.isBusy || !registration.isConfigured}
          onClick={() => void registration.register()}
        >
          {registration.isBusy ? registration.stepLabel || "Working…" : "Register wallet"}
        </Button>
      </div>
    </section>
  );
}

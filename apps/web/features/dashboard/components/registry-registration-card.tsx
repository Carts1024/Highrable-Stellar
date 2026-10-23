"use client";

import { useRegistryRegistration } from "@/features/onboarding/hooks/use-registry-registration";
import { Button } from "@repo/ui/components/ui/button";
import React from "react";

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
      className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="max-w-2xl space-y-1">
        <h2 id="registry-registration-title" className="font-sans text-sm font-semibold">
          Register your wallet on Stellar
        </h2>
        <p className="text-sm text-muted-foreground">
          Registration is optional for existing members. It stores your wallet address and public
          registration time on-chain. Transaction fees may apply.
        </p>
      </div>

      {registration.configurationError ? (
        <p className="text-sm text-amber-800">{registration.configurationError}</p>
      ) : null}

      {registration.stepLabel ? (
        <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
          {registration.stepLabel}…
        </p>
      ) : null}

      {registration.error ? (
        <p role="alert" className="text-sm text-red-700">
          {registration.error}
        </p>
      ) : null}

      <div className="flex shrink-0 flex-wrap gap-2">
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

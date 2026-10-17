"use client";

import { getRequiredRegistryConfig } from "@/core/config/stellar-contracts";
import {
  checkRegistryTransaction,
  getUserRegistration,
  registerUser as submitRegistryRegistration,
} from "@/core/stellar/registry-contract";
import { StellarTransactionPendingError } from "@/core/stellar/transaction";
import { useHighrableWalletIdentity } from "@/core/wallet/hooks/use-highrable-wallet-identity";
import { useWallet } from "@/core/wallet/hooks/use-wallet";
import { buildProfileIdentityMutationArgs } from "@/features/profile/lib/profile-identity-form";
import { api } from "@repo/convex-client";
import { useAction, useMutation, useQuery } from "convex/react";
import { makeFunctionReference } from "convex/server";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import type {
  TStellarExecutionPhase,
  TStellarSubmissionIdentity,
} from "@/core/stellar/transaction";

export type TRegistryRegistrationStep =
  | "idle"
  | "saving_profile"
  | "checking_registration"
  | TStellarExecutionPhase
  | "verifying"
  | "complete";

type TProfileDraft = ReturnType<typeof buildProfileIdentityMutationArgs>;

type TVerifiedRegistryRegistration = {
  readonly _id: string;
  readonly _creationTime: number;
  readonly network: string;
  readonly registryContractId: string;
  readonly walletAddress: string;
  readonly registeredAt: number;
  readonly verifiedAt: number;
};

const getVerifiedRegistrationRef = makeFunctionReference<
  "query",
  { walletAddress: string },
  TVerifiedRegistryRegistration | null
>("registry/queries:getVerifiedRegistration");

type TRegisterOptions = {
  readonly profileDraft?: TProfileDraft;
  readonly completeOnboarding?: boolean;
};

type TCheckOptions = {
  readonly completeOnboarding?: boolean;
};

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }
  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }
  return fallback;
}

function phaseLabel(step: TRegistryRegistrationStep): string {
  switch (step) {
    case "saving_profile":
      return "Saving profile";
    case "checking_registration":
      return "Checking registration";
    case "simulation":
      return "Preparing transaction";
    case "signing":
      return "Waiting for wallet signature";
    case "submission":
      return "Submitting registration";
    case "confirmation":
      return "Waiting for confirmation";
    case "verifying":
      return "Verifying registration";
    case "complete":
      return "Registration verified";
    case "idle":
      return "";
  }
}

export function useRegistryRegistration() {
  const walletIdentity = useHighrableWalletIdentity();
  const { signTransaction } = useWallet();
  const walletKey = walletIdentity.walletAddress;
  const [step, setStep] = useState<TRegistryRegistrationStep>("idle");
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const busyRef = useRef(false);
  const operationTokenRef = useRef(0);
  const currentWalletRef = useRef(walletKey);

  const registryConfig = useMemo(() => {
    try {
      return { value: getRequiredRegistryConfig(), error: null };
    } catch (caughtError) {
      return {
        value: null,
        error: toErrorMessage(caughtError, "Registry contract configuration is missing."),
      };
    }
  }, []);

  const verifiedRegistration = useQuery(
    getVerifiedRegistrationRef,
    walletKey ? { walletAddress: walletKey } : "skip",
  );
  const registryTransaction = useQuery(
    api.transactions.getRegistryTransaction,
    walletKey && registryConfig.value
      ? {
          walletAddress: walletKey,
          network: registryConfig.value.network,
          registryContractId: registryConfig.value.registryContractId,
        }
      : "skip",
  );

  const saveProfileDraft = useMutation(api.users.saveProfileDraft);
  const completeOnboarding = useMutation(api.users.completeOnboarding);
  const createTransaction = useMutation(api.transactions.createTransaction);
  const updateTransactionStatus = useMutation(api.transactions.updateTransactionStatus);
  const syncUserRegistration = useAction(api.sync.syncUserRegistration);

  const isCurrent = useCallback(
    (token: number, expectedWallet: string): boolean =>
      operationTokenRef.current === token && currentWalletRef.current === expectedWallet,
    [],
  );

  useLayoutEffect(() => {
    currentWalletRef.current = walletKey;
    operationTokenRef.current += 1;
  }, [walletKey]);

  useEffect(() => {
    busyRef.current = false;
    setIsBusy(false);
    setStep("idle");
    setError(null);
  }, [walletKey]);

  const clearError = useCallback(() => setError(null), []);

  const setExecutionPhase = useCallback(
    (token: number, expectedWallet: string, phase: TStellarExecutionPhase) => {
      if (isCurrent(token, expectedWallet)) {
        setStep(phase);
      }
    },
    [isCurrent],
  );

  const syncRegistration = useCallback(
    async (token: number, expectedWallet: string) => {
      const config = registryConfig.value;
      if (!config) {
        throw new Error(registryConfig.error ?? "Registry contract configuration is missing.");
      }

      const result = await syncUserRegistration({
        walletAddress: expectedWallet,
        expectedNetwork: config.network,
        expectedRegistryContractId: config.registryContractId,
      });
      if (!isCurrent(token, expectedWallet)) {
        return false;
      }
      if (!result.ok) {
        throw new Error(
          result.errorMessage ?? "Could not verify registration on the configured Stellar network.",
        );
      }
      return result.isRegistered;
    },
    [isCurrent, registryConfig, syncUserRegistration],
  );

  const finishOnboardingIfRequested = useCallback(
    async (token: number, expectedWallet: string, shouldComplete: boolean) => {
      if (!shouldComplete || !isCurrent(token, expectedWallet)) {
        return;
      }
      await completeOnboarding({ walletAddress: expectedWallet });
      if (isCurrent(token, expectedWallet)) {
        setStep("complete");
      }
    },
    [completeOnboarding, isCurrent],
  );

  const recoverPendingTransaction = useCallback(
    async (
      token: number,
      expectedWallet: string,
      transaction: NonNullable<typeof registryTransaction>,
      options: { readonly allowRetry: boolean; readonly completeOnboarding: boolean },
    ): Promise<"retry" | "stop" | "registered"> => {
      const config = registryConfig.value;
      if (!config) {
        throw new Error(registryConfig.error ?? "Registry contract configuration is missing.");
      }

      if (transaction.status === "failed") {
        return options.allowRetry ? "retry" : "stop";
      }

      if (transaction.status === "success") {
        setError(
          "The registration transaction was confirmed. Check registration to sync it from Stellar.",
        );
        return "stop";
      }

      const usableHash =
        transaction.submissionIdentityType === "inner_transaction" ? undefined : transaction.txHash;
      const outcome = await checkRegistryTransaction({
        rpcUrl: config.rpcUrl,
        ...(usableHash ? { transactionHash: usableHash } : {}),
        ...(transaction.transactionValidUntil !== undefined
          ? { validUntil: transaction.transactionValidUntil }
          : {}),
        createdAt: transaction.createdAt,
      });
      if (!isCurrent(token, expectedWallet)) {
        return "stop";
      }

      if (outcome.status === "confirmed") {
        await updateTransactionStatus({
          clientRequestId: transaction.clientRequestId,
          status: "success",
          confirmedAt: Date.now(),
        });
        setStep("verifying");
        if (await syncRegistration(token, expectedWallet)) {
          await finishOnboardingIfRequested(token, expectedWallet, options.completeOnboarding);
          return "registered";
        }
        setError(
          "The transaction was confirmed, but registry membership is not readable yet. Check registration again.",
        );
        return "stop";
      }

      if (outcome.status === "failed" || outcome.status === "expired") {
        await updateTransactionStatus({
          clientRequestId: transaction.clientRequestId,
          status: "failed",
          errorMessage:
            outcome.status === "expired"
              ? "The signed registration transaction expired without appearing on-chain."
              : "The registration transaction failed on-chain.",
        });
        return options.allowRetry ? "retry" : "stop";
      }

      setError(
        "The registration transaction outcome is still unknown. Use Check registration again before starting another transaction.",
      );
      return "stop";
    },
    [
      finishOnboardingIfRequested,
      isCurrent,
      registryConfig,
      syncRegistration,
      updateTransactionStatus,
    ],
  );

  const register = useCallback(
    async (options: TRegisterOptions = {}) => {
      const expectedWallet = walletIdentity.walletAddress;
      if (!expectedWallet || !walletIdentity.walletType) {
        setError("Connect a Stellar wallet or passkey smart account before registering.");
        return;
      }
      if (busyRef.current) {
        return;
      }

      busyRef.current = true;
      setIsBusy(true);
      const token = operationTokenRef.current;
      setError(null);

      try {
        if (options.profileDraft) {
          setStep("saving_profile");
          await saveProfileDraft({
            walletAddress: expectedWallet,
            walletType: walletIdentity.walletType,
            ...options.profileDraft,
          });
          if (!isCurrent(token, expectedWallet)) {
            return;
          }
        }

        const config = registryConfig.value;
        if (!config) {
          throw new Error(registryConfig.error ?? "Registry contract configuration is missing.");
        }

        setStep("checking_registration");
        if (await syncRegistration(token, expectedWallet)) {
          await finishOnboardingIfRequested(
            token,
            expectedWallet,
            options.completeOnboarding ?? false,
          );
          if (isCurrent(token, expectedWallet)) {
            setStep("complete");
          }
          return;
        }

        const onChainRegistration = await getUserRegistration({
          walletAddress: expectedWallet,
          walletType: walletIdentity.walletType,
        });
        if (!isCurrent(token, expectedWallet)) {
          return;
        }
        if (onChainRegistration) {
          if (await syncRegistration(token, expectedWallet)) {
            await finishOnboardingIfRequested(
              token,
              expectedWallet,
              options.completeOnboarding ?? false,
            );
            return;
          }
          throw new Error(
            "The registry record exists, but Convex could not verify it. Check registration again.",
          );
        }

        if (registryTransaction === undefined) {
          throw new Error("Loading registration recovery details. Try again in a moment.");
        }

        if (
          registryTransaction?.status === "pending" ||
          registryTransaction?.status === "success"
        ) {
          const recovery = await recoverPendingTransaction(
            token,
            expectedWallet,
            registryTransaction,
            {
              allowRetry: true,
              completeOnboarding: options.completeOnboarding ?? false,
            },
          );
          if (recovery !== "retry") {
            return;
          }
        }
        if (!isCurrent(token, expectedWallet)) {
          return;
        }

        const operationId = crypto.randomUUID();
        await createTransaction({
          walletAddress: expectedWallet,
          walletType: walletIdentity.walletType,
          type: "register_user",
          clientRequestId: operationId,
          network: config.network,
          contractId: config.registryContractId,
          status: "pending",
        });
        if (!isCurrent(token, expectedWallet)) {
          return;
        }

        const knownIdentity: { current: TStellarSubmissionIdentity | null } = { current: null };
        let chainConfirmed = false;
        try {
          const result = await submitRegistryRegistration({
            walletAddress: expectedWallet,
            walletType: walletIdentity.walletType,
            signTransaction,
            operationId,
            onSigned: async (identity) => {
              knownIdentity.current = identity;
              const identityType = identity.identityType ?? "transaction";
              await updateTransactionStatus({
                clientRequestId: operationId,
                status: "pending",
                ...(identityType === "inner_transaction"
                  ? { transactionHash: identity.transactionHash }
                  : { txHash: identity.transactionHash }),
                transactionValidUntil: identity.transactionValidUntil,
                submissionIdentityType: identityType,
              });
            },
            onPhase: (phase) => setExecutionPhase(token, expectedWallet, phase),
          });
          if (!isCurrent(token, expectedWallet)) {
            return;
          }

          chainConfirmed = true;
          await updateTransactionStatus({
            clientRequestId: operationId,
            txHash: result.txHash,
            transactionHash: result.txHash,
            status: "success",
            confirmedAt: Date.now(),
            submissionIdentityType: "transaction",
          });
          setStep("verifying");
          if (!(await syncRegistration(token, expectedWallet))) {
            throw new Error(
              "Registration was submitted, but Convex could not verify the registry record. Use Check registration to sync it.",
            );
          }
          await finishOnboardingIfRequested(
            token,
            expectedWallet,
            options.completeOnboarding ?? false,
          );
          if (isCurrent(token, expectedWallet)) {
            setStep("complete");
          }
        } catch (caughtError) {
          if (!isCurrent(token, expectedWallet)) {
            return;
          }
          const isPending = caughtError instanceof StellarTransactionPendingError;
          const submissionIdentity = knownIdentity.current;
          const identityType = submissionIdentity?.identityType ?? "transaction";
          await updateTransactionStatus({
            clientRequestId: operationId,
            status: chainConfirmed ? "success" : isPending ? "pending" : "failed",
            ...(submissionIdentity && identityType === "inner_transaction"
              ? { transactionHash: submissionIdentity.transactionHash }
              : submissionIdentity
                ? { txHash: submissionIdentity.transactionHash }
                : {}),
            ...(submissionIdentity
              ? {
                  transactionValidUntil: submissionIdentity.transactionValidUntil,
                  submissionIdentityType: identityType,
                }
              : {}),
            errorMessage: toErrorMessage(caughtError, "Registration could not be completed."),
            ...(chainConfirmed ? { confirmedAt: Date.now() } : {}),
          });
          throw caughtError;
        }
      } catch (caughtError) {
        if (isCurrent(token, expectedWallet)) {
          setStep("idle");
          setError(toErrorMessage(caughtError, "Registration could not be completed."));
        }
      } finally {
        if (isCurrent(token, expectedWallet)) {
          busyRef.current = false;
          setIsBusy(false);
        }
      }
    },
    [
      createTransaction,
      finishOnboardingIfRequested,
      isCurrent,
      recoverPendingTransaction,
      registryConfig,
      registryTransaction,
      saveProfileDraft,
      setExecutionPhase,
      signTransaction,
      syncRegistration,
      updateTransactionStatus,
      walletIdentity.walletAddress,
      walletIdentity.walletType,
    ],
  );

  const checkRegistration = useCallback(
    async (options: TCheckOptions = {}) => {
      const expectedWallet = walletIdentity.walletAddress;
      if (!expectedWallet || !walletIdentity.walletType) {
        setError("Connect a Stellar wallet or passkey smart account before checking registration.");
        return;
      }
      if (busyRef.current) {
        return;
      }

      busyRef.current = true;
      setIsBusy(true);
      const token = operationTokenRef.current;
      setError(null);
      setStep("checking_registration");

      try {
        if (!registryConfig.value) {
          throw new Error(registryConfig.error ?? "Registry contract configuration is missing.");
        }
        if (await syncRegistration(token, expectedWallet)) {
          await finishOnboardingIfRequested(
            token,
            expectedWallet,
            options.completeOnboarding ?? false,
          );
          if (isCurrent(token, expectedWallet)) {
            setStep("complete");
          }
          return;
        }

        if (
          registryTransaction?.status === "pending" ||
          registryTransaction?.status === "success"
        ) {
          setStep("verifying");
          await recoverPendingTransaction(token, expectedWallet, registryTransaction, {
            allowRetry: false,
            completeOnboarding: options.completeOnboarding ?? false,
          });
          return;
        }

        if (registryTransaction === undefined) {
          throw new Error("Loading registration recovery details. Try again in a moment.");
        }

        throw new Error(
          "No verified registry record was found yet. Your profile draft is saved; you can try again when ready.",
        );
      } catch (caughtError) {
        if (isCurrent(token, expectedWallet)) {
          setStep("idle");
          setError(toErrorMessage(caughtError, "Could not check Stellar registration."));
        }
      } finally {
        if (isCurrent(token, expectedWallet)) {
          busyRef.current = false;
          setIsBusy(false);
        }
      }
    },
    [
      finishOnboardingIfRequested,
      isCurrent,
      recoverPendingTransaction,
      registryConfig,
      registryTransaction,
      syncRegistration,
      walletIdentity.walletAddress,
      walletIdentity.walletType,
    ],
  );

  return {
    step,
    stepLabel: phaseLabel(step),
    error,
    clearError,
    isBusy,
    isConfigured: registryConfig.value !== null,
    configurationError: registryConfig.error,
    isLoading: Boolean(
      walletKey &&
      (verifiedRegistration === undefined ||
        (registryConfig.value && registryTransaction === undefined)),
    ),
    isVerified: Boolean(
      verifiedRegistration &&
      registryConfig.value &&
      verifiedRegistration.network === registryConfig.value.network &&
      verifiedRegistration.registryContractId === registryConfig.value.registryContractId,
    ),
    verifiedRegistration: verifiedRegistration ?? null,
    transaction: registryTransaction ?? null,
    hasPendingTransaction: registryTransaction?.status === "pending",
    register,
    checkRegistration,
  };
}

export type { TProfileDraft };

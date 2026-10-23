"use client";

import { useHighrableWalletIdentity } from "@/core/wallet/hooks/use-highrable-wallet-identity";
import { useWallet } from "@/core/wallet/hooks/use-wallet";
import { AdminApiError, isAdminAccessError } from "@/features/admin/lib/admin-api";
import { ADMIN_QUERY_KEY, useAdminSessionQuery } from "@/features/admin/lib/admin-session-query";
import { RouteCallout, RoutePanel, RoutePanelHeader } from "@/features/common";
import { Button as AppButton } from "@repo/ui/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

export { ADMIN_QUERY_KEY };

type TAdminSessionAccessContext = {
  readonly verifiedWallet: string;
  readonly isOwner: boolean;
  readonly isDisputeAdmin: boolean;
  readonly handleProtectedApiError: (error: unknown) => void;
};

const AdminSessionAccessContext = createContext<TAdminSessionAccessContext | null>(null);

function normalizeWalletAddress(walletAddress: string): string {
  return walletAddress.trim().toUpperCase();
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim().length > 0 ? error.message : fallback;
}

function AdminSessionPanel({
  title,
  description,
  children,
}: {
  readonly title: string;
  readonly description: string;
  readonly children?: React.ReactNode;
}) {
  return (
    <RoutePanel className="max-w-2xl">
      <RoutePanelHeader eyebrow="Admin Session" title={title} description={description} />
      {children ? <div className="space-y-4 px-5 py-4">{children}</div> : null}
    </RoutePanel>
  );
}

function isMatchingWallet(adminWallet: string, externalWallet: string): boolean {
  return normalizeWalletAddress(adminWallet) === normalizeWalletAddress(externalWallet);
}

export function useAdminSessionAccess(): TAdminSessionAccessContext {
  const context = useContext(AdminSessionAccessContext);
  if (!context) {
    throw new Error("useAdminSessionAccess must be used within AdminSessionGate");
  }

  return context;
}

export function AdminSessionGate({
  children,
  requiredCapability = "dispute",
}: {
  readonly children: React.ReactNode;
  readonly requiredCapability?: "owner" | "dispute";
}) {
  const walletIdentity = useHighrableWalletIdentity();
  const { authSession, authenticateWallet, logoutWallet, walletState } = useWallet();
  const queryClient = useQueryClient();
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authenticationError, setAuthenticationError] = useState<string | null>(null);
  const [forcedAccessError, setForcedAccessError] = useState<AdminApiError | null>(null);
  const previousExternalWalletRef = useRef<string | null>(null);

  const { sessionQuery, sessionQueryKey, externalWalletAddress } = useAdminSessionQuery();
  const isExternalWalletActive = walletIdentity.activeWalletMode === "external_wallet";

  const clearProtectedQueries = useCallback(
    async (preserveQueryKey?: readonly unknown[]) => {
      const shouldPreserve = (queryKey: readonly unknown[]): boolean =>
        preserveQueryKey !== undefined &&
        queryKey.length === preserveQueryKey.length &&
        queryKey.every((value, index) => Object.is(value, preserveQueryKey[index]));

      await queryClient.cancelQueries({
        queryKey: ADMIN_QUERY_KEY,
        predicate: (query) => !shouldPreserve(query.queryKey),
      });
      queryClient.removeQueries({
        queryKey: ADMIN_QUERY_KEY,
        predicate: (query) => !shouldPreserve(query.queryKey),
      });
    },
    [queryClient],
  );

  const handleProtectedApiError = useCallback(
    (error: unknown) => {
      if (!isAdminAccessError(error)) {
        return;
      }

      setForcedAccessError(error);
      void clearProtectedQueries();
      if (error.status === 401) {
        logoutWallet();
      }
    },
    [clearProtectedQueries, logoutWallet],
  );

  useEffect(() => {
    const hasPreviousIdentity = previousExternalWalletRef.current !== null;
    const identityChanged =
      hasPreviousIdentity && previousExternalWalletRef.current !== externalWalletAddress;

    if (identityChanged) {
      void clearProtectedQueries(sessionQueryKey);
      setForcedAccessError(null);
      setAuthenticationError(null);

      logoutWallet();
    }

    previousExternalWalletRef.current = externalWalletAddress;
  }, [clearProtectedQueries, externalWalletAddress, logoutWallet, sessionQueryKey]);

  const retryAccess = useCallback(async () => {
    setForcedAccessError(null);
    setAuthenticationError(null);
    await sessionQuery.refetch();
  }, [sessionQuery.refetch]);

  const handleAuthenticate = useCallback(async () => {
    if (isAuthenticating) {
      return;
    }

    setIsAuthenticating(true);
    setAuthenticationError(null);
    setForcedAccessError(null);

    try {
      await authenticateWallet();
      const refreshed = await sessionQuery.refetch();
      if (refreshed.error) {
        setAuthenticationError(
          refreshed.error.status === 401
            ? "Authentication was not accepted. Sign in with an authorized external wallet and try again."
            : getErrorMessage(refreshed.error, "Admin authentication could not be verified."),
        );
      }
    } catch (error) {
      setAuthenticationError(getErrorMessage(error, "Admin authentication failed. Try again."));
    } finally {
      setIsAuthenticating(false);
    }
  }, [authenticateWallet, isAuthenticating, sessionQuery.refetch]);

  const isAuthorized =
    sessionQuery.isSuccess &&
    externalWalletAddress !== null &&
    isMatchingWallet(sessionQuery.data.adminWallet, externalWalletAddress) &&
    (requiredCapability === "owner" ? sessionQuery.data.isOwner : sessionQuery.data.isDisputeAdmin);

  if (walletState.isConnecting || walletState.status === "connecting") {
    return (
      <AdminSessionPanel
        title="Connecting Admin Wallet"
        description="Wait for the external wallet connection to finish before access can be checked."
      />
    );
  }

  if (!isExternalWalletActive || walletIdentity.walletType === "passkey_smart_account") {
    return (
      <AdminSessionPanel
        title="Use an External Admin Wallet"
        description="Dispute admins sign in with an external Stellar wallet. Switch away from passkey mode and connect an authorized wallet to continue."
      />
    );
  }

  if (!walletState.isConnected || !externalWalletAddress) {
    return (
      <AdminSessionPanel
        title="Connect an Admin Wallet"
        description="Connect an authorized external dispute admin wallet to access dispute operations."
      />
    );
  }

  if (forcedAccessError) {
    if (forcedAccessError.status === 401) {
      return (
        <AdminSessionPanel
          title="Authentication Required"
          description="The admin session expired or is no longer valid. Authenticate the external wallet again."
        >
          <RouteCallout tone="danger">
            {authenticationError ?? forcedAccessError.message}
          </RouteCallout>
          <AppButton
            type="button"
            onClick={() => void handleAuthenticate()}
            disabled={isAuthenticating}
          >
            {isAuthenticating ? "Authenticating..." : "Authenticate Wallet"}
          </AppButton>
        </AdminSessionPanel>
      );
    }

    return (
      <AdminSessionPanel
        title="Admin Access Forbidden"
        description="This wallet is not authorized for the protected admin page."
      >
        <RouteCallout tone="danger">{forcedAccessError.message}</RouteCallout>
        <AppButton
          type="button"
          onClick={() => void retryAccess()}
          disabled={sessionQuery.isFetching}
        >
          {sessionQuery.isFetching ? "Checking..." : "Retry access check"}
        </AppButton>
      </AdminSessionPanel>
    );
  }

  // Only block on checks that have no verified result yet. Background re-checks (e.g. the refetch
  // when focus returns from a wallet signing popup) must keep the page mounted, or in-progress
  // settlements and unsaved form input are thrown away. A failed re-check still closes the page
  // through the error branches below.
  if (sessionQuery.isPending || (sessionQuery.isFetching && !sessionQuery.isSuccess)) {
    return (
      <AdminSessionPanel
        title="Checking Admin Access"
        description="Verifying the signed session and admin capabilities."
      />
    );
  }

  if (sessionQuery.error?.status === 401) {
    return (
      <AdminSessionPanel
        title={authSession ? "Admin Session Expired" : "Authentication Required"}
        description="Sign the Highrable session message with your external dispute admin wallet before protected content is shown."
      >
        {authenticationError ? (
          <RouteCallout tone="danger">{authenticationError}</RouteCallout>
        ) : null}
        <AppButton
          type="button"
          onClick={() => void handleAuthenticate()}
          disabled={isAuthenticating}
        >
          {isAuthenticating ? "Authenticating..." : "Authenticate Wallet"}
        </AppButton>
      </AdminSessionPanel>
    );
  }

  if (
    sessionQuery.data &&
    !sessionQuery.error &&
    externalWalletAddress !== null &&
    !isMatchingWallet(sessionQuery.data.adminWallet, externalWalletAddress)
  ) {
    return (
      <AdminSessionPanel
        title="Authenticate Connected Admin Wallet"
        description="The current session belongs to a different wallet. Verify the connected external wallet before continuing."
      >
        <RouteCallout tone="danger">
          The signed session belongs to a different wallet. Authenticate the connected external
          wallet to check its admin access.
        </RouteCallout>
        <AppButton
          type="button"
          onClick={() => void handleAuthenticate()}
          disabled={isAuthenticating}
        >
          {isAuthenticating ? "Authenticating..." : "Authenticate Wallet"}
        </AppButton>
      </AdminSessionPanel>
    );
  }

  if (sessionQuery.error?.status === 403 || (sessionQuery.data && !isAuthorized)) {
    return (
      <AdminSessionPanel
        title="Admin Access Forbidden"
        description="The verified wallet does not have the capability required for this page."
      >
        <RouteCallout tone="danger">
          {sessionQuery.error?.message ?? "Connect an authorized external admin wallet."}
        </RouteCallout>
        <AppButton
          type="button"
          onClick={() => void retryAccess()}
          disabled={sessionQuery.isFetching}
        >
          {sessionQuery.isFetching ? "Checking..." : "Retry access check"}
        </AppButton>
      </AdminSessionPanel>
    );
  }

  if (sessionQuery.error) {
    return (
      <AdminSessionPanel
        title="Admin Access Check Failed"
        description="The server could not verify admin access. Your protected content remains closed."
      >
        <RouteCallout tone="danger">{sessionQuery.error.message}</RouteCallout>
        <AppButton
          type="button"
          onClick={() => void retryAccess()}
          disabled={sessionQuery.isFetching}
        >
          {sessionQuery.isFetching ? "Retrying..." : "Retry access check"}
        </AppButton>
      </AdminSessionPanel>
    );
  }

  if (!isAuthorized || !sessionQuery.data) {
    return (
      <AdminSessionPanel
        title="Admin Access Unavailable"
        description="The server returned an unexpected access result. Retry the check before continuing."
      >
        <AppButton
          type="button"
          onClick={() => void retryAccess()}
          disabled={sessionQuery.isFetching}
        >
          {sessionQuery.isFetching ? "Checking..." : "Retry access check"}
        </AppButton>
      </AdminSessionPanel>
    );
  }

  return (
    <AdminSessionAccessContext.Provider
      value={{
        verifiedWallet: sessionQuery.data.adminWallet,
        isOwner: sessionQuery.data.isOwner,
        isDisputeAdmin: sessionQuery.data.isDisputeAdmin,
        handleProtectedApiError,
      }}
    >
      {children}
    </AdminSessionAccessContext.Provider>
  );
}

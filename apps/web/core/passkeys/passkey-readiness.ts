export type TPasskeyReadinessStatus =
  | "not_connected"
  | "unsupported_browser"
  | "missing_config"
  | "session_restored"
  | "connected"
  | "address_available"
  | "balance_readable"
  | "needs_funding"
  | "ready_for_identity"
  | "not_ready_for_escrow_writes";

export type TPasskeyReadinessSeverity = "success" | "info" | "warning" | "error";

export interface IPasskeyReadinessChecklistItem {
  readonly label: string;
  readonly passed: boolean;
  readonly description?: string;
}

export interface IPasskeyReadinessInput {
  readonly isSupported: boolean;
  readonly hasConfig: boolean;
  readonly isConnected: boolean;
  readonly smartAccountAddress: string | null | undefined;
  readonly nativeBalance: bigint | null;
  readonly stablecoinBalance: bigint | null;
  readonly canSignEscrowTransactions: boolean;
  readonly isSessionRestored?: boolean;
  readonly isConvexUserLinked?: boolean;
}

export interface IPasskeyReadinessState {
  readonly status: TPasskeyReadinessStatus;
  readonly label: string;
  readonly description: string;
  readonly severity: TPasskeyReadinessSeverity;
  readonly checklist: readonly IPasskeyReadinessChecklistItem[];
}

const PHASE_23_DESCRIPTION =
  "Ready as Highrable identity. Escrow transaction signing will be enabled in Phase 23.";

function hasReadableBalance(
  nativeBalance: bigint | null,
  stablecoinBalance: bigint | null,
): boolean {
  return nativeBalance !== null || stablecoinBalance !== null;
}

function hasFunding(nativeBalance: bigint | null, stablecoinBalance: bigint | null): boolean {
  return (
    (nativeBalance !== null && nativeBalance > 0n) ||
    (stablecoinBalance !== null && stablecoinBalance > 0n)
  );
}

export function getPasskeyReadinessState(input: IPasskeyReadinessInput): IPasskeyReadinessState {
  const hasAddress =
    typeof input.smartAccountAddress === "string" && input.smartAccountAddress.trim().length > 0;
  const balanceReadable = hasReadableBalance(input.nativeBalance, input.stablecoinBalance);
  const funded = hasFunding(input.nativeBalance, input.stablecoinBalance);
  const isConvexUserLinked = input.isConvexUserLinked === true;

  const checklist: IPasskeyReadinessChecklistItem[] = [
    {
      label: "Browser supports passkeys",
      passed: input.isSupported,
    },
    {
      label: "Smart account config loaded",
      passed: input.hasConfig,
    },
    {
      label: "Passkey session connected",
      passed: input.isConnected,
      description: input.isSessionRestored ? "Session restored from local storage." : undefined,
    },
    {
      label: "Smart account address available",
      passed: hasAddress,
    },
    {
      label: "Convex user linked",
      passed: isConvexUserLinked,
      description: isConvexUserLinked
        ? "A Highrable user record exists for this smart account address."
        : "Create or link a profile before relying on this identity.",
    },
    {
      label: "Profiles/dashboard can use this address",
      passed: hasAddress && input.isConnected,
    },
    {
      label: "Escrow write transactions enabled",
      passed: input.canSignEscrowTransactions,
      description: "False for passkey smart accounts until Phase 23.",
    },
  ];

  if (!input.isSupported) {
    return {
      status: "unsupported_browser",
      label: "Passkeys unsupported",
      description: "This browser or device does not support passkeys/WebAuthn.",
      severity: "error",
      checklist,
    };
  }

  if (!input.hasConfig) {
    return {
      status: "missing_config",
      label: "Smart account config missing",
      description: "Required passkey smart account environment variables are not configured.",
      severity: "warning",
      checklist,
    };
  }

  if (!input.isConnected) {
    return {
      status: "not_connected",
      label: "Passkey not connected",
      description: "Create or reconnect a passkey smart account to use it as a Highrable identity.",
      severity: "info",
      checklist,
    };
  }

  if (input.canSignEscrowTransactions) {
    return {
      status: "connected",
      label: "Passkey escrow signing enabled",
      description: "Passkey smart account escrow signing is enabled.",
      severity: "success",
      checklist,
    };
  }

  if (!hasAddress) {
    return {
      status: "connected",
      label: "Connected, address unavailable",
      description:
        "The passkey session is connected but the smart account address is not available.",
      severity: "warning",
      checklist,
    };
  }

  if (balanceReadable && !funded) {
    return {
      status: "needs_funding",
      label: "Identity ready, funding needed",
      description: PHASE_23_DESCRIPTION,
      severity: "info",
      checklist,
    };
  }

  if (balanceReadable) {
    return {
      status: "balance_readable",
      label: "Ready as Highrable identity",
      description: PHASE_23_DESCRIPTION,
      severity: "success",
      checklist,
    };
  }

  if (input.isSessionRestored) {
    return {
      status: "session_restored",
      label: "Session restored",
      description: PHASE_23_DESCRIPTION,
      severity: "success",
      checklist,
    };
  }

  return {
    status: "not_ready_for_escrow_writes",
    label: "Ready as Highrable identity",
    description: PHASE_23_DESCRIPTION,
    severity: "success",
    checklist,
  };
}

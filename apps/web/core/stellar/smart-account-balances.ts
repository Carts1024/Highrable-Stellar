import { STELLAR_NETWORK_PASSPHRASE, STELLAR_RPC_URL } from "@/core/config/stellar-contracts";
import { STELLAR_HORIZON_URL } from "@/core/config/web3";
import { getStablecoinBalanceOnChain } from "@/core/stellar/escrow-contract";
import { getSmartAccountKit } from "@/core/stellar/smart-account-kit";

const CLASSIC_ACCOUNT_PATTERN = /^G[A-Z2-7]{55}$/;
const CONTRACT_ACCOUNT_PATTERN = /^C[A-Z2-7]{55}$/;

export type TSmartAccountBalanceReadStatus = "readable" | "limited" | "not_found" | "error";

export interface ISmartAccountBalanceResult {
  readonly status: TSmartAccountBalanceReadStatus;
  readonly balance: bigint | null;
  readonly message: string | null;
}

interface IHorizonBalance {
  readonly asset_type: string;
  readonly balance: string;
}

interface IHorizonAccountResponse {
  readonly balances?: readonly IHorizonBalance[];
}

function sanitizeSmartAccountAddress(address: string): string {
  const sanitizedAddress = address.trim().toUpperCase();

  if (
    !CLASSIC_ACCOUNT_PATTERN.test(sanitizedAddress) &&
    !CONTRACT_ACCOUNT_PATTERN.test(sanitizedAddress)
  ) {
    throw new Error("Invalid Stellar smart account address format.");
  }

  return sanitizedAddress;
}

function toStroops(balance: string): bigint {
  const [wholePart = "0", fractionalPart = ""] = balance.trim().split(".");
  const paddedFractionalPart = `${fractionalPart}0000000`.slice(0, 7);
  return BigInt(wholePart) * 10_000_000n + BigInt(paddedFractionalPart);
}

function toLimitedResult(): ISmartAccountBalanceResult {
  return {
    status: "limited",
    balance: null,
    message: "Native XLM balance reading is limited for contract smart accounts.",
  };
}

export function canReadSmartAccountBalance(address: string): boolean {
  try {
    return CLASSIC_ACCOUNT_PATTERN.test(sanitizeSmartAccountAddress(address));
  } catch {
    return false;
  }
}

export async function getSmartAccountNativeBalance(
  address: string,
): Promise<ISmartAccountBalanceResult> {
  const sanitizedAddress = sanitizeSmartAccountAddress(address);

  if (!canReadSmartAccountBalance(sanitizedAddress)) {
    return toLimitedResult();
  }

  const response = await fetch(
    `${STELLAR_HORIZON_URL}/accounts/${encodeURIComponent(sanitizedAddress)}`,
    {
      method: "GET",
      cache: "no-store",
    },
  );

  if (response.status === 404) {
    return {
      status: "not_found",
      balance: 0n,
      message: "Classic Stellar account was not found on Horizon.",
    };
  }

  if (!response.ok) {
    return {
      status: "error",
      balance: null,
      message: `Could not read native balance (${response.status}).`,
    };
  }

  const account = (await response.json()) as IHorizonAccountResponse;
  const nativeBalance = account.balances?.find((balance) => balance.asset_type === "native");

  return {
    status: "readable",
    balance: nativeBalance ? toStroops(nativeBalance.balance) : 0n,
    message: null,
  };
}

export async function getSmartAccountStablecoinBalance(
  address: string,
  tokenContractId: string,
): Promise<ISmartAccountBalanceResult> {
  const sanitizedAddress = sanitizeSmartAccountAddress(address);
  const sanitizedTokenContractId = tokenContractId.trim();

  if (!sanitizedTokenContractId) {
    return {
      status: "limited",
      balance: null,
      message: "Stablecoin token contract is not configured.",
    };
  }

  try {
    const sourceAddress = CONTRACT_ACCOUNT_PATTERN.test(sanitizedAddress)
      ? getSmartAccountKit().deployerPublicKey
      : sanitizedAddress;
    const balance = await getStablecoinBalanceOnChain({
      rpcUrl: STELLAR_RPC_URL,
      networkPassphrase: STELLAR_NETWORK_PASSPHRASE,
      stablecoinTokenContractId: sanitizedTokenContractId,
      sourceAddress,
      walletAddress: sanitizedAddress,
    });

    return {
      status: "readable",
      balance,
      message: null,
    };
  } catch (error) {
    return {
      status: "error",
      balance: null,
      message: error instanceof Error ? error.message : "Could not read stablecoin balance.",
    };
  }
}

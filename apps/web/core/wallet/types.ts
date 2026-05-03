export type TWalletConnectionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "disconnecting"
  | "error";

export type TWalletNetwork = "testnet";
export type TWalletTransactionStatus = "idle" | "pending" | "success" | "failed";

export type TWalletErrorCode =
  | "NOT_INITIALIZED"
  | "UNSUPPORTED_NETWORK"
  | "CONNECT_FAILED"
  | "DISCONNECT_FAILED"
  | "FUNDING_CHECK_FAILED"
  | "SIGN_TRANSACTION_FAILED"
  | "AUTH_FAILED"
  | "CONFIG_ERROR"
  | "UNKNOWN";

export type TWalletError = {
  code: TWalletErrorCode;
  message: string;
};

export type TWalletAccount = {
  address: string;
  displayAddress: string;
  walletId: string | null;
  walletName: string | null;
  network: string | null;
  isTestnet: boolean;
};

export type TWalletFundingStatus = {
  address: string;
  isFunded: boolean;
};

export type TWalletState = {
  status: TWalletConnectionStatus;
  walletAddress: string | null;
  network: string | null;
  isConnected: boolean;
  isTestnet: boolean;
  isFunded: boolean | null;
  selectedWallet: string | null;
  isConnecting: boolean;
  isCheckingFunding: boolean;
  error: string | null;
  lastTxStatus: TWalletTransactionStatus;
  account: TWalletAccount | null;
};

export type TAuthSession = {
  address: string;
  token: string;
  expiresAt: string;
};

export type TAuthChallenge = {
  nonce: string;
  message: string;
  expiresAt: string;
};

export interface IWalletClient {
  connect(): Promise<TWalletAccount>;
  getActiveWallet(): Promise<TWalletAccount>;
  getPublicKey(): Promise<string>;
  getNetwork(): Promise<{ network: string | null; isTestnet: boolean }>;
  restoreConnection(): Promise<TWalletAccount | null>;
  disconnect(): Promise<void>;
  signMessage(message: string): Promise<string>;
  signTransaction(xdr: string, address?: string): Promise<string>;
}

export interface IWalletFundingService {
  getFundingStatus(address: string): Promise<TWalletFundingStatus>;
}

export interface IWalletAuthService {
  createChallenge(address: string): Promise<TAuthChallenge>;
  verifySignature(input: {
    address: string;
    signature: string;
    message: string;
    nonce: string;
  }): Promise<TAuthSession>;
}

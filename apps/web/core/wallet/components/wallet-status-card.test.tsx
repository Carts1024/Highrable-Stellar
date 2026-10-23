// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mockState = vi.hoisted(() => ({
  walletIdentity: {
    isConnected: true,
    walletAddress: `C${"A".repeat(55)}`,
    walletType: "passkey_smart_account" as const,
  },
  walletState: {
    isCheckingFunding: false,
    isConnected: false,
    isFunded: null,
    isFundingWithFriendbot: false,
    isTestnet: true,
    network: "Stellar Testnet",
    selectedWallet: null,
  },
}));

vi.mock("@/core/wallet/config", () => ({ WALLET_NETWORK_LABEL: "Stellar Testnet" }));
vi.mock("@/core/wallet/hooks/use-highrable-wallet-identity", () => ({
  useHighrableWalletIdentity: () => mockState.walletIdentity,
}));
vi.mock("@/core/wallet/hooks/use-wallet", () => ({
  useWallet: () => ({
    checkFundingStatus: vi.fn(),
    fundTestnetAccount: vi.fn(),
    refreshWalletState: vi.fn(),
    walletState: mockState.walletState,
  }),
}));

import { WalletStatusCard } from "./wallet-status-card";

describe("WalletStatusCard", () => {
  afterEach(cleanup);

  it("shows a passkey smart-account address without external-wallet state", () => {
    render(<WalletStatusCard />);

    const formattedAddress = mockState.walletIdentity.walletAddress
      .replace(/(.{4})/g, "$1 ")
      .trim();

    expect(screen.getByRole("heading", { name: "Your Passkey Account" })).toBeTruthy();
    expect(screen.getByText(formattedAddress)).toBeTruthy();
    expect(screen.getByText("Passkey Smart Account")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Wallet options" })).toBeNull();
  });
});

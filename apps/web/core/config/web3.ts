import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { baseSepolia } from "wagmi/chains";

import type { Config } from "wagmi";

const walletConnectProjectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "YOUR_PROJECT_ID";

export const config: Config = getDefaultConfig({
  appName: "Highrable",
  projectId: walletConnectProjectId,
  chains: [baseSepolia],
  ssr: false,
});

export const ESCROW_CONTRACT_ADDRESS = "0x...";
export const ESCROW_ABI = [
  // Basic escrow contract ABI
  {
    inputs: [
      { name: "client", type: "address" },
      { name: "freelancer", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "jobId", type: "uint256" },
    ],
    name: "createEscrow",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [{ name: "jobId", type: "uint256" }],
    name: "releasePayment",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "jobId", type: "uint256" }],
    name: "getJobDetails",
    outputs: [
      { name: "client", type: "address" },
      { name: "freelancer", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "status", type: "uint8" },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;

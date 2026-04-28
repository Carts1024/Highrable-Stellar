import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { baseSepolia } from 'wagmi/chains';

export const config = getDefaultConfig({
  appName: 'Highrable',
  projectId: 'YOUR_PROJECT_ID', // Get from WalletConnect
  chains: [baseSepolia],
  ssr: false,
});

export const ESCROW_CONTRACT_ADDRESS = "0x..."; // Deploy your contract here
export const ESCROW_ABI = [
  // Basic escrow contract ABI
  {
    "inputs": [
      {"name": "client", "type": "address"},
      {"name": "freelancer", "type": "address"},
      {"name": "amount", "type": "uint256"},
      {"name": "jobId", "type": "uint256"}
    ],
    "name": "createEscrow",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [{"name": "jobId", "type": "uint256"}],
    "name": "releasePayment",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{"name": "jobId", "type": "uint256"}],
    "name": "getJobDetails",
    "outputs": [
      {"name": "client", "type": "address"},
      {"name": "freelancer", "type": "address"},
      {"name": "amount", "type": "uint256"},
      {"name": "status", "type": "uint8"}
    ],
    "stateMutability": "view",
    "type": "function"
  }
] as const;
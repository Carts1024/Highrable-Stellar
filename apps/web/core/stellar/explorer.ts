export function getTxExplorerUrl(txHash: string): string {
  return `https://stellar.expert/explorer/testnet/tx/${encodeURIComponent(txHash)}`;
}

import { WalletStatusCard } from "@/core/wallet/components/wallet-status-card";

import { Header } from "./header";

/** Wraps route content with the shared Highrable navigation shell. */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      <Header />
      <WalletStatusCard />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}

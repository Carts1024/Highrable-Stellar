"use client";

import { PasskeySmartAccountCard } from "@/core/wallet/components/passkey-smart-account-card";
import { WalletConnectTrigger } from "@/core/wallet/components/wallet-connect-trigger";

export function WalletRequiredNotice({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="mx-auto max-w-2xl py-16 text-center">
      <div className="rounded-2xl border border-gray-100 bg-white p-12 shadow-lg">
        <h1 className="mb-6 text-3xl font-bold text-gray-900">{title}</h1>
        <p className="mb-8 text-gray-600">{description}</p>
        <WalletConnectTrigger className="rounded-lg bg-linear-to-r from-[#FF7003] to-[#FF8801] px-6 py-2 font-medium text-white shadow-lg transition-all duration-200 hover:from-[#E85D00] hover:to-[#E87A00] hover:shadow-xl" />
      </div>
      <div className="mt-6 text-left">
        <PasskeySmartAccountCard />
      </div>
    </div>
  );
}

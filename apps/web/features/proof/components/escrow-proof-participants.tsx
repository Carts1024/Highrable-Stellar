import { shortenWalletAddress } from "@/features/marketplace/lib/wallet";
import { UserRound } from "lucide-react";
import Link from "next/link";

import type { TProofProfile } from "../types";

function getDisplayName(profile: TProofProfile | undefined, fallback: string): string {
  return profile?.companyName ?? profile?.name ?? fallback;
}

function ParticipantCard({
  label,
  walletAddress,
  profile,
  href,
}: {
  readonly label: string;
  readonly walletAddress: string;
  readonly profile?: TProofProfile;
  readonly href: string;
}) {
  return (
    <article className="rounded-xl border border-[#e8e8e8] bg-[#fafafa] p-4">
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-white p-2 text-[#FF7003]">
          <UserRound className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-[0.08em] text-[#7f7f7f] uppercase">
            {label}
          </p>
          <p className="mt-1 font-semibold text-[#0a0a0a]">
            {getDisplayName(profile, shortenWalletAddress(walletAddress))}
          </p>
          <Link
            href={href}
            className="mt-1 inline-block text-sm font-medium break-all text-[#FF7003] hover:text-[#E85D00]"
          >
            {shortenWalletAddress(walletAddress)}
          </Link>
        </div>
      </div>
    </article>
  );
}

export function EscrowProofParticipants({
  clientWallet,
  freelancerWallet,
  clientProfile,
  freelancerProfile,
}: {
  readonly clientWallet: string;
  readonly freelancerWallet?: string;
  readonly clientProfile?: TProofProfile;
  readonly freelancerProfile?: TProofProfile;
}) {
  return (
    <section className="rounded-2xl border border-[#e8e8e8] bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold text-[#0a0a0a]">Participants</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <ParticipantCard
          label="Client"
          walletAddress={clientWallet}
          profile={clientProfile}
          href={`/clients/${encodeURIComponent(clientWallet)}`}
        />
        {freelancerWallet ? (
          <ParticipantCard
            label="Freelancer"
            walletAddress={freelancerWallet}
            profile={freelancerProfile}
            href={`/freelancers/${encodeURIComponent(freelancerWallet)}`}
          />
        ) : (
          <article className="rounded-xl border border-dashed border-[#e8e8e8] bg-[#fafafa] p-4 text-sm text-[#5f5f5f]">
            No freelancer assigned.
          </article>
        )}
      </div>
    </section>
  );
}

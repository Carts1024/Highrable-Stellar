"use client";

import { useWallet } from "@/core/wallet/hooks/use-wallet";
import { isSameWallet } from "@/features/marketplace/lib/wallet";

import type { TActorRole, TEscrowStatus, TJobStatus } from "@/features/marketplace/types";
import type { TConvexDoc } from "@repo/convex-client";

import { StatusBadge } from "./status-badge";

function detectRole(
  connectedWallet: string | null,
  job: TConvexDoc<"jobs">,
  applications: TConvexDoc<"applications">[],
): TActorRole {
  if (!connectedWallet) {
    return "guest";
  }

  if (isSameWallet(connectedWallet, job.clientWallet)) {
    return "client";
  }

  if (isSameWallet(connectedWallet, job.selectedFreelancerWallet ?? null)) {
    return "selectedFreelancer";
  }

  const isApplicant = applications.some((application) =>
    isSameWallet(application.freelancerWallet, connectedWallet),
  );

  if (isApplicant) {
    return "applicant";
  }

  return "other";
}

function getCurrentStatus(
  job: TConvexDoc<"jobs">,
  escrow: TConvexDoc<"escrows"> | null | undefined,
): TJobStatus | TEscrowStatus {
  if (escrow) {
    return escrow.status;
  }

  return job.status;
}

export function EscrowActionPanel({
  job,
  escrow,
  applications,
}: {
  job: TConvexDoc<"jobs">;
  escrow: TConvexDoc<"escrows"> | null | undefined;
  applications: TConvexDoc<"applications">[];
}) {
  const { address, walletState } = useWallet();
  const role = detectRole(address, job, applications);
  const currentStatus = getCurrentStatus(job, escrow);

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Escrow Action Panel</h2>
        <StatusBadge label={currentStatus} />
      </div>

      {currentStatus === "open" ? (
        <p className="text-sm text-gray-700">Waiting for client to select a freelancer.</p>
      ) : null}

      {currentStatus === "selected" && !escrow ? (
        <div className="space-y-3">
          {role === "client" ? (
            <>
              <button
                type="button"
                disabled
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-500"
              >
                Create Escrow
              </button>
              <p className="text-sm text-gray-600">
                Smart contract action will be enabled in Phase 9.
              </p>
            </>
          ) : null}

          {role === "selectedFreelancer" ? (
            <p className="text-sm text-amber-800">
              Waiting for client to create and fund escrow. Do not start work yet.
            </p>
          ) : null}

          {role !== "client" && role !== "selectedFreelancer" ? (
            <p className="text-sm text-gray-700">
              Client has selected a freelancer. Escrow setup is next.
            </p>
          ) : null}
        </div>
      ) : null}

      {currentStatus === "created" ? (
        <div className="space-y-3">
          {role === "client" ? (
            <>
              <button
                type="button"
                disabled
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-500"
              >
                Fund Escrow
              </button>
              <p className="text-sm text-gray-600">
                Smart contract action will be enabled in Phase 9.
              </p>
            </>
          ) : null}

          {role === "selectedFreelancer" ? (
            <p className="text-sm text-amber-800">Escrow created. Waiting for client to fund.</p>
          ) : null}
        </div>
      ) : null}

      {currentStatus === "funded" ? (
        <div className="space-y-3">
          {role === "selectedFreelancer" ? (
            <>
              <button
                type="button"
                disabled
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-500"
              >
                Submit Work
              </button>
              <p className="text-sm text-gray-600">
                Smart contract action will be enabled in Phase 9.
              </p>
            </>
          ) : null}

          {role === "client" ? (
            <p className="text-sm text-gray-700">
              Escrow funded. Waiting for freelancer submission.
            </p>
          ) : null}

          {role !== "client" && role !== "selectedFreelancer" ? (
            <p className="text-sm text-gray-700">
              Verified funded means the client has locked funds on Stellar.
            </p>
          ) : null}
        </div>
      ) : null}

      {currentStatus === "submitted" ? (
        <div className="space-y-3">
          {role === "client" ? (
            <>
              <button
                type="button"
                disabled
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-500"
              >
                Approve and Release
              </button>
              <p className="text-sm text-gray-600">
                Smart contract action will be enabled in Phase 9.
              </p>
            </>
          ) : null}

          {role === "selectedFreelancer" ? (
            <p className="text-sm text-gray-700">Work submitted. Waiting for client approval.</p>
          ) : null}
        </div>
      ) : null}

      {currentStatus === "released" || currentStatus === "completed" ? (
        <div className="space-y-2 text-sm text-emerald-800">
          <p>Payment released. Verified work record available.</p>
          <p>Leave/View Verified Review (coming soon).</p>
        </div>
      ) : null}

      {currentStatus === "cancelled" ? (
        <p className="text-sm text-gray-700">Escrow cancelled.</p>
      ) : null}

      {currentStatus === "disputed" ? (
        <p className="text-sm text-red-700">Escrow disputed. Manual review required.</p>
      ) : null}

      {walletState.isTestnet && walletState.isFunded === false ? (
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          You can continue off-chain actions in Phase 8, but on-chain escrow actions in later steps
          need a funded testnet account.
        </p>
      ) : null}
    </section>
  );
}

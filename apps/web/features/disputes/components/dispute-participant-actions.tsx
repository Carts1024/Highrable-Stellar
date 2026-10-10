"use client";

import { useHighrableWalletIdentity } from "@/core/wallet/hooks/use-highrable-wallet-identity";
import { api } from "@repo/convex-client";
import { useQuery } from "convex/react";
import React, { Component } from "react";

import type { TWalletType } from "@/features/attachments/types";
import type { TConvexId } from "@repo/convex-client";
import type { ReactNode } from "react";

import { DisputeEvidenceComposer } from "./dispute-evidence-composer";
import { DisputeResponseComposer } from "./dispute-response-composer";
import {
  useParticipantActionSession,
  type TParticipantActionSession,
} from "./participant-action-session";

class ParticipantActionsErrorBoundary extends Component<
  { readonly children: (retryKey: number) => ReactNode },
  { readonly hasError: boolean; readonly retryKey: number }
> {
  state = { hasError: false, retryKey: 0 };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          <p>Unable to check whether you can add evidence or respond.</p>
          <button
            type="button"
            className="mt-2 underline"
            onClick={() =>
              this.setState(({ retryKey }) => ({ hasError: false, retryKey: retryKey + 1 }))
            }
          >
            Retry participant actions
          </button>
        </div>
      );
    }
    return this.props.children(this.state.retryKey);
  }
}

function ParticipantActionsQuery({
  disputeId,
  walletAddress,
  walletType,
  session,
}: {
  readonly disputeId: TConvexId<"disputes">;
  readonly walletAddress: string;
  readonly walletType: TWalletType;
  readonly session: TParticipantActionSession;
}) {
  const permission = useQuery(api.disputes.canRespondToDispute, { disputeId, walletAddress });

  if (permission === undefined) {
    return (
      <p role="status" className="text-sm text-[#5f5f5f]">
        Checking participant actions...
      </p>
    );
  }
  if (!permission.allowed || !permission.role) {
    return (
      <p className="rounded-lg border border-[#e8e8e8] bg-[#fafafa] p-4 text-sm text-[#5f5f5f]">
        {permission.reason ?? "This dispute is not accepting new evidence or responses."}
      </p>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <DisputeEvidenceComposer
        disputeId={disputeId}
        walletAddress={walletAddress}
        walletType={walletType}
        role={permission.role}
        session={session.evidence}
      />
      <DisputeResponseComposer
        disputeId={disputeId}
        walletAddress={walletAddress}
        walletType={walletType}
        role={permission.role}
        session={session.response}
      />
    </div>
  );
}

function ParticipantActionSession({
  disputeId,
  walletAddress,
  walletType,
  viewerWallet,
}: {
  readonly disputeId: TConvexId<"disputes">;
  readonly walletAddress: string;
  readonly walletType: TWalletType;
  readonly viewerWallet: string;
}) {
  const session = useParticipantActionSession();

  return (
    <ParticipantActionsErrorBoundary key={`${disputeId}:${viewerWallet}`}>
      {(retryKey) => (
        <ParticipantActionsQuery
          key={retryKey}
          disputeId={disputeId}
          walletAddress={walletAddress}
          walletType={walletType}
          session={session}
        />
      )}
    </ParticipantActionsErrorBoundary>
  );
}

export function DisputeParticipantActions({
  disputeId,
  viewerWallet,
}: {
  readonly disputeId: TConvexId<"disputes">;
  readonly viewerWallet: string;
}) {
  const walletIdentity = useHighrableWalletIdentity();
  const walletAddress = walletIdentity.walletAddress;
  const walletType = walletIdentity.walletType;

  if (!walletAddress || !walletType) return null;

  const sessionKey = `${disputeId}:${walletAddress}:${walletType}`;

  return (
    <ParticipantActionSession
      key={sessionKey}
      disputeId={disputeId}
      walletAddress={walletAddress}
      walletType={walletType}
      viewerWallet={viewerWallet}
    />
  );
}

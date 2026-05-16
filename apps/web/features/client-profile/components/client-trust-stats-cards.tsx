import {
  formatAssetAmountList,
  formatPercent,
} from "@/features/client-profile/lib/client-profile-format";
import { Badge } from "@repo/ui/components/ui/badge";
import {
  AlertTriangle,
  Briefcase,
  CheckCircle,
  DollarSign,
  ShieldCheck,
  XCircle,
} from "lucide-react";

import type { TClientTrustStats } from "@/features/client-profile/types";
import type { LucideIcon } from "lucide-react";

type TStatCard = {
  readonly label: string;
  readonly value: string;
  readonly helper: string;
  readonly Icon: LucideIcon;
};

function StatCard({ label, value, helper, Icon }: TStatCard) {
  return (
    <article className="rounded-xl border border-[#e8e8e8] bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-xs font-semibold tracking-[0.08em] text-[#7f7f7f] uppercase">{label}</p>
        <Icon className="h-4 w-4 text-[#FF7003]" aria-hidden="true" />
      </div>
      <p className="text-2xl font-semibold text-[#0a0a0a]">{value}</p>
      <p className="mt-1 text-sm text-[#5f5f5f]">{helper}</p>
    </article>
  );
}

export function ClientTrustStatsCards({ stats }: { readonly stats: TClientTrustStats }) {
  const totalFunded = formatAssetAmountList(
    stats.totalEscrowFundedByAsset,
    "No funded escrow history yet.",
  );
  const totalPaid = formatAssetAmountList(stats.totalPaidByAsset, "No completed payments yet.");

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-[#0a0a0a]">Escrow behavior stats</h2>
        <div className="flex flex-wrap gap-2">
          {stats.disputedEscrows > 0 ? (
            <Badge variant="outline" className="border-red-200 bg-red-50 text-red-800">
              Dispute activity recorded
            </Badge>
          ) : null}
          {stats.fundedEscrows === 0 ? (
            <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">
              No funded escrow history yet
            </Badge>
          ) : null}
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Jobs posted"
          value={stats.jobsPosted.toString()}
          helper="Jobs created by this wallet"
          Icon={Briefcase}
        />
        <StatCard
          label="Escrows funded"
          value={stats.fundedEscrows.toString()}
          helper={`${stats.escrowsCreated} escrow${stats.escrowsCreated === 1 ? "" : "s"} created`}
          Icon={ShieldCheck}
        />
        <StatCard
          label="Completed payments"
          value={stats.completedEscrows.toString()}
          helper="Released Stellar escrow payments"
          Icon={CheckCircle}
        />
        <StatCard
          label="Total escrow funded"
          value={totalFunded}
          helper="Funded, submitted, and released escrows by asset"
          Icon={DollarSign}
        />
        <StatCard
          label="Total paid"
          value={totalPaid}
          helper="Released payments grouped by asset"
          Icon={DollarSign}
        />
        <StatCard
          label="Funding reliability"
          value={formatPercent(stats.fundingReliabilityRate)}
          helper="Funded escrows divided by created escrows"
          Icon={ShieldCheck}
        />
        <StatCard
          label="Disputed escrows"
          value={stats.disputedEscrows.toString()}
          helper={`${formatPercent(stats.disputeRate)} dispute rate`}
          Icon={AlertTriangle}
        />
        <StatCard
          label="Cancelled escrows"
          value={stats.cancelledEscrows.toString()}
          helper={`${formatPercent(stats.cancellationRate)} cancellation rate`}
          Icon={XCircle}
        />
      </div>
    </section>
  );
}

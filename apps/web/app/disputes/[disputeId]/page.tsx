import { parseConvexIdParam } from "@/core/seo";
import { DisputeDetailPanel } from "@/features/disputes";
import { notFound } from "next/navigation";

export default async function DisputeDetailPage({
  params,
}: {
  readonly params: Promise<{ disputeId: string }>;
}) {
  const { disputeId } = await params;
  const parsedDisputeId = parseConvexIdParam(disputeId);

  if (!parsedDisputeId) {
    notFound();
  }

  return (
    <div>
      <DisputeDetailPanel disputeId={parsedDisputeId} />
    </div>
  );
}

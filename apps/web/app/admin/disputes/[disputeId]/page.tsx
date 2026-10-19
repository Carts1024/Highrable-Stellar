import { AdminDisputeDetailPage } from "@/features/admin";

export default async function AdminDisputeDetailRoutePage({
  params,
}: {
  readonly params: Promise<{ disputeId: string }>;
}) {
  const { disputeId } = await params;

  return (
    <div className="mx-auto max-w-6xl">
      <AdminDisputeDetailPage disputeId={disputeId} />
    </div>
  );
}

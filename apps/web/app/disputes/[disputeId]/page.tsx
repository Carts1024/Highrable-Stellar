import { DisputeDetailPanel } from "@/features/disputes";

export default async function DisputeDetailPage({
  params,
}: {
  readonly params: Promise<{ disputeId: string }>;
}) {
  const { disputeId } = await params;

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <DisputeDetailPanel disputeId={disputeId} />
    </main>
  );
}

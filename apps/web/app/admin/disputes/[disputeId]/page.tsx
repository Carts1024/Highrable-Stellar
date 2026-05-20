import { AdminDisputeDetailPage } from "@/features/admin";

export default async function AdminDisputeDetailRoutePage({
  params,
}: {
  readonly params: Promise<{ disputeId: string }>;
}) {
  const { disputeId } = await params;

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <AdminDisputeDetailPage disputeId={disputeId} />
    </main>
  );
}

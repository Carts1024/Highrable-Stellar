import { JobDetailPage } from "@/features/marketplace";
import { notFound } from "next/navigation";

export default async function MarketplaceJobDetailRoutePage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const resolvedParams = await params;

  if (!resolvedParams.jobId) {
    notFound();
  }

  return <JobDetailPage jobId={resolvedParams.jobId} />;
}

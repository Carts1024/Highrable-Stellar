import { FreelancerAgreementReview } from "@/features/work-agreements";

import type { TConvexId } from "@repo/convex-client";

export default async function WorkAgreementReviewPage({
  params,
}: {
  params: Promise<{ agreementId: string }>;
}) {
  const { agreementId } = await params;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <FreelancerAgreementReview agreementId={agreementId as TConvexId<"workAgreements">} />
    </main>
  );
}

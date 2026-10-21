import { FreelancerAgreementReview } from "@/features/work-agreements";

import type { TConvexId } from "@repo/convex-client";

export default async function WorkAgreementReviewPage({
  params,
}: {
  params: Promise<{ agreementId: string }>;
}) {
  const { agreementId } = await params;

  return (
    <div className="mx-auto max-w-4xl">
      <FreelancerAgreementReview agreementId={agreementId as TConvexId<"workAgreements">} />
    </div>
  );
}

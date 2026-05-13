import {
  buildJobPostingJsonLd,
  buildNoIndexMetadata,
  buildPageMetadata,
  parseConvexIdParam,
  sanitizeSeoText,
  SeoJsonLd,
} from "@/core/seo";
import {
  createSeoConvexClient,
  seoApi,
  type TSeoConvexDoc,
  type TSeoConvexId,
} from "@/core/seo/convex";
import { JobDetailPage } from "@/features/marketplace";
import { notFound } from "next/navigation";

import type { Metadata } from "next";

interface IMarketplaceJobDetailRouteProps {
  readonly params: Promise<{ readonly jobId: string }>;
}

const NOT_FOUND_TITLE = "Job Not Found";
const NOT_FOUND_DESCRIPTION = "This Highrable job could not be found or is no longer available.";

async function getJobForSeo(
  jobId: TSeoConvexId<"jobs">,
): Promise<TSeoConvexDoc<"jobs"> | null> {
  try {
    const convex = createSeoConvexClient();
    return await convex.query(seoApi.jobs.getJob, { jobId });
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: IMarketplaceJobDetailRouteProps): Promise<Metadata> {
  const { jobId } = await params;
  const parsedJobId = parseConvexIdParam(jobId);
  const path = `/marketplace/jobs/${encodeURIComponent(parsedJobId ?? "invalid")}`;

  if (!parsedJobId) {
    return buildNoIndexMetadata(NOT_FOUND_TITLE, NOT_FOUND_DESCRIPTION, path);
  }

  const job = await getJobForSeo(parsedJobId as TSeoConvexId<"jobs">);

  if (!job) {
    return buildNoIndexMetadata(NOT_FOUND_TITLE, NOT_FOUND_DESCRIPTION, path);
  }

  const title = sanitizeSeoText(job.title, "Highrable Job");
  const description = sanitizeSeoText(
    job.description,
    `${job.asset} ${job.budget} Stellar escrow-backed freelance job on Highrable.`,
  );

  return buildPageMetadata({
    title,
    description,
    path,
    type: "article",
    index: job.status !== "cancelled" && job.status !== "disputed",
  });
}

export default async function MarketplaceJobDetailRoutePage({
  params,
}: IMarketplaceJobDetailRouteProps) {
  const resolvedParams = await params;
  const parsedJobId = parseConvexIdParam(resolvedParams.jobId);

  if (!parsedJobId) {
    notFound();
  }

  const job = await getJobForSeo(parsedJobId as TSeoConvexId<"jobs">);

  return (
    <>
      {job ? (
        <SeoJsonLd
          id="job-posting-json-ld"
          data={buildJobPostingJsonLd({
            title: job.title,
            description: job.description,
            path: `/marketplace/jobs/${encodeURIComponent(parsedJobId)}`,
            createdAt: job.createdAt,
            budget: job.totalBudget ?? job.budget,
            asset: job.asset,
            clientWallet: job.clientWallet,
          })}
        />
      ) : null}
      <JobDetailPage jobId={parsedJobId} />
    </>
  );
}

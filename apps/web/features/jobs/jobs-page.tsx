"use client";

import { WalletConnectTrigger } from "@/core/wallet/components/wallet-connect-trigger";
import { useWallet } from "@/core/wallet/hooks/use-wallet";
import { JobList } from "@/features/jobs/components/job-list";
import { useJobs } from "@/features/jobs/hooks/use-jobs";
import { motion } from "framer-motion";

/** Renders the public job browsing experience. */
export function JobsPage() {
  const { jobs, loading, applyToJob } = useJobs();
  const { address, isConnected } = useWallet();

  const handleApply = async (jobId: string) => {
    if (!isConnected) {
      alert("Please connect your wallet to apply for jobs");
      return;
    }

    const proposal = prompt("Enter your proposal (for POC):");
    const rate = prompt("Enter your hourly rate:");

    if (proposal && rate && address) {
      await applyToJob(jobId, {
        freelancer: `Freelancer ${address.slice(0, 6)}...${address.slice(-4)}`,
        freelancerAddress: address,
        proposal,
        rate: parseFloat(rate),
        estimatedDuration: "2 weeks",
      });

      alert("Application submitted successfully!");
    }
  };

  return (
    <div className="space-y-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <h1 className="mb-4 text-4xl font-bold text-gray-900">
          Browse{" "}
          <span className="bg-linear-to-r from-[#FF7003] to-[#FF8801] bg-clip-text text-transparent">
            Web3 Jobs
          </span>
        </h1>
        <p className="mx-auto max-w-2xl text-lg text-gray-600">
          Discover trustless freelancing opportunities with guaranteed payments through smart
          contracts
        </p>
      </motion.div>

      {!isConnected && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-[#FF7003]/20 bg-linear-to-r from-[#FF7003]/10 to-[#FF8801]/10 p-8 text-center"
        >
          <h3 className="mb-4 text-xl font-semibold text-gray-900">
            Connect Your Wallet to Start Applying
          </h3>
          <p className="mb-6 text-gray-600">
            Connect your wallet to apply for jobs and access the full Web3 freelancing experience
          </p>
          <WalletConnectTrigger className="rounded-lg bg-linear-to-r from-[#FF7003] to-[#FF8801] px-6 py-2 font-medium text-white" />
        </motion.div>
      )}

      <JobList jobs={jobs} loading={loading} onApply={handleApply} />
    </div>
  );
}

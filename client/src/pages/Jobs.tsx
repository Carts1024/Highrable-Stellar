import React from 'react';
import { JobList } from '../components/Jobs/JobList';
import { useJobs } from '../hooks/useJobs';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { motion } from 'framer-motion';

export const Jobs: React.FC = () => {
  const { jobs, loading, applyToJob } = useJobs();
  const { isConnected, address } = useAccount();

  const handleApply = async (jobId: string) => {
    if (!isConnected) {
      alert('Please connect your wallet to apply for jobs');
      return;
    }

    // For POC, we'll just show a simple modal
    const proposal = prompt('Enter your proposal (for POC):');
    const rate = prompt('Enter your hourly rate:');
    
    if (proposal && rate && address) {
      await applyToJob(jobId, {
        freelancer: `Freelancer ${address.slice(0, 6)}...${address.slice(-4)}`,
        freelancerAddress: address,
        proposal,
        rate: parseFloat(rate),
        estimatedDuration: '2 weeks'
      });
      
      alert('Application submitted successfully!');
    }
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Browse <span className="bg-linear-to-r from-[#FF7003] to-[#FF8801] bg-clip-text text-transparent">Web3 Jobs</span>
        </h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Discover trustless freelancing opportunities with guaranteed payments through smart contracts
        </p>
      </motion.div>

      {/* Connect Wallet Prompt */}
      {!isConnected && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-linear-to-r from-[#FF7003]/10 to-[#FF8801]/10 rounded-2xl p-8 text-center border border-[#FF7003]/20"
        >
          <h3 className="text-xl font-semibold text-gray-900 mb-4">
            Connect Your Wallet to Start Applying
          </h3>
          <p className="text-gray-600 mb-6">
            Connect your wallet to apply for jobs and access the full Web3 freelancing experience
          </p>
          <ConnectButton />
        </motion.div>
      )}

      {/* Job List */}
      <JobList 
        jobs={jobs} 
        loading={loading} 
        onApply={handleApply}
      />
    </div>
  );
};
"use client";

import { WalletRequiredNotice } from "@/core/wallet/components/wallet-required-notice";
import { useWallet } from "@/core/wallet/hooks/use-wallet";
import { JobCard } from "@/features/jobs/components/job-card";
import { useJobs } from "@/features/jobs/hooks/use-jobs";
import { motion } from "framer-motion";
import { Award, Briefcase, CheckCircle, Clock, DollarSign, Target, Users } from "lucide-react";
import { useRouter } from "next/navigation";

/** Summarizes wallet-specific activity for the current Highrable user. */
export function DashboardPage() {
  const router = useRouter();
  const { address, isConnected } = useWallet();
  const { jobs, loading } = useJobs();

  const userJobs = jobs.filter(
    (job) =>
      job.clientAddress === address ||
      job.applications?.some((application) => application.freelancerAddress === address),
  );

  const stats = {
    totalJobs: userJobs.length,
    activeProjects: userJobs.filter((job) => job.status === "in_progress").length,
    completedProjects: userJobs.filter((job) => job.status === "completed").length,
    totalEarned: userJobs
      .filter((job) => job.status === "completed")
      .reduce((sum, job) => sum + job.budget, 0),
  };

  if (!isConnected) {
    return (
      <WalletRequiredNotice
        title="Access Your Dashboard"
        description="Connect your wallet to view your projects, earnings, and manage your Web3 freelancing journey"
      />
    );
  }

  return (
    <div className="space-y-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <h1 className="mb-4 text-4xl font-bold text-gray-900">
          Your{" "}
          <span className="bg-linear-to-r from-[#FF7003] to-[#FF8801] bg-clip-text text-transparent">
            Dashboard
          </span>
        </h1>
        <p className="text-lg text-gray-600">
          Welcome back! Here's an overview of your Web3 freelancing activity
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4"
      >
        {[
          {
            title: "Total Projects",
            value: stats.totalJobs.toString(),
            icon: Briefcase,
            color: "from-[#FF7003] to-[#FF8801]",
            bgColor: "from-[#FF7003]/10 to-[#FF8801]/10",
          },
          {
            title: "Active Projects",
            value: stats.activeProjects.toString(),
            icon: Clock,
            color: "from-blue-500 to-blue-600",
            bgColor: "from-blue-500/10 to-blue-600/10",
          },
          {
            title: "Completed",
            value: stats.completedProjects.toString(),
            icon: CheckCircle,
            color: "from-green-500 to-green-600",
            bgColor: "from-green-500/10 to-green-600/10",
          },
          {
            title: "Total Earned",
            value: `$${stats.totalEarned.toLocaleString()}`,
            icon: DollarSign,
            color: "from-purple-500 to-purple-600",
            bgColor: "from-purple-500/10 to-purple-600/10",
          },
        ].map((stat, index) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + index * 0.1 }}
              className={`rounded-2xl border border-gray-100 bg-linear-to-br ${stat.bgColor} p-6`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                  <p className="mt-1 text-2xl font-bold text-gray-900">{stat.value}</p>
                </div>
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-xl bg-linear-to-br ${stat.color}`}
                >
                  <Icon className="h-6 w-6 text-white" />
                </div>
              </div>
            </motion.div>
          );
        })}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm"
      >
        <h2 className="mb-4 text-xl font-semibold text-gray-900">Quick Actions</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <button
            onClick={() => router.push("/jobs")}
            className="group flex items-center space-x-3 rounded-lg border border-gray-200 p-4 transition-all duration-200 hover:border-[#FF7003] hover:bg-[#FF7003]/5"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-linear-to-br from-[#FF7003] to-[#FF8801]">
              <Briefcase className="h-5 w-5 text-white" />
            </div>
            <div className="text-left">
              <p className="font-medium text-gray-900 group-hover:text-[#FF7003]">Browse Jobs</p>
              <p className="text-sm text-gray-600">Find new opportunities</p>
            </div>
          </button>

          <button
            onClick={() => router.push("/post-job")}
            className="group flex items-center space-x-3 rounded-lg border border-gray-200 p-4 transition-all duration-200 hover:border-[#FF7003] hover:bg-[#FF7003]/5"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-linear-to-br from-blue-500 to-blue-600">
              <Users className="h-5 w-5 text-white" />
            </div>
            <div className="text-left">
              <p className="font-medium text-gray-900 group-hover:text-[#FF7003]">Post a Job</p>
              <p className="text-sm text-gray-600">Hire talented freelancers</p>
            </div>
          </button>

          <button className="group flex items-center space-x-3 rounded-lg border border-gray-200 p-4 transition-all duration-200 hover:border-[#FF7003] hover:bg-[#FF7003]/5">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-linear-to-br from-green-500 to-green-600">
              <Award className="h-5 w-5 text-white" />
            </div>
            <div className="text-left">
              <p className="font-medium text-gray-900 group-hover:text-[#FF7003]">View Profile</p>
              <p className="text-sm text-gray-600">Manage your reputation</p>
            </div>
          </button>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="space-y-6"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-gray-900">Your Projects</h2>
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <Target className="h-4 w-4" />
            <span>{userJobs.length} total projects</span>
          </div>
        </div>

        {loading ? (
          <div className="space-y-6">
            {[...Array(2)].map((_, index) => (
              <div key={index} className="rounded-2xl border border-gray-100 bg-white p-6">
                <div className="animate-pulse">
                  <div className="mb-4 flex items-start justify-between">
                    <div className="flex-1 space-y-2">
                      <div className="h-6 w-3/4 rounded bg-gray-200"></div>
                      <div className="h-4 w-1/2 rounded bg-gray-200"></div>
                    </div>
                    <div className="h-8 w-20 rounded bg-gray-200"></div>
                  </div>
                  <div className="space-y-2">
                    <div className="h-4 rounded bg-gray-200"></div>
                    <div className="h-4 w-5/6 rounded bg-gray-200"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : userJobs.length === 0 ? (
          <div className="rounded-2xl border border-gray-100 bg-white py-12 text-center">
            <Briefcase className="mx-auto mb-4 h-16 w-16 text-gray-300" />
            <h3 className="mb-2 text-xl font-medium text-gray-700">No projects yet</h3>
            <p className="mb-6 text-gray-500">
              Start your Web3 freelancing journey by browsing jobs or posting a project
            </p>
            <div className="flex justify-center space-x-4">
              <button
                onClick={() => router.push("/jobs")}
                className="rounded-lg bg-linear-to-r from-[#FF7003] to-[#FF8801] px-6 py-3 font-medium text-white transition-all duration-200 hover:from-[#E85D00] hover:to-[#E87A00]"
              >
                Browse Jobs
              </button>
              <button
                onClick={() => router.push("/post-job")}
                className="rounded-lg border-2 border-[#FF7003] bg-white px-6 py-3 font-medium text-[#FF7003] transition-all duration-200 hover:bg-[#FF7003] hover:text-white"
              >
                Post a Job
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {userJobs.slice(0, 3).map((job) => (
              <JobCard key={job.id} job={job} showApplications={job.clientAddress === address} />
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}

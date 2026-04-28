"use client";

import { motion } from "framer-motion";
import { Calendar, CheckCircle, User } from "lucide-react";

import type { Job } from "@/features/jobs/types";

type JobCardProps = {
  job: Job;
  onApply?: (jobId: string) => void;
  showApplications?: boolean;
  onViewApplications?: (jobId: string) => void;
};

const STATUS_STYLES: Record<Job["status"], string> = {
  open: "bg-green-100 text-green-800",
  in_progress: "bg-blue-100 text-blue-800",
  completed: "bg-gray-100 text-gray-800",
  disputed: "bg-red-100 text-red-800",
};

function getMilestoneProgress(job: Job) {
  const totalMilestones = job.milestones.length;
  const completedMilestones = job.milestones.filter(
    (milestone) => milestone.status === "approved",
  ).length;
  const progress = totalMilestones === 0 ? 0 : (completedMilestones / totalMilestones) * 100;

  return { completedMilestones, totalMilestones, progress };
}

/** Displays a single marketplace job with status, milestones, and call-to-action buttons. */
export function JobCard({
  job,
  onApply,
  showApplications = false,
  onViewApplications,
}: JobCardProps) {
  const { completedMilestones, totalMilestones, progress } = getMilestoneProgress(job);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -5 }}
      className="overflow-hidden rounded-2xl border border-gray-100 bg-white transition-all duration-300 hover:border-[#FF7003]/20 hover:shadow-2xl"
    >
      <div className="border-b border-gray-50 p-6">
        <div className="mb-4 flex items-start justify-between">
          <div className="flex-1">
            <h3 className="mb-2 line-clamp-2 text-xl font-semibold text-gray-900">{job.title}</h3>
            <div className="mb-3 flex items-center space-x-4 text-sm text-gray-600">
              <div className="flex items-center space-x-1">
                <User className="h-4 w-4" />
                <span>{job.client}</span>
              </div>
              <div className="flex items-center space-x-1">
                <Calendar className="h-4 w-4" />
                <span>{new Date(job.deadline).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end space-y-2">
            <span
              className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${STATUS_STYLES[job.status]}`}
            >
              {job.status.replace("_", " ")}
            </span>
            <div className="text-right">
              <div className="text-2xl font-bold text-[#FF7003]">
                ${job.budget.toLocaleString()}
              </div>
              <div className="text-xs text-gray-500">Total Budget</div>
            </div>
          </div>
        </div>

        <p className="mb-4 line-clamp-3 text-sm leading-relaxed text-gray-600">{job.description}</p>

        <div className="mb-4 flex flex-wrap gap-2">
          {job.skills.slice(0, 4).map((skill) => (
            <span
              key={skill}
              className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700"
            >
              {skill}
            </span>
          ))}
          {job.skills.length > 4 ? (
            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-500">
              +{job.skills.length - 4} more
            </span>
          ) : null}
        </div>

        <div className="mb-4">
          <div className="mb-2 flex items-center justify-between text-sm text-gray-600">
            <span className="flex items-center space-x-1">
              <CheckCircle className="h-4 w-4" />
              <span>Milestones</span>
            </span>
            <span>
              {completedMilestones} of {totalMilestones} completed
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-gray-200">
            <div
              className="h-2 rounded-full bg-linear-to-r from-[#FF7003] to-[#FF8801] transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {showApplications ? (
          <div className="mb-4 flex items-center space-x-1 text-sm text-gray-600">
            <User className="h-4 w-4" />
            <span>{job.applications?.length || 0} applications</span>
          </div>
        ) : null}
      </div>

      <div className="bg-gray-50 p-6">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-500">
            Posted {new Date(job.createdAt).toLocaleDateString()}
          </div>
          <div className="flex space-x-3">
            {showApplications && onViewApplications ? (
              <button
                onClick={() => onViewApplications(job.id)}
                className="rounded-lg border border-[#FF7003] px-4 py-2 text-sm font-medium text-[#FF7003] transition-all duration-200 hover:bg-[#FF7003] hover:text-white"
              >
                View Applications
              </button>
            ) : null}
            {onApply && job.status === "open" ? (
              <button
                onClick={() => onApply(job.id)}
                className="rounded-lg bg-linear-to-r from-[#FF7003] to-[#FF8801] px-4 py-2 text-sm font-medium text-white shadow-md transition-all duration-200 hover:from-[#E85D00] hover:to-[#E87A00] hover:shadow-lg"
              >
                Apply Now
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

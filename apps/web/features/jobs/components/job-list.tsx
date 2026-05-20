"use client";

import { motion } from "framer-motion";
import { Briefcase, Search } from "lucide-react";
import { useState } from "react";

import type { Job } from "@/features/jobs/types";

import { JobCard } from "./job-card";

type JobListProps = {
  jobs: Job[];
  loading: boolean;
  onApply?: (jobId: string) => void;
  showApplications?: boolean;
  onViewApplications?: (jobId: string) => void;
};

type JobSortOption = "newest" | "budget_high" | "budget_low" | "deadline";
type JobStatusFilter = Job["status"] | "all";

const JOB_SORTERS: Record<JobSortOption, (left: Job, right: Job) => number> = {
  newest: (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  budget_high: (left, right) => right.budget - left.budget,
  budget_low: (left, right) => left.budget - right.budget,
  deadline: (left, right) => new Date(left.deadline).getTime() - new Date(right.deadline).getTime(),
};

/** Displays the searchable job directory and reusable loading states. */
export function JobList({
  jobs,
  loading,
  onApply,
  showApplications = false,
  onViewApplications,
}: JobListProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<JobStatusFilter>("all");
  const [sortBy, setSortBy] = useState<JobSortOption>("newest");

  const filteredJobs = jobs
    .filter((job) => {
      const normalizedSearchTerm = searchTerm.toLowerCase();
      const matchesSearch =
        job.title.toLowerCase().includes(normalizedSearchTerm) ||
        job.description.toLowerCase().includes(normalizedSearchTerm) ||
        job.skills.some((skill) => skill.toLowerCase().includes(normalizedSearchTerm));
      const matchesStatus = filterStatus === "all" || job.status === filterStatus;

      return matchesSearch && matchesStatus;
    })
    .sort(JOB_SORTERS[sortBy]);

  if (loading) {
    return (
      <div className="space-y-6">
        {[...Array(3)].map((_, index) => (
          <div key={index} className="rounded-2xl border border-gray-100 bg-white p-6">
            <div className="animate-pulse">
              <div className="mb-4 flex items-start justify-between">
                <div className="flex-1 space-y-2">
                  <div className="h-6 w-3/4 rounded bg-gray-200"></div>
                  <div className="h-4 w-1/2 rounded bg-gray-200"></div>
                </div>
                <div className="h-8 w-20 rounded bg-gray-200"></div>
              </div>
              <div className="mb-4 space-y-2">
                <div className="h-4 rounded bg-gray-200"></div>
                <div className="h-4 w-5/6 rounded bg-gray-200"></div>
              </div>
              <div className="flex space-x-2">
                {[...Array(3)].map((_, skillIndex) => (
                  <div key={skillIndex} className="h-6 w-16 rounded-full bg-gray-200"></div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm"
      >
        <div className="flex flex-col gap-4 lg:flex-row">
          <div className="relative flex-1">
            <Search className="absolute top-3 left-3 h-5 w-5 text-gray-400" />
            <input
              type="text"
              aria-label="Search jobs"
              placeholder="Search jobs, skills, or descriptions..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="w-full rounded-lg border border-gray-200 py-3 pr-4 pl-10 transition-all duration-200 focus:border-[#FF7003] focus:ring-2 focus:ring-[#FF7003]"
            />
          </div>

          <div className="flex space-x-3">
            <select
              value={filterStatus}
              onChange={(event) => setFilterStatus(event.target.value as JobStatusFilter)}
              className="rounded-lg border border-gray-200 px-4 py-3 transition-all duration-200 focus:border-[#FF7003] focus:ring-2 focus:ring-[#FF7003]"
            >
              <option value="all">All Status</option>
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
            </select>

            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as JobSortOption)}
              className="rounded-lg border border-gray-200 px-4 py-3 transition-all duration-200 focus:border-[#FF7003] focus:ring-2 focus:ring-[#FF7003]"
            >
              <option value="newest">Newest First</option>
              <option value="budget_high">Highest Budget</option>
              <option value="budget_low">Lowest Budget</option>
              <option value="deadline">Deadline Soon</option>
            </select>
          </div>
        </div>
      </motion.div>

      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Briefcase className="h-5 w-5 text-[#FF7003]" />
          <span className="font-medium text-gray-700">{filteredJobs.length} jobs found</span>
        </div>
      </div>

      {filteredJobs.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-16 text-center">
          <Briefcase className="mx-auto mb-4 h-16 w-16 text-gray-300" />
          <h3 className="mb-2 text-xl font-medium text-gray-700">No jobs found</h3>
          <p className="text-gray-500">
            {searchTerm ? "Try adjusting your search terms" : "New opportunities are posted daily"}
          </p>
        </motion.div>
      ) : (
        <div className="grid gap-6">
          {filteredJobs.map((job, index) => (
            <motion.div
              key={job.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <JobCard
                job={job}
                onApply={onApply}
                showApplications={showApplications}
                onViewApplications={onViewApplications}
              />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

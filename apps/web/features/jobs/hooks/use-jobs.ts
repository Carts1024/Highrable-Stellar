"use client";

import { useEffect, useState } from "react";

import type { Application, Job } from "@/features/jobs/types";

// Mock data for POC - replace with actual smart contract calls
const mockJobs: Job[] = [
  {
    id: "1",
    title: "React Developer for DeFi Dashboard",
    description:
      "Build a comprehensive DeFi dashboard with real-time data visualization, wallet integration, and responsive design.",
    budget: 2500,
    deadline: "2025-02-15",
    skills: ["React", "TypeScript", "Web3", "Tailwind CSS"],
    client: "CryptoVentures",
    status: "open",
    milestones: [
      {
        id: "1-1",
        title: "UI/UX Design & Setup",
        description: "Create wireframes and set up project structure",
        amount: 750,
        dueDate: "2025-01-25",
        status: "pending",
      },
      {
        id: "1-2",
        title: "Core Dashboard Development",
        description: "Implement main dashboard with data visualization",
        amount: 1000,
        dueDate: "2025-02-05",
        status: "pending",
      },
      {
        id: "1-3",
        title: "Testing & Deployment",
        description: "Final testing and deployment to production",
        amount: 750,
        dueDate: "2025-02-15",
        status: "pending",
      },
    ],
    createdAt: "2025-01-10",
    applications: [],
  },
  {
    id: "2",
    title: "Smart Contract Audit & Security Review",
    description:
      "Comprehensive security audit for NFT marketplace smart contracts including gas optimization.",
    budget: 5000,
    deadline: "2025-02-20",
    skills: ["Solidity", "Security Audit", "Gas Optimization"],
    client: "NFT Marketplace Co",
    status: "open",
    milestones: [
      {
        id: "2-1",
        title: "Initial Code Review",
        description: "Review contract architecture and identify potential issues",
        amount: 2000,
        dueDate: "2025-02-01",
        status: "pending",
      },
      {
        id: "2-2",
        title: "Security Testing & Report",
        description: "Conduct thorough security testing and provide detailed report",
        amount: 3000,
        dueDate: "2025-02-20",
        status: "pending",
      },
    ],
    createdAt: "2025-01-08",
    applications: [],
  },
];

export function useJobs() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setJobs(mockJobs);
      setLoading(false);
    }, 1000);

    return () => window.clearTimeout(timeoutId);
  }, []);

  const createJob = async (jobData: Omit<Job, "id" | "createdAt" | "status" | "applications">) => {
    const newJob: Job = {
      ...jobData,
      id: Date.now().toString(),
      status: "open",
      createdAt: new Date().toISOString(),
      applications: [],
    };
    setJobs((prev) => [newJob, ...prev]);
    return newJob;
  };

  const applyToJob = async (
    jobId: string,
    application: Omit<Application, "id" | "submittedAt" | "status">,
  ) => {
    const newApplication: Application = {
      ...application,
      id: Date.now().toString(),
      status: "pending",
      submittedAt: new Date().toISOString(),
    };

    setJobs((prev) =>
      prev.map((job) =>
        job.id === jobId
          ? { ...job, applications: [...(job.applications || []), newApplication] }
          : job,
      ),
    );
  };

  const acceptApplication = async (jobId: string, applicationId: string) => {
    setJobs((prev) =>
      prev.map((job) =>
        job.id === jobId
          ? {
              ...job,
              status: "in_progress",
              applications: job.applications?.map((app) =>
                app.id === applicationId
                  ? { ...app, status: "accepted" as const }
                  : { ...app, status: "rejected" as const },
              ),
            }
          : job,
      ),
    );
  };

  return { jobs, loading, createJob, applyToJob, acceptApplication };
}

"use client";

import { WalletRequiredNotice } from "@/core/wallet/components/wallet-required-notice";
import { useHighrableWalletIdentity } from "@/core/wallet/hooks/use-highrable-wallet-identity";
import { useJobs } from "@/features/jobs/hooks/use-jobs";
import { motion } from "framer-motion";
import { Calendar, DollarSign, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

type JobFormState = {
  title: string;
  description: string;
  budget: string;
  deadline: string;
  skills: string[];
};

type MilestoneDraft = {
  title: string;
  description: string;
  amount: string;
  dueDate: string;
};

/** Renders the job creation flow for wallet-connected clients. */
export function PostJobPage() {
  const walletIdentity = useHighrableWalletIdentity();
  const { createJob } = useJobs();
  const router = useRouter();
  const jobTitleInputId = "job-title-input";
  const jobDescriptionInputId = "job-description-input";
  const jobBudgetInputId = "job-budget-input";
  const jobDeadlineInputId = "job-deadline-input";
  const [formData, setFormData] = useState<JobFormState>({
    title: "",
    description: "",
    budget: "",
    deadline: "",
    skills: [""],
  });
  const [milestones, setMilestones] = useState<MilestoneDraft[]>([
    { title: "", description: "", amount: "", dueDate: "" },
  ]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!walletIdentity.isConnected || !walletIdentity.walletAddress) {
      alert("Please connect your wallet to post a job");
      return;
    }

    const totalMilestoneAmount = milestones.reduce(
      (runningTotal, milestone) => runningTotal + parseFloat(milestone.amount || "0"),
      0,
    );

    if (totalMilestoneAmount !== parseFloat(formData.budget)) {
      alert("Milestone amounts must equal the total budget");
      return;
    }

    const jobData = {
      title: formData.title,
      description: formData.description,
      budget: parseFloat(formData.budget),
      deadline: formData.deadline,
      skills: formData.skills.filter((skill) => skill.trim() !== ""),
      client: `Client ${walletIdentity.walletAddress.slice(0, 6)}...${walletIdentity.walletAddress.slice(-4)}`,
      clientAddress: walletIdentity.walletAddress,
      milestones: milestones.map((milestone, index) => ({
        id: `${Date.now()}-${index}`,
        title: milestone.title,
        description: milestone.description,
        amount: parseFloat(milestone.amount),
        dueDate: milestone.dueDate,
        status: "pending" as const,
      })),
    };

    try {
      await createJob(jobData);
      alert("Job posted successfully!");
      router.push("/dashboard");
    } catch (error) {
      console.error("Error posting job:", error);
      alert("Error posting job. Please try again.");
    }
  };

  const addSkill = () => {
    setFormData((currentValue) => ({ ...currentValue, skills: [...currentValue.skills, ""] }));
  };

  const removeSkill = (index: number) => {
    setFormData((currentValue) => ({
      ...currentValue,
      skills: currentValue.skills.filter((_, skillIndex) => skillIndex !== index),
    }));
  };

  const updateSkill = (index: number, value: string) => {
    setFormData((currentValue) => ({
      ...currentValue,
      skills: currentValue.skills.map((skill, skillIndex) =>
        skillIndex === index ? value : skill,
      ),
    }));
  };

  const addMilestone = () => {
    setMilestones((currentValue) => [
      ...currentValue,
      { title: "", description: "", amount: "", dueDate: "" },
    ]);
  };

  const removeMilestone = (index: number) => {
    setMilestones((currentValue) =>
      currentValue.filter((_, milestoneIndex) => milestoneIndex !== index),
    );
  };

  const updateMilestone = (index: number, field: keyof MilestoneDraft, value: string) => {
    setMilestones((currentValue) =>
      currentValue.map((milestone, milestoneIndex) =>
        milestoneIndex === index ? { ...milestone, [field]: value } : milestone,
      ),
    );
  };

  if (!walletIdentity.isConnected) {
    return (
      <WalletRequiredNotice
        title="Connect Your Wallet"
        description="Connect your wallet to post jobs and hire talented freelancers on the Web3 platform"
      />
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8 text-center"
      >
        <h1 className="mb-4 text-4xl font-bold text-gray-900">
          Post a{" "}
          <span className="bg-linear-to-r from-[#FF7003] to-[#FF8801] bg-clip-text text-transparent">
            Web3 Job
          </span>
        </h1>
        <p className="text-lg text-gray-600">
          Create a job with smart contract escrow protection for guaranteed payment
        </p>
      </motion.div>

      <motion.form
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        onSubmit={handleSubmit}
        className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-lg"
      >
        <div className="space-y-8 p-8">
          <div className="space-y-6">
            <h2 className="border-b border-gray-100 pb-3 text-xl font-semibold text-gray-900">
              Job Details
            </h2>

            <div>
              <label
                htmlFor={jobTitleInputId}
                className="mb-2 block text-sm font-medium text-gray-700"
              >
                Job Title *
              </label>
              <input
                id={jobTitleInputId}
                type="text"
                required
                value={formData.title}
                onChange={(event) =>
                  setFormData((currentValue) => ({ ...currentValue, title: event.target.value }))
                }
                className="w-full rounded-lg border border-gray-200 px-4 py-3 transition-all duration-200 focus:border-[#FF7003] focus:ring-2 focus:ring-[#FF7003]"
                placeholder="e.g., React Developer for DeFi Dashboard"
              />
            </div>

            <div>
              <label
                htmlFor={jobDescriptionInputId}
                className="mb-2 block text-sm font-medium text-gray-700"
              >
                Job Description *
              </label>
              <textarea
                id={jobDescriptionInputId}
                required
                rows={6}
                value={formData.description}
                onChange={(event) =>
                  setFormData((currentValue) => ({
                    ...currentValue,
                    description: event.target.value,
                  }))
                }
                className="w-full rounded-lg border border-gray-200 px-4 py-3 transition-all duration-200 focus:border-[#FF7003] focus:ring-2 focus:ring-[#FF7003]"
                placeholder="Describe your project requirements, expectations, and deliverables..."
              />
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div>
                <label
                  htmlFor={jobBudgetInputId}
                  className="mb-2 block text-sm font-medium text-gray-700"
                >
                  <DollarSign className="mr-1 inline h-4 w-4" />
                  Total Budget (USD) *
                </label>
                <input
                  id={jobBudgetInputId}
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={formData.budget}
                  onChange={(event) =>
                    setFormData((currentValue) => ({ ...currentValue, budget: event.target.value }))
                  }
                  className="w-full rounded-lg border border-gray-200 px-4 py-3 transition-all duration-200 focus:border-[#FF7003] focus:ring-2 focus:ring-[#FF7003]"
                  placeholder="2500"
                />
              </div>

              <div>
                <label
                  htmlFor={jobDeadlineInputId}
                  className="mb-2 block text-sm font-medium text-gray-700"
                >
                  <Calendar className="mr-1 inline h-4 w-4" />
                  Project Deadline *
                </label>
                <input
                  id={jobDeadlineInputId}
                  type="date"
                  required
                  value={formData.deadline}
                  onChange={(event) =>
                    setFormData((currentValue) => ({
                      ...currentValue,
                      deadline: event.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-gray-200 px-4 py-3 transition-all duration-200 focus:border-[#FF7003] focus:ring-2 focus:ring-[#FF7003]"
                />
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <h2 className="border-b border-gray-100 pb-3 text-xl font-semibold text-gray-900">
              Required Skills
            </h2>

            <div className="space-y-3">
              {formData.skills.map((skill, index) => (
                <div key={index} className="flex items-center space-x-3">
                  <input
                    type="text"
                    value={skill}
                    onChange={(event) => updateSkill(index, event.target.value)}
                    className="flex-1 rounded-lg border border-gray-200 px-4 py-2 transition-all duration-200 focus:border-[#FF7003] focus:ring-2 focus:ring-[#FF7003]"
                    placeholder="e.g., React, TypeScript, Web3"
                  />
                  {formData.skills.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => removeSkill(index)}
                      className="rounded-lg p-2 text-red-500 transition-colors hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>
              ))}
              <button
                type="button"
                onClick={addSkill}
                className="flex items-center space-x-2 rounded-lg px-3 py-2 text-[#FF7003] transition-colors hover:bg-[#FF7003]/5"
              >
                <Plus className="h-4 w-4" />
                <span>Add Skill</span>
              </button>
            </div>
          </div>

          <div className="space-y-6">
            <h2 className="border-b border-gray-100 pb-3 text-xl font-semibold text-gray-900">
              Project Milestones
            </h2>

            <div className="space-y-6">
              {milestones.map((milestone, index) => (
                <div key={index} className="space-y-4 rounded-lg border border-gray-200 p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-gray-900">Milestone {index + 1}</h3>
                    {milestones.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => removeMilestone(index)}
                        className="rounded p-1 text-red-500 transition-colors hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    ) : null}
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <label
                        htmlFor={`milestone-title-${index}`}
                        className="mb-1 block text-sm font-medium text-gray-700"
                      >
                        Milestone Title *
                      </label>
                      <input
                        id={`milestone-title-${index}`}
                        type="text"
                        required
                        value={milestone.title}
                        onChange={(event) => updateMilestone(index, "title", event.target.value)}
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 transition-all duration-200 focus:border-[#FF7003] focus:ring-2 focus:ring-[#FF7003]"
                        placeholder="e.g., UI/UX Design & Setup"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor={`milestone-amount-${index}`}
                        className="mb-1 block text-sm font-medium text-gray-700"
                      >
                        Amount (USD) *
                      </label>
                      <input
                        id={`milestone-amount-${index}`}
                        type="number"
                        required
                        min="0"
                        step="0.01"
                        value={milestone.amount}
                        onChange={(event) => updateMilestone(index, "amount", event.target.value)}
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 transition-all duration-200 focus:border-[#FF7003] focus:ring-2 focus:ring-[#FF7003]"
                        placeholder="750"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor={`milestone-description-${index}`}
                      className="mb-1 block text-sm font-medium text-gray-700"
                    >
                      Description *
                    </label>
                    <textarea
                      id={`milestone-description-${index}`}
                      required
                      rows={2}
                      value={milestone.description}
                      onChange={(event) =>
                        updateMilestone(index, "description", event.target.value)
                      }
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 transition-all duration-200 focus:border-[#FF7003] focus:ring-2 focus:ring-[#FF7003]"
                      placeholder="Describe what needs to be delivered for this milestone..."
                    />
                  </div>

                  <div>
                    <label
                      htmlFor={`milestone-due-date-${index}`}
                      className="mb-1 block text-sm font-medium text-gray-700"
                    >
                      Due Date *
                    </label>
                    <input
                      id={`milestone-due-date-${index}`}
                      type="date"
                      required
                      value={milestone.dueDate}
                      onChange={(event) => updateMilestone(index, "dueDate", event.target.value)}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 transition-all duration-200 focus:border-[#FF7003] focus:ring-2 focus:ring-[#FF7003]"
                    />
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={addMilestone}
                className="flex items-center space-x-2 rounded-lg px-3 py-2 text-[#FF7003] transition-colors hover:bg-[#FF7003]/5"
              >
                <Plus className="h-4 w-4" />
                <span>Add Milestone</span>
              </button>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-100 bg-gray-50 px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Total Budget: ${formData.budget ? parseFloat(formData.budget).toLocaleString() : "0"}
            </div>
            <button
              type="submit"
              className="transform rounded-lg bg-linear-to-r from-[#FF7003] to-[#FF8801] px-8 py-3 font-semibold text-white shadow-lg transition-all duration-300 hover:-translate-y-0.5 hover:from-[#E85D00] hover:to-[#E87A00] hover:shadow-xl"
            >
              Post Job with Smart Contract
            </button>
          </div>
        </div>
      </motion.form>
    </div>
  );
}

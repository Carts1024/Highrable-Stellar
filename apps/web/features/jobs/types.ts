export interface Job {
  id: string;
  title: string;
  description: string;
  budget: number;
  deadline: string;
  skills: string[];
  client: string;
  clientAddress?: string;
  status: "open" | "in_progress" | "completed" | "disputed";
  milestones: Milestone[];
  createdAt: string;
  applications?: Application[];
}

export interface Milestone {
  id: string;
  title: string;
  description: string;
  amount: number;
  dueDate: string;
  status: "pending" | "in_progress" | "submitted" | "approved" | "disputed";
  proofOfWork?: string;
}

export interface Application {
  id: string;
  freelancer: string;
  freelancerAddress: string;
  proposal: string;
  rate: number;
  estimatedDuration: string;
  status: "pending" | "accepted" | "rejected";
  submittedAt: string;
}

export interface User {
  address: string;
  role: "client" | "freelancer";
  profile?: {
    name: string;
    bio: string;
    skills: string[];
    rating: number;
    completedJobs: number;
  };
}

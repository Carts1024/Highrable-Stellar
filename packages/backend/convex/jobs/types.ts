import type { Doc, Id } from "../_generated/dataModel";

export type TJobId = Id<"jobs">;
export type TJobDoc = Doc<"jobs">;

export type TCreateJobArgs = {
  title: string;
  description: string;
  budget: number;
  asset: string;
  clientWallet: string;
  jobHash?: string;
};

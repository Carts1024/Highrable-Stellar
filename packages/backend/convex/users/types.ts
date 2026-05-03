import type { Doc, Id } from "../_generated/dataModel";

export type TUserId = Id<"users">;
export type TUserDoc = Doc<"users">;

export type TUpsertUserArgs = {
  walletAddress: string;
  role: "client" | "freelancer";
  name?: string;
};

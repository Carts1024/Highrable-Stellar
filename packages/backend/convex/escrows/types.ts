import type { Doc, Id } from "../_generated/dataModel";

export type TEscrowId = Id<"escrows">;
export type TEscrowDoc = Doc<"escrows">;

export type TEscrowTxField =
  | "createTxHash"
  | "fundTxHash"
  | "assignTxHash"
  | "submitTxHash"
  | "releaseTxHash"
  | "cancelTxHash"
  | "disputeTxHash";

export type TJobStatusPatch = "funded" | "submitted" | "completed" | "cancelled" | "disputed";

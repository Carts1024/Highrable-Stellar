import { defineSchema } from "convex/server";

import applications from "./applications/schema";
import escrows from "./escrows/schema";
import jobs from "./jobs/schema";
import reputationRecords from "./reputation_records/schema";
import transactions from "./transactions/schema";
import users from "./users/schema";

export default defineSchema({
  users,
  jobs,
  applications,
  escrows,
  reputationRecords,
  transactions,
});

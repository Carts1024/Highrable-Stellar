import { defineSchema } from "convex/server";

import applications from "./applications/schema";
import attachments from "./attachments/schema";
import { conversationReads, conversations, messages } from "./conversations/schema";
import { deadlineAuditEvents, deadlineReminders, notifications } from "./deadlines/schema";
import escrows from "./escrows/schema";
import jobs from "./jobs/schema";
import milestones from "./milestones/schema";
import jobReports from "./reports/schema";
import reputationRecords from "./reputation_records/schema";
import transactions from "./transactions/schema";
import users from "./users/schema";
import workSubmissions from "./work_submissions/schema";

export default defineSchema({
  attachments,
  conversations,
  messages,
  conversationReads,
  users,
  jobs,
  milestones,
  applications,
  escrows,
  jobReports,
  reputationRecords,
  transactions,
  workSubmissions,
  deadlineReminders,
  notifications,
  deadlineAuditEvents,
});

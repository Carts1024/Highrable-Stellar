import { defineSchema } from "convex/server";

import applications from "./applications/schema";
import attachments, { attachmentAccessLogs } from "./attachments/schema";
import { cancellationEvents, cancellationRequests } from "./cancellations/schema";
import { conversationReads, conversations, messages } from "./conversations/schema";
import { deadlineAuditEvents, deadlineReminders, notifications } from "./deadlines/schema";
import { disputeEvents, disputes } from "./disputes/schema";
import escrows from "./escrows/schema";
import jobs from "./jobs/schema";
import milestones from "./milestones/schema";
import jobReports from "./reports/schema";
import reputationRecords from "./reputation_records/schema";
import revisionRequests from "./revisions/schema";
import transactions from "./transactions/schema";
import users from "./users/schema";
import workAgreements, {
  workAgreementEvents,
  workAgreementVersions,
} from "./work_agreements/schema";
import workSubmissions from "./work_submissions/schema";

export default defineSchema({
  attachments,
  attachmentAccessLogs,
  cancellationRequests,
  cancellationEvents,
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
  revisionRequests,
  transactions,
  workAgreements,
  workAgreementEvents,
  workAgreementVersions,
  workSubmissions,
  deadlineReminders,
  notifications,
  deadlineAuditEvents,
  disputes,
  disputeEvents,
});

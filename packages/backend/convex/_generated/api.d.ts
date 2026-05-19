/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as _shared_enum from "../_shared/enum.js";
import type * as _shared_errors from "../_shared/errors.js";
import type * as _shared_escrowAssets from "../_shared/escrowAssets.js";
import type * as _shared_input from "../_shared/input.js";
import type * as applications from "../applications.js";
import type * as applications_helpers from "../applications/helpers.js";
import type * as applications_mutations from "../applications/mutations.js";
import type * as applications_queries from "../applications/queries.js";
import type * as applications_types from "../applications/types.js";
import type * as attachments from "../attachments.js";
import type * as attachments_helpers from "../attachments/helpers.js";
import type * as attachments_mutations from "../attachments/mutations.js";
import type * as attachments_queries from "../attachments/queries.js";
import type * as dashboard_queries from "../dashboard/queries.js";
import type * as escrows from "../escrows.js";
import type * as escrows_helpers from "../escrows/helpers.js";
import type * as escrows_mutations from "../escrows/mutations.js";
import type * as escrows_queries from "../escrows/queries.js";
import type * as escrows_types from "../escrows/types.js";
import type * as jobs from "../jobs.js";
import type * as jobs_helpers from "../jobs/helpers.js";
import type * as jobs_mutations from "../jobs/mutations.js";
import type * as jobs_queries from "../jobs/queries.js";
import type * as jobs_scamSignals from "../jobs/scamSignals.js";
import type * as jobs_types from "../jobs/types.js";
import type * as lib_stellarReads from "../lib/stellarReads.js";
import type * as milestones from "../milestones.js";
import type * as milestones_helpers from "../milestones/helpers.js";
import type * as milestones_mutations from "../milestones/mutations.js";
import type * as milestones_queries from "../milestones/queries.js";
import type * as milestones_types from "../milestones/types.js";
import type * as profiles from "../profiles.js";
import type * as proofs from "../proofs.js";
import type * as reports from "../reports.js";
import type * as reports_helpers from "../reports/helpers.js";
import type * as reputation from "../reputation.js";
import type * as reputation_records_helpers from "../reputation_records/helpers.js";
import type * as reputation_records_mutations from "../reputation_records/mutations.js";
import type * as reputation_records_queries from "../reputation_records/queries.js";
import type * as reputation_records_types from "../reputation_records/types.js";
import type * as sync from "../sync.js";
import type * as syncMutations from "../syncMutations.js";
import type * as transactions from "../transactions.js";
import type * as transactions_helpers from "../transactions/helpers.js";
import type * as transactions_mutations from "../transactions/mutations.js";
import type * as transactions_queries from "../transactions/queries.js";
import type * as transactions_types from "../transactions/types.js";
import type * as users from "../users.js";
import type * as users_helpers from "../users/helpers.js";
import type * as users_mutations from "../users/mutations.js";
import type * as users_queries from "../users/queries.js";
import type * as users_types from "../users/types.js";
import type * as work_submissions from "../work_submissions.js";
import type * as work_submissions_helpers from "../work_submissions/helpers.js";
import type * as work_submissions_mutations from "../work_submissions/mutations.js";
import type * as work_submissions_queries from "../work_submissions/queries.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "_shared/enum": typeof _shared_enum;
  "_shared/errors": typeof _shared_errors;
  "_shared/escrowAssets": typeof _shared_escrowAssets;
  "_shared/input": typeof _shared_input;
  applications: typeof applications;
  "applications/helpers": typeof applications_helpers;
  "applications/mutations": typeof applications_mutations;
  "applications/queries": typeof applications_queries;
  "applications/types": typeof applications_types;
  attachments: typeof attachments;
  "attachments/helpers": typeof attachments_helpers;
  "attachments/mutations": typeof attachments_mutations;
  "attachments/queries": typeof attachments_queries;
  "dashboard/queries": typeof dashboard_queries;
  escrows: typeof escrows;
  "escrows/helpers": typeof escrows_helpers;
  "escrows/mutations": typeof escrows_mutations;
  "escrows/queries": typeof escrows_queries;
  "escrows/types": typeof escrows_types;
  jobs: typeof jobs;
  "jobs/helpers": typeof jobs_helpers;
  "jobs/mutations": typeof jobs_mutations;
  "jobs/queries": typeof jobs_queries;
  "jobs/scamSignals": typeof jobs_scamSignals;
  "jobs/types": typeof jobs_types;
  "lib/stellarReads": typeof lib_stellarReads;
  milestones: typeof milestones;
  "milestones/helpers": typeof milestones_helpers;
  "milestones/mutations": typeof milestones_mutations;
  "milestones/queries": typeof milestones_queries;
  "milestones/types": typeof milestones_types;
  profiles: typeof profiles;
  proofs: typeof proofs;
  reports: typeof reports;
  "reports/helpers": typeof reports_helpers;
  reputation: typeof reputation;
  "reputation_records/helpers": typeof reputation_records_helpers;
  "reputation_records/mutations": typeof reputation_records_mutations;
  "reputation_records/queries": typeof reputation_records_queries;
  "reputation_records/types": typeof reputation_records_types;
  sync: typeof sync;
  syncMutations: typeof syncMutations;
  transactions: typeof transactions;
  "transactions/helpers": typeof transactions_helpers;
  "transactions/mutations": typeof transactions_mutations;
  "transactions/queries": typeof transactions_queries;
  "transactions/types": typeof transactions_types;
  users: typeof users;
  "users/helpers": typeof users_helpers;
  "users/mutations": typeof users_mutations;
  "users/queries": typeof users_queries;
  "users/types": typeof users_types;
  work_submissions: typeof work_submissions;
  "work_submissions/helpers": typeof work_submissions_helpers;
  "work_submissions/mutations": typeof work_submissions_mutations;
  "work_submissions/queries": typeof work_submissions_queries;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};

import { cronJobs } from "convex/server";

import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "scan deadline reminders",
  { minutes: 15 },
  internal.deadlines.scanUpcomingDeadlines,
  {},
);

crons.interval("newsfeed photo cleanup", { minutes: 15 }, internal.newsfeed.photos.cleanup, {});
export default crons;

import type { VercelConfig } from "@vercel/config/v1";

export const config: VercelConfig = {
  framework: "nextjs",
  crons: [
    // One entry, every job. The Hobby plan allows two cron jobs at one run per
    // day, so `api/cron/daily` runs all five in sequence rather than each
    // needing a schedule of its own. The individual routes still exist and can
    // be called by hand while debugging.
    { path: "/api/cron/daily", schedule: "0 3 * * *" },
  ],
};

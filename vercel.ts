import type { VercelConfig } from "@vercel/config/v1";

export const config: VercelConfig = {
  framework: "nextjs",
  crons: [
    // Delete temporary print PDFs older than a week.
    { path: "/api/cron/cleanup-assets", schedule: "0 4 * * *" },
    // Catch missed Lulu PRINT_JOB_STATUS_CHANGED webhooks.
    { path: "/api/cron/reconcile-lulu", schedule: "*/30 * * * *" },
  ],
};

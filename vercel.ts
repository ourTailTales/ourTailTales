import type { VercelConfig } from "@vercel/config/v1";

export const config: VercelConfig = {
  framework: "nextjs",
  crons: [
    // Delete temporary print PDFs older than a week.
    { path: "/api/cron/cleanup-assets", schedule: "0 4 * * *" },
    // Catch missed Lulu PRINT_JOB_STATUS_CHANGED webhooks.
    { path: "/api/cron/reconcile-lulu", schedule: "*/30 * * * *" },
    // Transcode uploaded Video Memories as durable jobs.
    { path: "/api/cron/process-videos", schedule: "*/2 * * * *" },
    // Encrypt, archive, stamp QR, then send video orders to Lulu.
    { path: "/api/cron/fulfill-orders", schedule: "* * * * *" },
  ],
};

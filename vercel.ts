import type { VercelConfig } from "@vercel/config/v1";

export const config: VercelConfig = {
  framework: "nextjs",
  crons: [
    // Delete temporary print PDFs older than a week.
    { path: "/api/cron/cleanup-assets", schedule: "0 4 * * *" },
  ],
};

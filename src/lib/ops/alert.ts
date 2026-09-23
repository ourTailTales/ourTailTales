import { emailFrom, resendClient } from "@/lib/email/resend";
import { SITE_URL, readEnv } from "@/lib/env";

/**
 * Tells a person when an order needs one.
 *
 * Everything that can strand a paid order already had somewhere to record
 * itself: a `needs_review` status, a `review_reason`, a line in the log. None
 * of that reaches anybody. A customer's money is taken, their book stops
 * moving, and the only way to find out is to go looking at the right row on
 * the right day. The first time anyone hears about it is the support email,
 * and by then it has been a week.
 *
 * So this sends mail. It is deliberately the crudest possible channel, and
 * deliberately best effort: nothing here may ever throw into a webhook or a
 * cron run, because the thing it is reporting on is already worse than a
 * failed alert.
 *
 * Set `OPS_ALERT_EMAIL` to receive them. Unset, this logs and returns, which
 * is exactly what happened before, so nothing regresses if it is never
 * configured.
 */
export async function alertOps(
  subject: string,
  detail: Record<string, string | number | null | undefined>,
): Promise<void> {
  const lines = Object.entries(detail)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => `${key}: ${String(value)}`);

  console.error(`[ourTailTales] OPS: ${subject}`, detail);

  const to = readEnv("OPS_ALERT_EMAIL");
  if (!to) return;

  try {
    const client = resendClient();
    if (!client) return;
    await client.emails.send({
      from: emailFrom(),
      to,
      subject: `[ourTailTales] ${subject}`,
      text: [subject, "", ...lines, "", SITE_URL].join("\n"),
    });
  } catch (error) {
    // The alert failing is not worth failing the run it was reporting on.
    console.error("[ourTailTales] Could not send the ops alert", error);
  }
}

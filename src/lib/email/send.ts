import {
  digitalPurchaseEmailHtml,
  freePdfEmailHtml,
  orderConfirmationEmailHtml,
  shippingNotificationEmailHtml,
} from "@/lib/email/templates";
import { emailFrom, resendClient } from "@/lib/email/resend";
import { SITE_URL } from "@/lib/env";

/**
 * Transactional senders.
 *
 * Every one of these is fire-and-forget: it is called after the work the
 * customer actually asked for has already succeeded, so a mail failure is
 * logged and swallowed rather than thrown. Nothing here ever rolls back a
 * paid order or a finished book.
 *
 * The free-book mail carries a link, not an attachment. A whole book at
 * preview resolution is well past what mailboxes accept, and a link also means
 * the copy stays current if the customer later buys it.
 */

type SendResult = { sent: boolean; reason?: string };

export async function sendFreePdfEmail(args: {
  to: string;
  petName: string;
  bookUrl: string;
}): Promise<SendResult> {
  const name = args.petName.trim();
  return send({
    to: args.to,
    subject: name ? `${name}’s story is ready` : "Your book is ready",
    html: freePdfEmailHtml({ petName: args.petName, bookUrl: args.bookUrl }),
  });
}

export async function sendDigitalPurchaseEmail(args: {
  to: string;
  petName: string;
  bookUrl: string;
}): Promise<SendResult> {
  const name = args.petName.trim();
  return send({
    to: args.to,
    subject: name ? `${name}’s book is yours to keep` : "Your book is yours to keep",
    html: digitalPurchaseEmailHtml({
      petName: args.petName,
      bookUrl: args.bookUrl,
    }),
  });
}

export async function sendOrderConfirmationEmail(args: {
  to: string;
  petName: string;
  orderId: string;
  total: string;
}): Promise<SendResult> {
  return send({
    to: args.to,
    subject: "Your hardcover is being printed",
    html: orderConfirmationEmailHtml({
      petName: args.petName,
      orderId: args.orderId,
      total: args.total,
      orderUrl: `${SITE_URL}/order/${args.orderId}`,
    }),
  });
}

export async function sendShippingNotificationEmail(args: {
  to: string;
  petName: string;
  orderId: string;
  trackingUrl?: string | null;
}): Promise<SendResult> {
  return send({
    to: args.to,
    subject: "Your book has shipped",
    html: shippingNotificationEmailHtml({
      petName: args.petName,
      orderUrl: `${SITE_URL}/order/${args.orderId}`,
      trackingUrl: args.trackingUrl,
    }),
  });
}

async function send(args: {
  to: string;
  subject: string;
  html: string;
}): Promise<SendResult> {
  const client = resendClient();
  if (!client) {
    console.info("[ourTailTales] Skipping email — RESEND_API_KEY not set.");
    return { sent: false, reason: "not_configured" };
  }

  try {
    const { error } = await client.emails.send({
      from: emailFrom(),
      to: args.to,
      subject: args.subject,
      html: args.html,
    });
    if (error) {
      console.error("[ourTailTales] Resend rejected an email", error);
      return { sent: false, reason: error.message };
    }
    return { sent: true };
  } catch (error) {
    console.error("[ourTailTales] Email send failed", error);
    return {
      sent: false,
      reason: error instanceof Error ? error.message : "unknown",
    };
  }
}

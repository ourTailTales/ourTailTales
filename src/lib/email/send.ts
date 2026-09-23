import {
  digitalPurchaseEmailHtml,
  orderConfirmationEmailHtml,
  shippingNotificationEmailHtml,
  teaserEmailHtml,
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
 * The welcome mail carries the free ten pages as an attachment and a link for
 * everything after them. The whole book is never attached: at preview
 * resolution it is well past what mailboxes take, and a link also keeps
 * showing the current copy after a purchase removes the watermark.
 */

type SendResult = { sent: boolean; reason?: string };

/**
 * The welcome mail, with the free ten pages attached.
 *
 * The attachment is the whole point: the customer gets something they can open
 * and keep in the same moment they get the email, rather than a link that
 * sends them somewhere to be asked for something. Ten pages at screen
 * resolution sits well inside what mailboxes accept — the whole book would
 * not, which is why the rest is behind the link.
 */
export async function sendTeaserEmail(args: {
  to: string;
  petName: string;
  claimUrl: string;
  hiddenChapters: number;
  hiddenPages: number;
  pdf: Uint8Array;
  fileName: string;
}): Promise<SendResult> {
  const name = args.petName.trim();
  return send({
    to: args.to,
    subject: name ? `${name}’s book is written` : "Your book is written",
    html: teaserEmailHtml({
      petName: args.petName,
      claimUrl: args.claimUrl,
      hiddenChapters: args.hiddenChapters,
      hiddenPages: args.hiddenPages,
    }),
    attachments: [
      {
        filename: args.fileName,
        content: Buffer.from(args.pdf),
      },
    ],
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

type Attachment = { filename: string; content: Buffer };

async function send(args: {
  to: string;
  subject: string;
  html: string;
  attachments?: Attachment[];
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
      ...(args.attachments ? { attachments: args.attachments } : {}),
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

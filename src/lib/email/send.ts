import {
  digitalPurchaseEmailHtml,
  orderConfirmationEmailHtml,
  shippingNotificationEmailHtml,
  teaserEmailHtml,
} from "@/lib/email/templates";
import { emailFrom, resendClient } from "@/lib/email/resend";
import { SITE_URL } from "@/lib/env";
import { mintOrderToken } from "@/lib/order/token";

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

/**
 * The order page, with the order's token on it.
 *
 * The page refuses a link that carries only the id, so every link we hand out
 * has to carry both.
 */
function orderPageUrl(orderId: string): string {
  return `${SITE_URL}/order/${orderId}?t=${mintOrderToken(orderId)}`;
}

export async function sendOrderConfirmationEmail(args: {
  to: string;
  petName: string;
  orderId: string;
  total: string;
  copies?: number;
}): Promise<SendResult> {
  return send({
    to: args.to,
    subject: "We have your order",
    html: orderConfirmationEmailHtml({
      petName: args.petName,
      orderId: args.orderId,
      total: args.total,
      copies: args.copies ?? 1,
      orderUrl: orderPageUrl(args.orderId),
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
      orderUrl: orderPageUrl(args.orderId),
      trackingUrl: args.trackingUrl,
    }),
  });
}

type Attachment = { filename: string; content: Buffer };

/** Where a reply to any of these goes. */
export const REPLY_TO = "hello@ourtailtales.com";

/**
 * How long one send may take.
 *
 * Mail is sent from webhooks and cron runs that have a fixed number of seconds
 * to live and more important things to do with them. A send that has not been
 * answered by now is reported as not sent, and the caller moves on.
 */
export const SEND_TIMEOUT_MS = 8_000;

/** Rejects when `work` has not settled in time. The work itself is not cancelled. */
export function withTimeout<T>(work: PromiseLike<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Email send timed out after ${ms}ms`)),
      ms,
    );
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

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
    const { error } = await withTimeout(
      client.emails.send({
        from: emailFrom(),
        to: args.to,
        // A customer who replies reaches a person, not the sending address.
        replyTo: REPLY_TO,
        subject: args.subject,
        html: args.html,
        ...(args.attachments ? { attachments: args.attachments } : {}),
      }),
      SEND_TIMEOUT_MS,
    );
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

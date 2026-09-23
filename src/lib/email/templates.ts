import { brand } from "@/lib/brand";
import { SITE_URL } from "@/lib/env";

/**
 * Transactional email templates.
 *
 * Table layout with inline styles, because mail clients still do not agree on
 * anything else. The voice follows the brand rules: warm and plain, no grief
 * clichés, no countdown pressure, and no mention of how the book was made —
 * the customer made a book about their pet, not a run of a pipeline.
 */

const { colors } = brand;

/**
 * The welcome mail: the first ten pages attached, and the one link that opens
 * the rest.
 *
 * The PDF is attached rather than linked because the customer asked for their
 * book, not for a errand — an attachment is theirs immediately, works offline,
 * and cannot expire. The link is for the rest of it.
 */
export function teaserEmailHtml(args: {
  petName: string;
  claimUrl: string;
  hiddenChapters: number;
  hiddenPages: number;
}): string {
  const name = args.petName.trim();
  const title = name ? `${possessive(name)} book is written` : "Your book is written";
  const opening = name
    ? `Your photos of ${name} are a book now. The first ten pages are attached to this email — cover included.`
    : "Your photos are a book now. The first ten pages are attached to this email — cover included.";

  const rest =
    args.hiddenChapters > 0
      ? `The rest is already written: ${plural(args.hiddenChapters, "chapter")} and ${plural(args.hiddenPages, "page")} more. Make your account and the whole book opens — and you can change any of it, from the cover to every photo on every page.`
      : "Make your account and the whole book is saved to your library, where you can change any of it — the cover, the chapters, every photo.";

  return layout({
    preheader: title,
    heading: title,
    body: `
      ${paragraph(opening)}
      ${paragraph(rest)}
      ${button("Open the whole book", args.claimUrl)}
      ${paragraph(
        "Your photos never left your own device. They were turned into a book right there in your browser.",
        colors.inkSoft,
      )}
    `,
  });
}

function plural(count: number, noun: string): string {
  return count === 1 ? `1 ${noun}` : `${count} ${noun}s`;
}

export function digitalPurchaseEmailHtml(args: {
  petName: string;
  bookUrl: string;
}): string {
  const name = args.petName.trim();
  const title = name ? `${possessive(name)} book is yours` : "Your book is yours";

  return layout({
    preheader: title,
    heading: title,
    body: `
      ${paragraph(
        "Thank you. The watermark is gone and the link no longer expires — it is yours to keep and to download whenever you like.",
      )}
      ${button("Open your book", args.bookUrl)}
      ${paragraph(
        "Save a copy somewhere of your own too. A file on your own drive outlives any link.",
        colors.inkSoft,
      )}
    `,
  });
}

export function orderConfirmationEmailHtml(args: {
  petName: string;
  orderId: string;
  total: string;
  orderUrl: string;
}): string {
  const name = args.petName.trim();

  return layout({
    preheader: "Your hardcover is on its way to the printer",
    heading: name ? `${possessive(name)} book is being printed` : "Your book is being printed",
    body: `
      ${paragraph(
        "Your order is confirmed and has gone to the printer. Printing and binding take a few days, and you will get another email the moment it ships.",
      )}
      ${detailRow("Order", args.orderId)}
      ${detailRow("Total", args.total)}
      ${button("Track your order", args.orderUrl)}
    `,
  });
}

export function shippingNotificationEmailHtml(args: {
  petName: string;
  orderUrl: string;
  trackingUrl?: string | null;
}): string {
  const name = args.petName.trim();

  return layout({
    preheader: "Your book has shipped",
    heading: name ? `${possessive(name)} book has shipped` : "Your book has shipped",
    body: `
      ${paragraph("It is printed, bound, and on its way to you.")}
      ${button(
        args.trackingUrl ? "Track your parcel" : "See your order",
        args.trackingUrl ?? args.orderUrl,
      )}
      ${paragraph(
        "Once it arrives, it is simply a book on a shelf — which was the whole idea.",
        colors.inkSoft,
      )}
    `,
  });
}

/* --------------------------------- pieces --------------------------------- */

function layout(args: {
  preheader: string;
  heading: string;
  body: string;
}): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(args.heading)}</title>
</head>
<body style="margin:0;padding:0;background-color:${colors.cream};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(args.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${colors.cream};padding:32px 16px;">
  <tr>
    <td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background-color:${colors.white};border:1px solid ${colors.line};border-radius:16px;">
        <tr>
          <td style="padding:32px 32px 8px 32px;">
            <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:15px;font-weight:700;color:${colors.periwinkle};letter-spacing:0.02em;">${brand.name}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:8px 32px 0 32px;">
            <h1 style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:26px;line-height:1.25;font-weight:700;color:${colors.ink};">${escapeHtml(args.heading)}</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 32px 32px 32px;">${args.body}</td>
        </tr>
        <tr>
          <td style="padding:0 32px 32px 32px;">
            <p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:${colors.inkFaint};border-top:1px solid ${colors.line};padding-top:16px;">
              ${brand.name} — ${escapeHtml(brand.line)}<br>
              <a href="${escapeAttribute(SITE_URL)}" style="color:${colors.inkFaint};">${escapeHtml(siteLabel())}</a>
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

function paragraph(text: string, color: string = colors.ink): string {
  return `<p style="margin:0 0 16px 0;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.65;color:${color};">${escapeHtml(text)}</p>`;
}

function button(label: string, href: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 20px 0;">
  <tr>
    <td style="background-color:${colors.periwinkle};border-radius:12px;">
      <a href="${escapeAttribute(href)}" style="display:inline-block;padding:14px 26px;font-family:Helvetica,Arial,sans-serif;font-size:15px;font-weight:700;color:${colors.white};text-decoration:none;">${escapeHtml(label)}</a>
    </td>
  </tr>
</table>`;
}

function detailRow(label: string, value: string): string {
  return `<p style="margin:0 0 8px 0;font-family:Helvetica,Arial,sans-serif;font-size:14px;line-height:1.6;color:${colors.inkSoft};">
  <span style="color:${colors.inkFaint};">${escapeHtml(label)}:</span> <strong style="color:${colors.ink};">${escapeHtml(value)}</strong>
</p>`;
}

/**
 * The footer link has to point at wherever the site actually lives. Linking
 * the brand domain before it is registered puts a dead link in every email.
 */
function siteLabel(): string {
  try {
    return new URL(SITE_URL).host;
  } catch {
    return brand.domain;
  }
}

function possessive(name: string): string {
  const trimmed = name.trim();
  return /s$/i.test(trimmed) ? `${trimmed}’` : `${trimmed}’s`;
}

/**
 * Pet names and order ids are customer-supplied and land in markup, so they are
 * escaped rather than trusted.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttribute(value: string): string {
  return escapeHtml(value);
}

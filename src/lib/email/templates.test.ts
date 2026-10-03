import { describe, expect, it } from "vitest";

import {
  digitalPurchaseEmailHtml,
  orderConfirmationEmailHtml,
  shippingNotificationEmailHtml,
  teaserEmailHtml,
} from "@/lib/email/templates";

const bookUrl = "https://ourtailtales.com/book/abc?k=secret";
const claimUrl = "https://ourtailtales.com/claim/abc?k=secret";
const teaser = { claimUrl, hiddenChapters: 4, hiddenPages: 44 };

describe("teaserEmailHtml", () => {
  it("links to the claim page and says how much is still to come", () => {
    const html = teaserEmailHtml({ petName: "Bailey", ...teaser });
    expect(html).toContain(claimUrl);
    expect(html).toContain("Open the whole book");
    expect(html).toContain("4 chapters");
    expect(html).toContain("44 pages");
  });

  it("says the first ten pages are attached, cover included", () => {
    const html = teaserEmailHtml({ petName: "Bailey", ...teaser });
    expect(html).toContain("attached to this email");
    expect(html).toContain("cover included");
  });

  it("does not promise more pages when the teaser is the whole book", () => {
    const html = teaserEmailHtml({
      petName: "Bailey",
      claimUrl,
      hiddenChapters: 0,
      hiddenPages: 0,
    });
    expect(html).toContain("saved to your library");
    expect(html).not.toContain("already written");
  });

  it("uses the singular for a single remaining chapter", () => {
    const html = teaserEmailHtml({
      petName: "Bailey",
      claimUrl,
      hiddenChapters: 1,
      hiddenPages: 1,
    });
    expect(html).toContain("1 chapter");
    expect(html).toContain("1 page");
    expect(html).not.toContain("1 chapters");
  });

  it("uses the right possessive for a name ending in s", () => {
    expect(teaserEmailHtml({ petName: "Gus", ...teaser })).toContain("Gus\u2019 book");
    expect(teaserEmailHtml({ petName: "Bailey", ...teaser })).toContain(
      "Bailey\u2019s book",
    );
  });

  it("still reads properly when no pet name was given", () => {
    const html = teaserEmailHtml({ petName: "  ", ...teaser });
    expect(html).toContain("Your book is written");
    expect(html).not.toContain("\u2019s book");
  });

  it("escapes a pet name so it cannot inject markup", () => {
    const html = teaserEmailHtml({
      petName: '<script>alert("x")</script>',
      ...teaser,
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});


describe("brand voice", () => {
  const all = [
    teaserEmailHtml({ petName: "Bailey", ...teaser }),
    digitalPurchaseEmailHtml({ petName: "Bailey", bookUrl }),
    orderConfirmationEmailHtml({
      petName: "Bailey",
      orderId: "order-1",
      total: "$49.99",
      orderUrl: "https://ourtailtales.com/order/order-1",
    }),
    shippingNotificationEmailHtml({
      petName: "Bailey",
      orderUrl: "https://ourtailtales.com/order/order-1",
      trackingUrl: null,
    }),
  ];

  it("avoids the grief clichés the brand rules rule out", () => {
    for (const html of all) {
      const text = html.toLowerCase();
      expect(text).not.toContain("rainbow bridge");
      expect(text).not.toContain("angel wings");
      expect(text).not.toContain("crossed over");
    }
  });

  it("never centres the AI in customer copy", () => {
    for (const html of all) {
      const text = html.toLowerCase();
      expect(text).not.toContain("ai-generated");
      expect(text).not.toContain("artificial intelligence");
    }
  });

  it("spells the brand name the one correct way", () => {
    for (const html of all) {
      expect(html).toContain("ourTailTales");
      expect(html).not.toContain("Our Tail Tales");
      expect(html).not.toContain("OurTailTales");
    }
  });
});

describe("orderConfirmationEmailHtml", () => {
  const html = orderConfirmationEmailHtml({
    petName: "Bailey",
    orderId: "order-1",
    total: "$55.48",
    orderUrl: "https://ourtailtales.com/order/order-1?t=abc",
  });

  it("says what is true at the moment of payment and no more", () => {
    expect(html).toContain(
      "Thank you. Your payment is confirmed. We are getting your book ready to print. Printing and binding take a few days. We will email you again when it ships.",
    );
    expect(html).not.toContain("being sent to print");
  });

  it("states the reprint promise with its limit and where to write", () => {
    expect(html).toContain(
      "If the book arrives damaged or misprinted, email hello@ourtailtales.com within 30 days of delivery with a photo and we will reprint it free.",
    );
    expect(html).not.toContain("reply to this email");
  });

  it("shows the total and links to the order", () => {
    expect(html).toContain("$55.48");
    expect(html).toContain("https://ourtailtales.com/order/order-1?t=abc");
  });

  it("uses no dashes as pauses", () => {
    expect(html).not.toContain("\u2014");
    expect(html).not.toContain(" \u2013 ");
    expect(html).not.toContain(" - ");
  });
});

describe("shippingNotificationEmailHtml", () => {
  it("prefers the carrier link when there is one", () => {
    const html = shippingNotificationEmailHtml({
      petName: "Bailey",
      orderUrl: "https://ourtailtales.com/order/order-1",
      trackingUrl: "https://carrier.example/track/1",
    });
    expect(html).toContain("https://carrier.example/track/1");
    expect(html).toContain("Track your parcel");
  });

  it("falls back to the order page when tracking is unknown", () => {
    const html = shippingNotificationEmailHtml({
      petName: "Bailey",
      orderUrl: "https://ourtailtales.com/order/order-1",
      trackingUrl: null,
    });
    expect(html).toContain("/order/order-1");
    expect(html).toContain("See your order");
  });
});

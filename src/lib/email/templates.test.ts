import { describe, expect, it } from "vitest";

import {
  digitalPurchaseEmailHtml,
  freePdfEmailHtml,
  orderConfirmationEmailHtml,
  shippingNotificationEmailHtml,
} from "@/lib/email/templates";

const bookUrl = "https://ourtailtales.com/book/abc?k=secret";

describe("freePdfEmailHtml", () => {
  it("links to the book rather than mentioning an attachment", () => {
    const html = freePdfEmailHtml({ petName: "Bailey", bookUrl });
    expect(html).toContain(bookUrl);
    expect(html).toContain("View your book");
    expect(html.toLowerCase()).not.toContain("attach");
  });

  it("uses the right possessive for a name ending in s", () => {
    expect(freePdfEmailHtml({ petName: "Gus", bookUrl })).toContain("Gus’ story");
    expect(freePdfEmailHtml({ petName: "Bailey", bookUrl })).toContain(
      "Bailey’s story",
    );
  });

  it("still reads properly when no pet name was given", () => {
    const html = freePdfEmailHtml({ petName: "  ", bookUrl });
    expect(html).toContain("Your book is ready");
    expect(html).not.toContain("’s story");
  });

  it("escapes a pet name so it cannot inject markup", () => {
    const html = freePdfEmailHtml({
      petName: '<script>alert("x")</script>',
      bookUrl,
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("says how long the free copy lasts without manufacturing urgency", () => {
    const html = freePdfEmailHtml({ petName: "Bailey", bookUrl });
    expect(html).toContain("30 days");
    expect(html.toLowerCase()).not.toContain("hurry");
    expect(html.toLowerCase()).not.toContain("act now");
  });
});

describe("brand voice", () => {
  const all = [
    freePdfEmailHtml({ petName: "Bailey", bookUrl }),
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

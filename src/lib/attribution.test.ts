import { describe, expect, it } from "vitest";

import { classifyTouch } from "@/lib/attribution";

const own = "www.ourtailtales.com";

describe("classifyTouch", () => {
  it("prefers utm_source and folds aliases together", () => {
    expect(
      classifyTouch({ url: "https://www.ourtailtales.com/?utm_source=IG", referrer: "", ownHost: own })
        .channel,
    ).toBe("instagram");
    expect(
      classifyTouch({
        url: "https://www.ourtailtales.com/?utm_source=spring_promo&utm_medium=email",
        referrer: "",
        ownHost: own,
      }).channel,
    ).toBe("email");
  });

  it("maps referrers to channels", () => {
    const touch = classifyTouch({
      url: "https://www.ourtailtales.com/",
      referrer: "https://l.instagram.com/?u=x",
      ownHost: own,
    });
    expect(touch.channel).toBe("instagram");
    expect(touch.referringDomain).toBe("l.instagram.com");
    expect(
      classifyTouch({ url: "https://www.ourtailtales.com/", referrer: "https://www.google.co.uk/", ownHost: own })
        .channel,
    ).toBe("google");
  });

  it("uses click ids when the referrer is stripped", () => {
    expect(
      classifyTouch({ url: "https://www.ourtailtales.com/?fbclid=abc", referrer: "", ownHost: own }).channel,
    ).toBe("facebook");
  });

  it("treats no referrer or our own site as direct, and keeps unknown domains", () => {
    expect(classifyTouch({ url: "https://www.ourtailtales.com/", referrer: "", ownHost: own }).channel).toBe(
      "direct",
    );
    expect(
      classifyTouch({
        url: "https://www.ourtailtales.com/create",
        referrer: "https://ourtailtales.com/",
        ownHost: own,
      }).channel,
    ).toBe("direct");
    expect(
      classifyTouch({ url: "https://www.ourtailtales.com/", referrer: "https://dogblog.example/", ownHost: own })
        .channel,
    ).toBe("dogblog.example");
  });
});

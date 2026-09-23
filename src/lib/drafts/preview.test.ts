import { describe, expect, it } from "vitest";

import { decideAccess, type DraftRow } from "@/lib/drafts/preview";

const now = new Date("2026-09-23T12:00:00Z");

function row(overrides: Partial<DraftRow> = {}): DraftRow {
  return {
    id: "d1",
    secret_hash: "h",
    pdf_storage_path: "drafts/d1/preview.pdf",
    pdf_stored_at: "2026-09-01T00:00:00Z",
    clean_pdf_storage_path: "drafts/d1/clean.pdf",
    expires_at: "2026-10-01T00:00:00Z",
    digital_purchased_at: null,
    pet_name: "Bailey",
    chapter_count: 5,
    ...overrides,
  };
}

describe("decideAccess", () => {
  it("serves the watermarked copy to a free reader", () => {
    const access = decideAccess(row(), now);
    expect(access.expired).toBe(false);
    expect(access.purchased).toBe(false);
    expect(access.path).toBe("drafts/d1/preview.pdf");
  });

  it("serves the clean copy once bought, and drops the deadline", () => {
    const access = decideAccess(
      row({ digital_purchased_at: "2026-09-20T00:00:00Z" }),
      now,
    );
    expect(access.purchased).toBe(true);
    expect(access.path).toBe("drafts/d1/clean.pdf");
    expect(access.expiresAt).toBeNull();
    expect(access.expired).toBe(false);
  });

  it("never expires a bought book, even with a stale expiry left on the row", () => {
    const access = decideAccess(
      row({
        digital_purchased_at: "2026-09-20T00:00:00Z",
        expires_at: "2026-09-01T00:00:00Z",
      }),
      now,
    );
    expect(access.expired).toBe(false);
  });

  it("expires once the date has passed but the files are still there", () => {
    const access = decideAccess(row({ expires_at: "2026-09-22T00:00:00Z" }), now);
    expect(access.expired).toBe(true);
  });

  it("still reports expired after the sweep has removed the files", () => {
    // The regression this test exists for: the sweep nulls the paths but keeps
    // the timestamps. Treating that as "not a book" sent an expired link to a
    // redirect instead of the page that explains what happened.
    const access = decideAccess(
      row({
        pdf_storage_path: null,
        clean_pdf_storage_path: null,
        expires_at: "2026-09-22T00:00:00Z",
        pet_name: "",
        chapter_count: null,
      }),
      now,
    );
    expect(access.expired).toBe(true);
    expect(access.path).toBe("");
  });

  it("treats a book with no expiry at all as live", () => {
    const access = decideAccess(row({ expires_at: null }), now);
    expect(access.expired).toBe(false);
  });
});

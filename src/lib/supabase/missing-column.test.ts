import { describe, expect, it } from "vitest";

import { isMissingColumnError } from "@/lib/supabase/missing-column";

const COLUMN = "digital_stripe_payment_intent_id";

describe("isMissingColumnError", () => {
  it("matches a write to a column PostgREST does not know", () => {
    expect(
      isMissingColumnError(
        {
          code: "PGRST204",
          message: `Could not find the '${COLUMN}' column of 'book_drafts' in the schema cache`,
        },
        COLUMN,
      ),
    ).toBe(true);
  });

  it("matches a filter on a column Postgres does not have", () => {
    expect(
      isMissingColumnError(
        { code: "42703", message: `column book_drafts.${COLUMN} does not exist` },
        COLUMN,
      ),
    ).toBe(true);
  });

  it("ignores a missing column other than the one asked about", () => {
    expect(
      isMissingColumnError(
        {
          code: "PGRST204",
          message: "Could not find the 'other' column of 'book_drafts' in the schema cache",
        },
        COLUMN,
      ),
    ).toBe(false);
  });

  it("ignores every other error", () => {
    expect(isMissingColumnError(null, COLUMN)).toBe(false);
    expect(
      isMissingColumnError({ code: "23505", message: `duplicate ${COLUMN}` }, COLUMN),
    ).toBe(false);
  });
});

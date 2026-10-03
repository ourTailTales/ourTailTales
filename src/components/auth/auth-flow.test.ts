import { describe, expect, it, vi } from "vitest";

import {
  authCallbackUrl,
  authErrorCopy,
  confirmationReturnPath,
  COPY,
  createPathForEmail,
  shortPasswordFlow,
  signInWithPasswordFlow,
  signUpOrSignInFlow,
  type PasswordAuthClient,
} from "@/components/auth/auth-flow";

const session = { access_token: "t" };
const creds = { email: "a@b.co", password: "longenough" };

const unconfirmed = { message: "Email not confirmed", code: "email_not_confirmed" };
const wrongPassword = { message: "Invalid login credentials", code: "invalid_credentials" };

function client(
  signUp: { session?: unknown; error?: unknown },
  signIn: { session?: unknown; error?: unknown } = {},
  resend: () => Promise<unknown> = async () => ({ data: {}, error: null }),
) {
  const auth = {
    resend: vi.fn(resend),
    signUp: vi.fn(async () => ({
      data: { session: signUp.session ?? null },
      error: signUp.error ?? null,
    })),
    signInWithPassword: vi.fn(async () => ({
      data: { session: signIn.session ?? null },
      error: signIn.error ?? null,
    })),
  };
  return auth satisfies PasswordAuthClient;
}

describe("authErrorCopy", () => {
  it("never passes a raw message through", () => {
    const raw = [
      { message: "Invalid login credentials", code: "invalid_credentials" },
      { message: "Failed to fetch", name: "AuthRetryableFetchError", status: 0 },
      { message: "Database error saving new user", status: 500 },
      new Error("TypeError: Load failed"),
      "a string",
      null,
    ];
    const allowed = new Set<string>(Object.values(COPY));
    for (const error of raw) expect(allowed.has(authErrorCopy(error))).toBe(true);
  });

  it("names the three common cases", () => {
    expect(authErrorCopy({ message: "Invalid login credentials" })).toBe(
      "That email or password is not right.",
    );
    expect(authErrorCopy(new TypeError("Failed to fetch"))).toBe(
      "You are offline. Check your connection and try again.",
    );
    expect(authErrorCopy({ message: "unexpected_failure", status: 500 })).toBe(
      "Something went wrong. Please try again.",
    );
  });

  it("words a rate limit as a few minutes, however it arrives", () => {
    const copy = "Too many tries. Please wait a few minutes and try again.";
    expect(authErrorCopy({ message: "Request rate limit reached", status: 429 })).toBe(copy);
    expect(authErrorCopy({ message: "Email rate limit exceeded" })).toBe(copy);
    expect(authErrorCopy({ code: "over_email_send_rate_limit", status: 400 })).toBe(copy);
    expect(authErrorCopy({ code: "over_request_rate_limit" })).toBe(copy);
  });

  it("follows the brand rules in every line a customer can see", () => {
    for (const line of Object.values(COPY)) {
      expect(line).not.toMatch(/[\u2013\u2014]| - /);
      expect(line).not.toMatch(/supabase|credentials|rate limit/i);
    }
  });
});

describe("paths", () => {
  it("leaves the address out when there is not one", () => {
    expect(createPathForEmail("")).toBe("/create");
    expect(createPathForEmail(undefined)).toBe("/create");
    expect(createPathForEmail("not an address")).toBe("/create");
    expect(createPathForEmail("a@b")).toBe("/create");
  });

  it("returns a confirmation to the page that asked, when it is ours", () => {
    const origin = "https://x.test";
    expect(
      confirmationReturnPath({ origin, returnPath: "/book/abc-123", email: "a@b.co" }),
    ).toBe("/book/abc-123");
    expect(confirmationReturnPath({ origin, email: "a@b.co" })).toBe(
      "/create?email=a%40b.co",
    );
    expect(confirmationReturnPath({ origin, returnPath: null })).toBe("/create");
    for (const returnPath of ["//evil.com", "/.//evil.com", "https://evil.com", "/\\evil.com", "book/abc"]) {
      expect(confirmationReturnPath({ origin, returnPath, email: "a@b.co" })).toBe(
        "/create?email=a%40b.co",
      );
    }
  });

  it("encodes the address into the editor path", () => {
    expect(createPathForEmail(" a+b@example.com ")).toBe(
      "/create?email=a%2Bb%40example.com",
    );
    expect(createPathForEmail(null)).toBe("/create");
    expect(createPathForEmail("  ")).toBe("/create");
  });

  it("encodes the way back into the callback link", () => {
    const url = authCallbackUrl("https://x.test", "/claim/abc?k=s&mode=signin");
    expect(url).toBe(
      "https://x.test/auth/callback?next=%2Fclaim%2Fabc%3Fk%3Ds%26mode%3Dsignin",
    );
    expect(new URL(url).searchParams.get("next")).toBe("/claim/abc?k=s&mode=signin");
  });
});

describe("signUpOrSignInFlow", () => {
  it("is done when sign-up returns a session", async () => {
    const auth = client({ session });
    await expect(signUpOrSignInFlow(auth, creds)).resolves.toEqual({ status: "signedIn" });
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it("passes the redirect for the confirmation email", async () => {
    const auth = client({ session });
    await signUpOrSignInFlow(auth, { ...creds, emailRedirectTo: "https://x.test/cb" });
    expect(auth.signUp).toHaveBeenCalledWith({
      ...creds,
      options: { emailRedirectTo: "https://x.test/cb" },
    });
  });

  it("signs a returning customer in when sign-up hides that they exist", async () => {
    const auth = client({}, { session });
    await expect(signUpOrSignInFlow(auth, creds)).resolves.toEqual({ status: "signedIn" });
  });

  it("signs a returning customer in when sign-up says already registered", async () => {
    const auth = client({ error: { message: "User already registered" } }, { session });
    await expect(signUpOrSignInFlow(auth, creds)).resolves.toEqual({ status: "signedIn" });
  });

  it("asks for confirmation when the address is not confirmed yet", async () => {
    const auth = client(
      {},
      { error: { message: "Email not confirmed", code: "email_not_confirmed" } },
    );
    await expect(signUpOrSignInFlow(auth, creds)).resolves.toEqual({ status: "confirmEmail" });
  });

  it("does not send a second email for an account it just made", async () => {
    const auth = client({}, { error: unconfirmed });
    await signUpOrSignInFlow(auth, creds);
    expect(auth.resend).not.toHaveBeenCalled();
  });

  it("gives both readings when sign-up said nothing and the password is wrong", async () => {
    const auth = client({}, { error: wrongPassword });
    await expect(signUpOrSignInFlow(auth, creds)).resolves.toEqual({
      status: "confirmOrWrongPassword",
    });
    expect(COPY.confirmOrWrongPassword).toBe(
      "Check your email for a confirmation link. If you already have an account, that password did not match.",
    );
  });

  it("says the password did not match an existing account", async () => {
    const auth = client(
      { error: { message: "User already registered" } },
      { error: { message: "Invalid login credentials", code: "invalid_credentials" } },
    );
    await expect(signUpOrSignInFlow(auth, creds)).resolves.toEqual({
      status: "existingAccountWrongPassword",
    });
  });

  it("maps any other sign-up failure to plain copy and stops", async () => {
    const auth = client({ error: { message: "Database error saving new user", status: 500 } });
    await expect(signUpOrSignInFlow(auth, creds)).resolves.toEqual({
      status: "error",
      message: "Something went wrong. Please try again.",
    });
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
  });
});

describe("signInWithPasswordFlow", () => {
  it("signs in", async () => {
    await expect(signInWithPasswordFlow(client({}, { session }), creds)).resolves.toEqual({
      status: "signedIn",
    });
  });

  it("uses plain copy for a wrong password", async () => {
    const auth = client({}, { error: { message: "Invalid login credentials" } });
    await expect(signInWithPasswordFlow(auth, creds)).resolves.toEqual({
      status: "error",
      message: "That email or password is not right.",
    });
  });

  it("sends the confirmation again when the address is not confirmed", async () => {
    const auth = client({}, { error: { message: "Email not confirmed" } });
    await expect(
      signInWithPasswordFlow(auth, { ...creds, emailRedirectTo: "https://x.test/cb" }),
    ).resolves.toEqual({ status: "confirmationResent" });
    expect(auth.resend).toHaveBeenCalledWith({
      type: "signup",
      email: creds.email,
      options: { emailRedirectTo: "https://x.test/cb" },
    });
    expect(auth.signInWithPassword).toHaveBeenCalledWith(creds);
    expect(COPY.confirmationResent).toBe(
      "We sent the confirmation email again. Open it, then come back and sign in.",
    );
  });

  it("says the same whether or not the resend worked", async () => {
    const refused = client({}, { error: unconfirmed }, async () => ({
      data: {},
      error: { message: "Email rate limit exceeded", status: 429 },
    }));
    await expect(signInWithPasswordFlow(refused, creds)).resolves.toEqual({
      status: "confirmationResent",
    });

    const threw = client({}, { error: unconfirmed }, async () => {
      throw new TypeError("Failed to fetch");
    });
    await expect(signInWithPasswordFlow(threw, creds)).resolves.toEqual({
      status: "confirmationResent",
    });
  });

  it("only asks for confirmation when there is no way to resend", async () => {
    const { resend: _resend, ...auth } = client({}, { error: unconfirmed });
    void _resend;
    await expect(signInWithPasswordFlow(auth, creds)).resolves.toEqual({
      status: "confirmEmail",
    });
  });

  it("does not resend for any other failure", async () => {
    const auth = client({}, { error: wrongPassword });
    await signInWithPasswordFlow(auth, creds);
    expect(auth.resend).not.toHaveBeenCalled();
  });
});

describe("shortPasswordFlow", () => {
  const short = { email: "a@b.co", password: "sixsix" };

  it("lets a returning customer in with their old short password", async () => {
    const auth = client({}, { session });
    await expect(shortPasswordFlow(auth, short)).resolves.toEqual({ status: "signedIn" });
    expect(auth.signUp).not.toHaveBeenCalled();
  });

  it("says what to do when the short password opens nothing", async () => {
    const message =
      "Passwords need at least 8 characters. If you already have an account, choose I already have an account.";
    for (const error of [wrongPassword, { message: "boom", status: 500 }]) {
      const auth = client({}, { error });
      await expect(shortPasswordFlow(auth, short)).resolves.toEqual({
        status: "error",
        message,
      });
      expect(auth.signUp).not.toHaveBeenCalled();
    }
  });

  it("resends the confirmation when the short password was right", async () => {
    const auth = client({}, { error: unconfirmed });
    await expect(shortPasswordFlow(auth, short)).resolves.toEqual({
      status: "confirmationResent",
    });
  });

  it("survives a sign-in that throws, and never tries an empty password", async () => {
    const auth = client({}, {});
    auth.signInWithPassword.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await expect(shortPasswordFlow(auth, short)).resolves.toMatchObject({ status: "error" });

    const untouched = client({}, { session });
    await expect(
      shortPasswordFlow(untouched, { email: "a@b.co", password: "" }),
    ).resolves.toMatchObject({ status: "error" });
    expect(untouched.signInWithPassword).not.toHaveBeenCalled();
  });
});

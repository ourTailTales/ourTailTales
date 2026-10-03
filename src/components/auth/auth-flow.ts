/**
 * The parts of signing in that are the same on every form: what a password
 * must look like, where an emailed link should land, what to say when
 * something fails, and the "sign up, or sign in if they have been here" step.
 *
 * No React and no Supabase import, so all of it is testable on its own.
 */

import { localPathOrNull } from "@/app/auth/callback/safe-next";

export const MIN_PASSWORD_LENGTH = 8;
export const PASSWORD_HINT = "At least 8 characters.";
export const PASSWORD_TOO_SHORT = "Passwords need at least 8 characters.";

export const COPY = {
  wrongCredentials: "That email or password is not right.",
  generic: "Something went wrong. Please try again.",
  offline: "You are offline. Check your connection and try again.",
  confirmEmail:
    "Check your email to confirm your address. Then come back to this page and sign in.",
  /** Signing in to an address that is still waiting on its confirmation link. */
  confirmationResent:
    "We sent the confirmation email again. Open it, then come back and sign in.",
  existingAccountWrongPassword:
    "You already have an account with this address. That password did not match it.",
  /** Could be a new account waiting on its email, or an old one with another password. */
  confirmOrWrongPassword:
    "Check your email for a confirmation link. If you already have an account, that password did not match.",
  /** A short password on the sign-up form that did not open an existing account either. */
  shortPasswordOrSignIn:
    "Passwords need at least 8 characters. If you already have an account, choose I already have an account.",
  tooManyTries: "Too many tries. Please wait a few minutes and try again.",
  weakPassword: "Please choose a stronger password.",
  samePassword: "That is your current password. Please choose a new one.",
} as const;

type ErrorLike = {
  message?: unknown;
  code?: unknown;
  status?: unknown;
  name?: unknown;
};

function fields(error: unknown): { message: string; code: string; status: number; name: string } {
  const value = (typeof error === "object" && error !== null ? error : {}) as ErrorLike;
  return {
    message: typeof value.message === "string" ? value.message : "",
    code: typeof value.code === "string" ? value.code : "",
    status: typeof value.status === "number" ? value.status : -1,
    name: typeof value.name === "string" ? value.name : "",
  };
}

/** Supabase has worded this several ways across versions. */
export function looksRegistered(error: unknown): boolean {
  const { message, code } = fields(error);
  return (
    code === "user_already_exists" ||
    code === "email_exists" ||
    /already registered|already exists|user already/i.test(message)
  );
}

export function looksUnconfirmed(error: unknown): boolean {
  const { message, code } = fields(error);
  return code === "email_not_confirmed" || /email not confirmed/i.test(message);
}

function looksOffline(error: unknown): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  const { message, status, name } = fields(error);
  return (
    name === "AuthRetryableFetchError" ||
    status === 0 ||
    /failed to fetch|networkerror|network request failed|load failed/i.test(message)
  );
}

/**
 * Plain words for whatever went wrong. The raw string from Supabase or the
 * network is never shown: it is written for developers, and some of it
 * ("Invalid login credentials", "fetch failed") reads as our fault or theirs
 * without saying what to do.
 */
export function authErrorCopy(error: unknown): string {
  if (looksOffline(error)) return COPY.offline;
  const { message, code, status } = fields(error);
  if (code === "invalid_credentials" || /invalid login credentials/i.test(message)) {
    return COPY.wrongCredentials;
  }
  if (looksUnconfirmed(error)) return COPY.confirmEmail;
  if (code === "same_password") return COPY.samePassword;
  if (code === "weak_password") return COPY.weakPassword;
  if (
    status === 429 ||
    code === "over_request_rate_limit" ||
    code === "over_email_send_rate_limit" ||
    /rate limit|too many requests/i.test(message)
  ) {
    return COPY.tooManyTries;
  }
  return COPY.generic;
}

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * The editor, opened on the book that belongs to this address.
 *
 * Only a real-looking address is put in the link. A session with no address,
 * or an empty one, opens the editor plainly instead of `?email=`.
 */
export function createPathForEmail(email: string | null | undefined): string {
  const trimmed = email?.trim();
  return trimmed && EMAIL_SHAPE.test(trimmed)
    ? `/create?email=${encodeURIComponent(trimmed)}`
    : "/create";
}

/**
 * Where a confirmation link should bring the customer back to.
 *
 * A caller that knows the page they were on says so (a saved book's own
 * address, for one) and that page is used if it really is a path on this
 * site. Otherwise it is the editor, on the book for this address.
 */
export function confirmationReturnPath(args: {
  origin: string;
  returnPath?: string | null;
  email?: string | null;
}): string {
  return (
    localPathOrNull(args.returnPath, args.origin) ?? createPathForEmail(args.email)
  );
}

/** Where a confirmation or reset email should bring the customer back to. */
export function authCallbackUrl(origin: string, nextPath: string): string {
  return `${origin}/auth/callback?next=${encodeURIComponent(nextPath)}`;
}

type AuthResponse = {
  data: { session: unknown | null };
  error: unknown | null;
};

/** The calls this needs from `supabase.auth`, so a test can stand in. */
export type PasswordAuthClient = {
  signUp(args: {
    email: string;
    password: string;
    options?: { emailRedirectTo?: string };
  }): Promise<AuthResponse>;
  signInWithPassword(args: { email: string; password: string }): Promise<AuthResponse>;
  /** Sends the confirmation email again. Optional so older stand-ins still fit. */
  resend?(args: {
    type: "signup";
    email: string;
    options?: { emailRedirectTo?: string };
  }): Promise<unknown>;
};

export type PasswordAuthResult =
  | { status: "signedIn" }
  /** The account exists but the address has not been confirmed yet. */
  | { status: "confirmEmail" }
  /** Not confirmed yet, and the confirmation email has just been sent again. */
  | { status: "confirmationResent" }
  /** There is already an account here and this is not its password. */
  | { status: "existingAccountWrongPassword" }
  /**
   * Sign-up said nothing and the password did not sign in. Either a new
   * account waiting on its email, or an existing one with another password.
   */
  | { status: "confirmOrWrongPassword" }
  | { status: "error"; message: string };

/**
 * Sign in. An address that was never confirmed is sent its link again.
 *
 * Saying "check your email" here used to be untrue: signing in sends nothing,
 * and the first confirmation email may be days old or lost. The resend is
 * best effort. Its failure changes nothing the customer can do, so it is not
 * shown.
 */
export async function signInWithPasswordFlow(
  auth: PasswordAuthClient,
  args: { email: string; password: string; emailRedirectTo?: string },
): Promise<PasswordAuthResult> {
  const { data, error } = await auth.signInWithPassword({
    email: args.email,
    password: args.password,
  });
  if (error) {
    if (looksUnconfirmed(error)) {
      if (!auth.resend) return { status: "confirmEmail" };
      try {
        await auth.resend({
          type: "signup",
          email: args.email,
          options: args.emailRedirectTo
            ? { emailRedirectTo: args.emailRedirectTo }
            : undefined,
        });
      } catch {
        // Best effort.
      }
      return { status: "confirmationResent" };
    }
    return { status: "error", message: authErrorCopy(error) };
  }
  if (!data.session) return { status: "error", message: COPY.generic };
  return { status: "signedIn" };
}

/**
 * A password under the minimum, typed into the sign-up form.
 *
 * It cannot become a new account. It may well be an old one: a returning
 * customer on the default form, with a password chosen when the minimum was
 * shorter. So it is tried as a sign-in, quietly, before anyone is told off.
 */
export async function shortPasswordFlow(
  auth: PasswordAuthClient,
  args: { email: string; password: string; emailRedirectTo?: string },
): Promise<PasswordAuthResult> {
  if (args.password.length > 0) {
    try {
      const result = await signInWithPasswordFlow(auth, args);
      // The password was right for either of these.
      if (result.status === "signedIn" || result.status === "confirmationResent") {
        return result;
      }
    } catch {
      // Falls through to the advice below.
    }
  }
  return { status: "error", message: COPY.shortPasswordOrSignIn };
}

/**
 * Sign up, and if that does not hand back a session, sign in.
 *
 * A sign-up comes back without a session in three cases, and Supabase does not
 * say which: the address must be confirmed first; the address already has an
 * account and the project hides that (confirmation on); or it says so outright
 * (confirmation off). Trying the same password as a sign-in settles all three:
 * a returning customer is let in, and anyone else is told exactly what to do.
 */
export async function signUpOrSignInFlow(
  auth: PasswordAuthClient,
  args: { email: string; password: string; emailRedirectTo?: string },
): Promise<PasswordAuthResult> {
  const { data, error } = await auth.signUp({
    email: args.email,
    password: args.password,
    options: args.emailRedirectTo ? { emailRedirectTo: args.emailRedirectTo } : undefined,
  });

  if (!error && data.session) return { status: "signedIn" };
  if (error && !looksRegistered(error)) {
    return { status: "error", message: authErrorCopy(error) };
  }

  const signIn = await auth.signInWithPassword({
    email: args.email,
    password: args.password,
  });
  if (!signIn.error && signIn.data.session) return { status: "signedIn" };
  if (!signIn.error) return { status: "error", message: COPY.generic };
  if (looksUnconfirmed(signIn.error)) return { status: "confirmEmail" };

  const copy = authErrorCopy(signIn.error);
  if (copy === COPY.wrongCredentials) {
    // Sign-up said outright that the address is taken, so this is an existing
    // account and not its password.
    if (error) return { status: "existingAccountWrongPassword" };
    // Sign-up said nothing at all. With confirmation on, that is what both a
    // new account and a hidden existing one look like, and an existing
    // account that never confirmed answers "wrong password" to any password
    // but its own. Both readings are told to the customer.
    return { status: "confirmOrWrongPassword" };
  }
  return { status: "error", message: copy };
}

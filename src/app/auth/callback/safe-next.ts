/** Where a sign-in link lands when it asks for nowhere we trust. */
export const DEFAULT_NEXT = "/create";

/**
 * Turns the `next` parameter of an auth link into a path on this site.
 *
 * The value comes from an emailed link, so anyone can write one. A plain
 * `startsWith("/")` let `//evil.com` and `/\evil.com` through, and a browser
 * reads both as another site. Only a single leading slash followed by
 * something that is neither a slash nor a backslash is accepted, backslashes
 * and control characters are refused anywhere (URL parsing drops tabs and
 * newlines, which would turn `/\t/evil.com` back into `//evil.com`), and the
 * result is resolved against our own origin and checked to still be on it.
 *
 * The same shape is then asked of what comes out. Resolving collapses dot
 * segments, so `/.//evil.com` went in looking like a path and came out as
 * `//evil.com`: checking only the input let that through.
 */
export function safeNextPath(
  requested: string | null | undefined,
  origin: string,
): string {
  return localPathOrNull(requested, origin) ?? DEFAULT_NEXT;
}

/** The same check, for a caller with its own idea of where to go instead. */
export function localPathOrNull(
  requested: string | null | undefined,
  origin: string,
): string | null {
  if (!requested) return null;
  if (!looksLikeLocalPath(requested)) return null;
  for (let index = 0; index < requested.length; index += 1) {
    const code = requested.charCodeAt(index);
    if (code < 0x20 || code === 0x7f) return null;
  }

  try {
    const base = new URL(origin);
    const resolved = new URL(requested, base);
    if (resolved.origin !== base.origin) return null;

    const result = `${resolved.pathname}${resolved.search}${resolved.hash}`;
    if (result !== "/" && !looksLikeLocalPath(result)) return null;
    if (new URL(result, base).origin !== base.origin) return null;
    return result;
  } catch {
    return null;
  }
}

/** One leading slash, then anything but a slash or a backslash, and no backslash at all. */
function looksLikeLocalPath(value: string): boolean {
  if (value.includes("\\")) return false;
  return /^\/[^/\\]/.test(value);
}

/** Has its own "this link did not work" state for a visitor with no session. */
const RESET_PASSWORD_PATH = "/reset-password";

/**
 * Where to go when the emailed code could not be exchanged.
 *
 * The usual cause is a confirmation link opened in a different browser from
 * the one that asked for it. The address is confirmed by then, so the claim
 * page is the useful place to land: they can sign in there. A reset link goes
 * to the reset page, which says the link did not work and how to get another.
 * Anything else goes to the editor with the notice it already knows how to
 * show, keeping the address so the right book opens.
 */
export function failedNextPath(next: string, origin: string): string {
  const url = new URL(next, origin);
  if (url.pathname.startsWith("/claim/")) {
    url.searchParams.set("mode", "signin");
    return `${url.pathname}${url.search}`;
  }
  if (url.pathname === RESET_PASSWORD_PATH) return RESET_PASSWORD_PATH;
  const fallback = new URL(DEFAULT_NEXT, origin);
  if (url.pathname === DEFAULT_NEXT) {
    const email = url.searchParams.get("email");
    if (email) fallback.searchParams.set("email", email);
  }
  fallback.searchParams.set("authError", "callback");
  return `${fallback.pathname}${fallback.search}`;
}

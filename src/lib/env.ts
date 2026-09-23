/**
 * Server-side environment access.
 *
 * Every integration is wired for real, but ourTailTales must fail loudly and
 * clearly when a key has not been provided yet rather than silently faking a
 * result.
 */

export class MissingEnvError extends Error {
  constructor(readonly names: string[]) {
    super(`Missing environment variable${names.length > 1 ? "s" : ""}: ${names.join(", ")}`);
    this.name = "MissingEnvError";
  }
}

export function readEnv(name: string): string | undefined {
  const value = process.env[name];
  return value && value.length > 0 ? value : undefined;
}

export function requireEnv(...names: string[]): string[] {
  const missing = names.filter((name) => !readEnv(name));
  if (missing.length > 0) throw new MissingEnvError(missing);
  return names.map((name) => readEnv(name)!);
}

export function isConfigured(...names: string[]): boolean {
  return names.every((name) => Boolean(readEnv(name)));
}

/** Consistent JSON error shape for every route handler. */
export function routeError(error: unknown, fallback: string): Response {
  if (error instanceof MissingEnvError) {
    // Which key is missing is an operator's problem, and the log is where
    // operators look. The customer is told the step is unavailable.
    console.error("[ourTailTales] Not configured:", error.names.join(", "));
    return Response.json(
      {
        error: "ourTailTales is not set up for this step yet.",
        code: "not_configured",
      },
      { status: 503 },
    );
  }

  // Deliberately not `error.message`. That string is written by Postgres,
  // Stripe, Supabase and Lulu, and it carries table names, column names,
  // constraint names and query fragments. It goes to the log, where we can
  // read it, and never to the caller, who cannot do anything with it except
  // learn how the inside is put together.
  console.error("[ourTailTales]", error);
  return Response.json({ error: fallback }, { status: 500 });
}

/**
 * Base URL for links this server builds: book links in email, Stripe
 * success/cancel URLs.
 *
 * Every preview deployment gets its own hostname, so a fixed
 * NEXT_PUBLIC_SITE_URL scoped to Preview would send each rehearsal's emails and
 * Stripe redirects back to production. Leave it unset outside production and
 * this falls through to the per-branch alias Vercel exposes, which is stable
 * across redeploys of the same branch.
 *
 * Server-side only. `VERCEL_BRANCH_URL` is not inlined into the client bundle,
 * so anything running in the browser must use `window.location.origin`.
 */
export function resolveSiteUrl(): string {
  const explicit = readEnv("NEXT_PUBLIC_SITE_URL");
  if (explicit) return explicit;

  // VERCEL_BRANCH_URL is the branch alias; VERCEL_URL is the per-deployment
  // hostname. Both require "Automatically expose System Environment Variables".
  const vercelHost = readEnv("VERCEL_BRANCH_URL") ?? readEnv("VERCEL_URL");
  if (vercelHost) return `https://${vercelHost}`;

  return "http://localhost:3000";
}

export const SITE_URL = resolveSiteUrl();

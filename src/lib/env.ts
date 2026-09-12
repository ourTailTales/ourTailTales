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
    return Response.json(
      {
        error: `ourTailTales is not configured for this step yet (${error.names.join(", ")}).`,
        code: "not_configured",
      },
      { status: 503 },
    );
  }

  console.error("[ourTailTales]", error);
  const message = error instanceof Error ? error.message : fallback;
  return Response.json({ error: message || fallback }, { status: 500 });
}

export const SITE_URL =
  readEnv("NEXT_PUBLIC_SITE_URL") ?? "http://localhost:3000";

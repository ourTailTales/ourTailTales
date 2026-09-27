/**
 * Whether a Supabase error means `column` does not exist in the database yet.
 *
 * This is what code that shipped ahead of its migration sees. PostgREST
 * rejects a write that names an unknown column with PGRST204 ("not in the
 * schema cache") before anything runs, and Postgres rejects a filter on one
 * with 42703. Both messages name the column, so this only matches the one the
 * caller asks about and every other error still throws.
 */
export function isMissingColumnError(
  error: { code?: string; message?: string } | null | undefined,
  column: string,
): boolean {
  if (!error) return false;
  if (error.code !== "PGRST204" && error.code !== "42703") return false;
  return (error.message ?? "").includes(column);
}

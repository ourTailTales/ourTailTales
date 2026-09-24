-- Same gap as rate_limit_hit and rls_auto_enable, but forward-looking.
--
-- Supabase's own project-level default ACLs grant EXECUTE on every new
-- public-schema function to anon and authenticated automatically (visible in
-- pg_default_acl), the same way plain Postgres defaults EXECUTE to PUBLIC.
-- Without this, the next SECURITY DEFINER helper anyone adds -- another rate
-- limiter, an internal accounting function, anything not meant to be a public
-- RPC endpoint -- starts world-callable through PostgREST on day one, exactly
-- like rate_limit_hit did. This mirrors lock_down_api_grants.sql's existing
-- "alter default privileges ... revoke all on tables" for tables, applied to
-- functions instead.
--
-- Nothing existing needs a fresh grant back: every function callers currently
-- rely on (book_projects' RLS-gated access is table-level, not a function)
-- goes through the service role, which is unaffected by anon/authenticated
-- default privileges.
alter default privileges in schema public
  revoke execute on functions from anon, authenticated;

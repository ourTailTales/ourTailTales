-- Postgres grants EXECUTE to PUBLIC by default when a function is created,
-- and PUBLIC is a pseudo-role every other role belongs to -- so the earlier
-- "revoke all ... from anon, authenticated" on rate_limit_hit never actually
-- closed the door: anon and authenticated still had EXECUTE by way of PUBLIC,
-- and Supabase's PostgREST layer exposes every public-schema function as an
-- RPC endpoint unless EXECUTE is revoked. An unauthenticated caller could hit
-- /rest/v1/rpc/rate_limit_hit directly with a bucket name of their choosing
-- (order and draft ids are not secret; they ride in URLs) and write whatever
-- count and window they liked into another customer's rate-limit bucket,
-- exhausting it before the real request ever arrives -- a targeted denial of
-- service against one customer's own order or draft, using our own limiter
-- against them.
--
-- rls_auto_enable is worse off: it is an event-trigger function, meant to
-- fire only from the DDL event trigger it is attached to, and it had EXECUTE
-- granted to PUBLIC, anon and authenticated outright. Calling it directly
-- errors (it depends on event-trigger-only context), so this was not
-- exploitable, but a SECURITY DEFINER function with no business being called
-- by anyone is exactly what this class of linter finding exists to catch.
--
-- service_role and postgres keep EXECUTE on both; this only closes the public
-- and anon/authenticated paths that PostgREST would otherwise expose.
revoke execute on function public.rate_limit_hit(text, integer, integer)
  from public;

revoke execute on function public.rls_auto_enable()
  from public, anon, authenticated;

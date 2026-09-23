-- Defence in depth under RLS.
--
-- Every table here was granted full CRUD — TRUNCATE included — to `anon` and
-- `authenticated` by the default Supabase grants. RLS with no policies denies
-- all of it today, so nothing is currently exposed, but that leaves exactly
-- one thing between the public PostgREST API and these tables. One accidental
-- permissive policy, or one `disable row level security`, and they are
-- world-writable with no second line.
--
-- Only `book_projects` is ever touched from the browser (via the user's own
-- session in src/lib/books/cloud.ts). Everything else is reached exclusively
-- by the service role in route handlers, which bypasses both RLS and grants.
-- So the API roles are revoked outright: the tables stop being reachable
-- through the API at all, rather than being reachable-but-denied.

revoke all privileges on table
  public.book_drafts,
  public.leads,
  public.orders,
  public.order_shipping,
  public.order_video_memories,
  public.video_assets,
  public.video_memory_placements
from anon, authenticated;

-- book_projects stays reachable, but only for signed-in users and only with
-- the four verbs its policies actually cover. TRUNCATE, REFERENCES and TRIGGER
-- are never needed by a client and are not given back.
revoke all privileges on table public.book_projects from anon, authenticated;
grant select, insert, update, delete on table public.book_projects to authenticated;

-- New tables in this schema should not inherit blanket CRUD either. This only
-- affects objects created later by the same role.
alter default privileges in schema public
  revoke all on tables from anon, authenticated;

-- Fixed-window rate limiting, counted in Postgres rather than in memory.
--
-- Serverless instances multiply under load, so an in-process counter is
-- bypassed by the same concurrency it is meant to stop. This is shared state,
-- so N instances still share one budget.

create table if not exists public.rate_limits (
  bucket       text        not null,
  window_start timestamptz not null,
  count        integer     not null default 0,
  primary key (bucket, window_start)
);

create index if not exists rate_limits_window_start_idx
  on public.rate_limits (window_start);

alter table public.rate_limits enable row level security;

-- Server-only, like every other operational table here.
revoke all on public.rate_limits from anon, authenticated;

/**
 * Records one hit and reports whether the caller is still inside its budget.
 *
 * Atomic: the insert-or-increment and the read are one statement, so two
 * concurrent requests cannot both see the pre-increment count.
 */
create or replace function public.rate_limit_hit(
  p_bucket         text,
  p_window_seconds integer,
  p_limit          integer
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window timestamptz;
  v_count  integer;
begin
  v_window := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );

  insert into public.rate_limits as r (bucket, window_start, count)
  values (p_bucket, v_window, 1)
  on conflict (bucket, window_start)
    do update set count = r.count + 1
  returning r.count into v_count;

  -- Prune old windows roughly once every hundred calls. Doing it on every
  -- request would spend more time tidying than limiting.
  if random() < 0.01 then
    delete from public.rate_limits where window_start < now() - interval '1 day';
  end if;

  return v_count <= p_limit;
end;
$$;

revoke all on function public.rate_limit_hit(text, integer, integer) from anon, authenticated;

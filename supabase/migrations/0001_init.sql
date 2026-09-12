-- ourTailTales MVP schema.
--
-- There is no Supabase Auth and no browser-side Supabase client. Every table is
-- deny-all under RLS; the server reaches them with the service-role key only.

create extension if not exists "pgcrypto";

/* ----------------------------------- leads ---------------------------------- */

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  pet_name text,
  photo_count integer,
  chapter_count integer,
  quoted_price numeric(10, 2),
  utm_source text,
  utm_medium text,
  utm_campaign text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists leads_created_at_idx on public.leads (created_at desc);

/* ---------------------------------- orders ---------------------------------- */

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  email text,
  pet_name text,
  chapter_count integer not null,
  story_pages integer not null,
  total_pages integer not null,
  book_price numeric(10, 2) not null,
  shipping_price numeric(10, 2),
  stripe_payment_intent_id text unique,
  status text not null default 'pending_payment',
  lulu_print_job_id text unique,
  lulu_status text,
  lulu_status_message text,
  review_reason text,
  interior_path text,
  cover_path text,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  submitted_at timestamptz,
  constraint orders_status_check check (
    status in (
      'pending_payment',
      'paid',
      'submitted',
      'production',
      'shipped',
      'delivered',
      'rejected',
      'needs_review',
      'canceled'
    )
  )
);

create index if not exists orders_status_idx on public.orders (status);
create index if not exists orders_created_at_idx on public.orders (created_at desc);
create index if not exists orders_payment_intent_idx
  on public.orders (stripe_payment_intent_id);

/* ------------------------------- order_shipping ------------------------------ */

create table if not exists public.order_shipping (
  order_id uuid primary key references public.orders (id) on delete cascade,
  name text not null,
  phone text not null,
  street1 text not null,
  street2 text,
  city text not null,
  state text not null,
  postcode text not null,
  country text not null default 'US',
  shipping_level text not null,
  created_at timestamptz not null default now()
);

/* ------------------------------------ RLS ----------------------------------- */

alter table public.leads enable row level security;
alter table public.orders enable row level security;
alter table public.order_shipping enable row level security;

-- No policies are created on purpose. With RLS enabled and no policy, anon and
-- authenticated roles are denied everything; the service-role key bypasses RLS.

/* ---------------------------------- storage --------------------------------- */

-- Private bucket for the two temporary print PDFs per order. Clients only ever
-- receive short-lived signed URLs minted by the server.
insert into storage.buckets (id, name, public, file_size_limit)
values (
  'ourtailtales-orders',
  'ourtailtales-orders',
  false,
  524288000 -- 500 MB, enough for a 124-page interior at print resolution
)
on conflict (id) do update set public = false;

-- Video Memories: drafts, library assets, placements, order snapshots.
-- original_bytes is bigint with no 500 MB CHECK. Pack pricing is not stored
-- as a video-count cap. Placement delete must not cascade to video_assets.

create table if not exists public.book_drafts (
  id uuid primary key default gen_random_uuid(),
  secret_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.video_assets (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references public.book_drafts (id) on delete cascade,
  title text not null default '',
  original_path text not null,
  processed_path text,
  thumbnail_path text,
  duration_ms integer,
  original_bytes bigint not null,
  processed_bytes bigint,
  processed_width integer,
  processed_height integer,
  content_sha256 text,
  status text not null default 'uploaded',
  processing_attempt_count integer not null default 0,
  processing_error_code text,
  processing_next_retry_at timestamptz,
  processing_started_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint video_assets_status_check check (
    status in ('uploaded', 'processing', 'ready', 'failed')
  ),
  constraint video_assets_bytes_nonneg check (original_bytes >= 0)
);

create index if not exists video_assets_draft_idx on public.video_assets (draft_id);
create index if not exists video_assets_status_idx on public.video_assets (status);

create table if not exists public.video_memory_placements (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references public.book_drafts (id) on delete cascade,
  video_asset_id uuid not null references public.video_assets (id),
  page_id text not null,
  title text,
  caption text,
  x double precision not null,
  y double precision not null,
  width double precision not null,
  height double precision not null,
  z_index integer,
  created_at timestamptz not null default now()
);

create index if not exists video_memory_placements_draft_idx
  on public.video_memory_placements (draft_id);
create index if not exists video_memory_placements_asset_idx
  on public.video_memory_placements (video_asset_id);

alter table public.orders
  add column if not exists draft_id uuid references public.book_drafts (id),
  add column if not exists book_snapshot jsonb,
  add column if not exists frozen_interior_path text,
  add column if not exists fulfillment_stage text,
  add column if not exists archival_consent_at timestamptz,
  add column if not exists selected_video_count integer,
  add column if not exists video_memory_pack_count integer,
  add column if not exists video_memory_pack_unit_price_cents integer,
  add column if not exists video_memory_total_cents integer,
  add column if not exists estimated_permanent_bytes bigint,
  add column if not exists estimated_permanent_storage_cost numeric(12, 6),
  add column if not exists estimated_video_memory_margin_cents integer,
  add column if not exists fulfill_attempt_count integer not null default 0,
  add column if not exists fulfill_next_retry_at timestamptz,
  add column if not exists fulfill_error_code text;

create table if not exists public.order_video_memories (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  video_asset_id uuid not null references public.video_assets (id),
  archival_id uuid not null default gen_random_uuid(),
  processed_path text not null,
  processed_bytes bigint not null,
  content_sha256 text not null,
  duration_ms integer not null,
  width integer not null,
  height integer not null,
  wrapped_key text,
  arweave_tx_id text,
  viewer_tx_id text,
  encrypted_bytes bigint,
  estimated_storage_cost numeric(12, 6),
  status text not null default 'pending',
  attempt_count integer not null default 0,
  next_retry_at timestamptz,
  error_code text,
  created_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint order_video_memories_status_check check (
    status in ('pending', 'archiving', 'verified', 'failed')
  ),
  constraint order_video_memories_unique_asset unique (order_id, video_asset_id),
  constraint order_video_memories_unique_archival unique (order_id, archival_id)
);

create index if not exists order_video_memories_order_idx
  on public.order_video_memories (order_id);
create index if not exists order_video_memories_status_idx
  on public.order_video_memories (status);

alter table public.book_drafts enable row level security;
alter table public.video_assets enable row level security;
alter table public.video_memory_placements enable row level security;
alter table public.order_video_memories enable row level security;

-- Raise the private bucket file cap so a later 1 GB source env value
-- does not fail against a 500 MB infrastructure limit.
update storage.buckets
set file_size_limit = 1073741824
where id = 'ourtailtales-orders';

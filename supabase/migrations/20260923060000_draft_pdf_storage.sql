-- Phase 1: store the free preview PDF server-side so it can be opened from a
-- link (email, another device) instead of living only in the browser that
-- made it.
--
-- Two PDFs are kept per draft. Photos never leave the browser, so the server
-- can never re-render a book it did not receive: the clean file has to be
-- banked at generation time or it is gone forever. The $4.99 purchase then
-- only flips `digital_purchased_at` rather than regenerating anything.

alter table public.book_drafts
  -- Watermarked copy. Served to everyone until the digital tier is bought.
  add column if not exists pdf_storage_path text,
  -- Unwatermarked copy. Written at the same moment, released on purchase.
  add column if not exists clean_pdf_storage_path text,
  add column if not exists pdf_stored_at timestamptz,
  -- Free drafts are reaped 30 days after creation (Phase 4). Any purchase
  -- clears this, which is what makes the row permanent.
  add column if not exists expires_at timestamptz,
  add column if not exists watermarked boolean not null default true,
  add column if not exists digital_purchased_at timestamptz,
  -- Denormalised so the preview page can render a heading without holding a
  -- book snapshot. Both are cosmetic and safe to be empty.
  add column if not exists pet_name text not null default '',
  add column if not exists chapter_count integer;

-- Phase 4's cron sweeps on this predicate; without the index it degrades into
-- a full scan of every draft ever created.
create index if not exists book_drafts_expiry_idx
  on public.book_drafts (expires_at)
  where digital_purchased_at is null;

comment on column public.book_drafts.pdf_storage_path is
  'book-previews path to the watermarked free PDF.';
comment on column public.book_drafts.clean_pdf_storage_path is
  'book-previews path to the unwatermarked PDF. Released once digital_purchased_at is set.';
comment on column public.book_drafts.expires_at is
  'Free-tier reaping deadline. Null means the draft has been paid for and is kept.';

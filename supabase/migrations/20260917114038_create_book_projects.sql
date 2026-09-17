-- Authenticated free-book previews. This migration is independent of the
-- unfinished order and Video Memory schema.

create table if not exists public.book_projects (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  local_draft_id uuid not null,
  pet_name text not null default '',
  status text not null default 'ready',
  book_snapshot jsonb not null,
  preview_pdf_path text not null,
  cover_preview_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint book_projects_status_check check (status in ('saving', 'ready', 'failed')),
  constraint book_projects_user_draft_unique unique (user_id, local_draft_id)
);

create index if not exists book_projects_user_updated_idx
  on public.book_projects (user_id, updated_at desc);

alter table public.book_projects enable row level security;

grant select, insert, update, delete on public.book_projects to authenticated;

create policy "Users read their own book projects"
on public.book_projects for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users create their own book projects"
on public.book_projects for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users update their own book projects"
on public.book_projects for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users delete their own book projects"
on public.book_projects for delete
to authenticated
using ((select auth.uid()) = user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'book-previews',
  'book-previews',
  false,
  52428800,
  array['application/pdf', 'image/jpeg', 'image/webp']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Users read their own book previews"
on storage.objects for select
to authenticated
using (
  bucket_id = 'book-previews'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "Users upload their own book previews"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'book-previews'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "Users replace their own book previews"
on storage.objects for update
to authenticated
using (
  bucket_id = 'book-previews'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'book-previews'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "Users delete their own book previews"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'book-previews'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

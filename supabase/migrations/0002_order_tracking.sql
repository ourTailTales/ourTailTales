-- Persist carrier tracking URLs returned by Lulu webhooks / reconciliation.

alter table public.orders
  add column if not exists tracking_urls text[];

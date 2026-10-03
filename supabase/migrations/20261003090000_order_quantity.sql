-- Extra copies of the same book on one order.
--
-- `book_price` stays the price of one copy. The charge for the books is
-- `copiesTotal(book_price, quantity)` in src/lib/pricing.ts: the first copy at
-- full price, each further copy at EXTRA_COPY_DISCOUNT off. Defaulting to 1
-- keeps every existing order, and any OLDER deployment, behaving exactly as
-- before.
--
-- APPLY BEFORE DEPLOYING the code that ships with it. That code selects this
-- column by name on the order page, in checkout and in the payment webhook,
-- and has no fallback for a database that lacks it.
alter table public.orders
  add column if not exists quantity integer not null default 1
  check (quantity between 1 and 5);

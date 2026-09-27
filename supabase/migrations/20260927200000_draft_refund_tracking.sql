-- A refunded or disputed digital PDF purchase currently keeps its buyer's
-- access forever: `charge.refunded` and `charge.dispute.created` are handled
-- for hardcover orders (matched by `orders.stripe_payment_intent_id`), but a
-- digital purchase only ever flips `digital_purchased_at` on `book_drafts`
-- and is never linked to the payment that granted it, so there is nothing to
-- match a refund event against. This stores that link so a refund can revoke
-- what it paid for, the same way a hardcover refund already stops a print job.

alter table public.book_drafts
  add column if not exists digital_stripe_payment_intent_id text;

create unique index if not exists book_drafts_digital_payment_intent_idx
  on public.book_drafts (digital_stripe_payment_intent_id)
  where digital_stripe_payment_intent_id is not null;

comment on column public.book_drafts.digital_stripe_payment_intent_id is
  'The PaymentIntent behind this draft''s $4.99 purchase. Set alongside digital_purchased_at, and what a charge.refunded or charge.dispute.created event is matched against to revoke access.';

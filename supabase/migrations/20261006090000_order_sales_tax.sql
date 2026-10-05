-- US sales tax on a hardcover order.
--
-- `tax_price` is the sales tax charged on the order, in dollars, worked out by
-- Stripe Tax when delivery is chosen. It is locked and unlocked together with
-- `shipping_price`, and `expectedOrderAmount` in src/lib/order/amount.ts adds
-- it to the total. Null means no tax, which is every order placed before this
-- and every order while STRIPE_TAX_ENABLED is off.
--
-- `tax_calculation_id` is the Stripe Tax calculation the amount came from. The
-- payment webhook turns it into a tax transaction (`tax_transaction_id`) once
-- the money has landed, which is what Stripe's tax reports are built from, and
-- a full refund reverses that transaction.
--
-- APPLY BEFORE DEPLOYING the code that ships with it: checkout, the order page
-- and the payment webhook select these columns by name.
alter table public.orders
  add column if not exists tax_price numeric(10, 2) check (tax_price is null or tax_price >= 0),
  add column if not exists tax_calculation_id text,
  add column if not exists tax_transaction_id text;

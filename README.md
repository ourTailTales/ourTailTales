# ourTailTales

Memory book creation software — a [Next.js](https://nextjs.org) app (React, TypeScript, Tailwind CSS).

## Getting Started

Install dependencies (if needed), then run the development server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

## Environment variables

1. Copy the example file:

```bash
cp .env.example .env.local
```

2. Edit `.env.local` with your values. `.env.example` is the authoritative list —
   every variable is documented there with what it does and which environment it
   belongs to.

`NEXT_PUBLIC_*` variables are available in the browser and are inlined at **build**
time, so changing one in Vercel does nothing until the next deploy. Keep secrets
server-only (no `NEXT_PUBLIC_` prefix). `.env`, `.env.local`, and other env files are
gitignored; commit `.env.example` only.

**`.env.local` always holds TEST values.** Live Stripe keys belong only to the
Production environment in Vercel, and `src/lib/stripe.ts` throws if a live key turns up
anywhere else. Note that `.env.local` outranks `.env.production` in Next.js's lookup
order, so do not add a `.env.production` expecting it to win.

Most secrets in Vercel are stored as its "Sensitive" type, which is write-only — they
cannot be read back, so `vercel env pull` will not reconstruct this file. Maintain it by
hand.

## Scripts

```bash
npm run dev            # development server
npm run build          # production build
npm run start          # run production build
npm run lint           # ESLint
npm test               # vitest
npm run stripe:listen  # forward Stripe test webhooks to localhost (see below)
```

## Testing payments locally

Local development is already in Stripe test mode — nothing to switch. Use card
`4242 4242 4242 4242` with any future expiry and any CVC.

**You only need `stripe:listen` when you complete a checkout locally.** Access to a
paid book is granted *only* by the webhook (`src/app/api/stripe/webhook/route.ts`), so
without a listener a local test purchase succeeds in Stripe and the book never unlocks —
the page sits on "Payment received, unlocking now" forever. For anything that does not
finish a checkout — the editor, the landing page, book generation — you do not need it.

One-time setup:

```bash
brew install stripe/stripe-cli/stripe
stripe login
```

Then, in a second terminal alongside `npm run dev`:

```bash
npm run stripe:listen
```

**The secret it prints is not the one in `.env.local`.** `stripe listen` signs with its
own webhook secret, different from the dashboard endpoint's. On first run it prints
something like `whsec_...` — copy that into `STRIPE_WEBHOOK_SECRET` in `.env.local` once
and it stays valid for future runs. Skip this and every forwarded event fails signature
verification with a 400, which looks exactly like a broken webhook.

There is no deployed environment that Stripe can reach with test keys: preview
deployments are `*.vercel.app`, which Vercel's Deployment Protection puts behind a login
wall, while the verified custom domains are exempt and run live keys. So local forwarding
is the way to exercise the paid flow.

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Learn Next.js](https://nextjs.org/learn)

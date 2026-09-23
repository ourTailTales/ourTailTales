# ourTailTales — handoff

**Date:** 2026-09-23 · **Branch:** `feat/book-link-digital-tier-expiry` · **Commit:** `83be8c6` (on top of `ada3e0c`)
**State:** committed locally, **not pushed** — see [Blocked](#blocked-needs-a-human).

Phases 1–5 of `AGENT_GUIDELINES.md` are implemented. Lint, 106 tests and
typecheck pass. `npm run build` has **never been run successfully anywhere** —
see Blocked.

---

## 1. Read this before trusting AGENT_GUIDELINES.md

That document is accurate about intent and wrong about the codebase in three
places. All three cost real time to discover:

| It says | Reality |
|---|---|
| §6 "Resend email infrastructure (already built)", lists 5 files | **None existed.** No `src/lib/email/`, no `resend` dependency. Phase 2 was new construction, not a refactor. |
| Phase 1 "create `/book/[draftId]`" | `src/app/book/[id]/` already existed. Next.js rejects sibling dynamic segments with different slug names — it is a build error. Resolved by making one route serve both. |
| Phase 1 "API route that accepts a base64-encoded PDF" | Would break in production. A full book at preview resolution clears Vercel's 4.5 MB body cap, and base64 adds a third again. The browser now uploads to storage through a signed URL. |

Also: `supabase/migrations/` was **two migrations ahead of the live database**
when this work started. `book_drafts` and the `book-previews` bucket did not
exist. All migrations are now applied (§3).

---

## 2. What was built

### Phase 1 — bank the PDF, serve it from a link
- `src/lib/book/watermark.ts` — diagonal `PREVIEW — ourtailtales.com`, periwinkle
  15%, 36pt, 45°, centred by measuring the string so it works on any trim.
  Applied **server-side**; the renderer's own `watermark` flag is client-controlled
  and therefore not trustworthy.
- `src/app/api/drafts/upload-pdf/route.ts` — `POST` signs an upload, `PUT`
  watermarks what landed and banks both copies.
- **Both a clean and a watermarked PDF are stored at generation time.** Photos
  never leave the browser, so the server can never re-render a book it did not
  receive. Purchase flips a flag; it does not regenerate.
- `src/app/book/[id]/page.tsx` — free preview when `?k=<secret>` resolves a
  draft, otherwise the pre-existing signed-in `book_projects` view.

### Phase 2 — email
- `src/lib/email/{resend,send,templates}.ts`, `src/app/api/email/send-sample/`.
- Senders are fire-and-forget and **no-op without `RESEND_API_KEY`**.
- `send-sample` authenticates with the **draft secret**, not a bare id: the link
  it sends contains that secret, so a route keyed on id alone would let anyone
  who learned a draft id have a working link mailed anywhere.
- Order-confirmation and shipping emails are now wired into the Stripe and Lulu
  webhooks, each guarded against redelivery.

### Phase 3 — $4.99 digital
- `src/app/api/stripe/checkout-digital/` + `checkout.session.completed` in the
  Stripe webhook. Price from `pricing.ts`; access granted **only** by the webhook.
- Handles the window where Stripe redirects before the webhook lands — otherwise
  a paying customer sees the upgrade button again and assumes failure.

### Phase 4 — expiry
- `src/lib/cron/expire-drafts.ts`. **Anonymises rather than deletes**, because
  `orders.draft_id` and `video_assets.draft_id` both FK into `book_drafts`.
  Keeps `pdf_stored_at`/`expires_at` so an expired link still explains itself.
- Checks `orders` explicitly for a hardcover purchase — a hardcover leaves no
  mark on the draft row, which the plan's predicate missed.

### Phase 5 — no code
Flag is `src/components/Funnel.tsx` (`enableVideoMemories={false}`). All four
secrets are unset: `VIDEO_MEMORY_WRAP_KEY`, `TURBO_PAYMENT_KEY`, `ARWEAVE_JWK`,
`ARWEAVE_PLAYER_TX`. `encrypt.ts` needs exactly 32 bytes of hex and its own
comment warns that losing the key after archival but before QR printing strands
videos permanently. **Generate it once and back it up.**

### Beyond the plan
- **Cron consolidation.** Hobby allows 2 cron entries; there were 5.
  `src/app/api/cron/daily/` runs every job in one invocation to a 45s budget
  (60s `maxDuration`), isolating failures and skipping the Video Memory jobs
  while unconfigured. Individual routes still work for manual runs.
- **Analytics leak fixed.** PostHog captures `$current_url` verbatim, so
  `/book/<id>?k=<secret>` was shipping the key to every paid book into analytics.
  `src/lib/analytics-redact.ts` + `sanitize_properties`.
- **Stripe key-mode guard** (`src/lib/stripe.ts`). Live key outside production
  throws; test key in production warns; mismatched secret/publishable pair throws.
  Environment comes from `VERCEL_ENV` only — `NODE_ENV` is deliberately ignored
  because `next build && next start` sets it to `production` on a laptop.
- **`useIsAuthenticated` implemented.** It returned a hardcoded `false`, so every
  signed-in customer saw the signed-out CTA on the landing page.

---

## 3. Infrastructure state

**Supabase** (`alxobaxblbzmchrvvbbz`) — all migrations applied and verified.
`book_drafts` has all 12 columns; partial expiry index present; `book-previews`
bucket private, 50 MB.

**RLS.** Adding policies would have *weakened* things — RLS with no policies is
deny-all. The real hole was underneath: every table granted full CRUD **including
TRUNCATE** to `anon` and `authenticated`, leaving RLS as the only barrier.
`20260923071500_lock_down_api_grants.sql` revokes those grants on all seven
server-only tables. `book_projects` keeps the four verbs its policies cover.
Verified by assuming the roles: `anon`/`authenticated` get `insufficient_privilege`,
`service_role` still reads.

**Stripe.** Test-mode webhook exists on `our-tail-tales.vercel.app/api/stripe/webhook`
(`checkout.session.completed`, `payment_intent.succeeded`, `payment_intent.payment_failed`).
**No live-mode webhook exists** — creating it was blocked.

**Resend.** Send-only key issued, set in `.env.local` and Vercel. **No verified
domain**, so `EMAIL_FROM` stays on `onboarding@resend.dev`, which delivers only
to the account owner. A test send reported `delivered` but had not appeared in
the inbox within ~5 minutes; the same sender has landed there before, so likely
delay rather than block. **Unresolved — re-check.**

**Vercel.** `NEXT_PUBLIC_SITE_URL` and `RESEND_API_KEY` set; `STRIPE_WEBHOOK_SECRET`
holds the test-mode secret on production+preview.

---

## 4. Blocked — needs a human

1. **Push.** `git push -u origin feat/book-link-digital-tier-expiry` — the agent
   sandbox has no GitHub credentials.
2. **`npm run build` never verified.** The sandbox cannot reach
   `fonts.googleapis.com` (proxy 403) and `layout.tsx` loads five Google fonts.
   **Every build error seen was that and only that.** Vercel will be the first
   real build.
3. **Deployment Protection (SSO) is ON**, `all_except_custom_domains`. Stripe and
   Lulu webhooks cannot authenticate through it, and customers hit a login wall.
   **This breaks the existing hardcover flow too, not just the new work.**
4. **Stripe keys.** `STRIPE_SECRET_KEY` and `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
   are empty in `.env.local` and Vercel. Reading them was blocked as credential
   materialization. Needs: test pair on Preview+Development, live pair on
   Production, plus a live webhook and its secret on Production.
5. **Roll the live Stripe secret key** — it was pasted into a chat transcript.
6. **UI review never done.** §13 requires inspection at mobile and desktop widths.
   Nothing new has been seen in a browser.

---

## 5. Known gaps not caused by this work

- **`saveBookProject` (`src/lib/books/cloud.ts`) is called from nowhere.** The
  whole "save your book to your account" feature — `book_projects`, the auth-gated
  viewer, its RLS policies, the user-scoped storage policies — exists to serve a
  function nothing invokes. Left in place deliberately; it is half-built, not dead.
- `EmailSampleModal` now downloads the 5-page sample **and** emails a link to the
  full book. Faithful to §3, but the two artifacts differ. Possibly worth
  simplifying to just the link.
- The Stripe success URL and `metadata.draftSecret` put the draft secret in
  Stripe's records. Necessary for the redirect to land on a readable book; a
  one-time exchange token would avoid it.
- Watermark at 15% opacity was only judged over white. **Check it over a
  full-bleed photo** — it may be too faint.

---

## 6. Conventions worth keeping

- Read `AGENTS.md`. Next.js 16 — consult `node_modules/next/dist/docs/`.
- Draft-authenticated routes use `x-draft-id` + `Authorization: Bearer <secret>`
  via `resolveDraft()`.
- Storage paths: `drafts/<id>/{clean,preview}.pdf`. The literal `drafts/` prefix
  can never match a uuid, so the `book-previews` RLS policies make these
  unreachable by any end user — service role only, by design.
- Cron jobs live in `src/lib/cron/`; routes are thin wrappers. Add new jobs to the
  `JOBS` array in `src/app/api/cron/daily/route.ts`, not to `vercel.ts`.
- Secrets never leave the server. The environment selects keys; code only
  verifies the selection.

# ourTailTales: Complete AI Agent Handoff

Last assembled: 2026-09-19 (Asia/Ho_Chi_Minh)

This document is the working context for an AI agent joining the ourTailTales project. It combines the current application repository, the original product and brand briefs, market research, Lulu integration work, and prior launch audits. It deliberately separates current code facts from historical plans and from production claims that still need live verification.

## 1. Executive summary

ourTailTales turns a pet owner's scattered photo album into a chronological, chapter-based physical keepsake. The intended experience is much closer to "a beautifully edited book company with technology underneath" than "an AI app with a pet theme."

The core job to be done is:

> Remove the emotional and practical work between "I have years of pet photos" and "I have a finished book I can hold."

The software processes an album, finds chronology and natural chapter boundaries, selects representative photos, drafts restrained chapter introductions, previews the complete book, creates Lulu-ready PDFs, collects payment, and submits the paid order for printing and fulfillment.

The physical book is the product. AI, photo processing, PDF generation, payments, and fulfillment are supporting infrastructure.

Current reality:

- The canonical codebase is a Next.js application at `/Users/myphu/Documents/GitHub/ourTailTales`.
- The repository contains a substantial photo-to-book, checkout, Stripe, Lulu, authentication, free-preview, analytics, and experimental Video Memories implementation.
- The landing-page path currently creates a free five-chapter preview and then gates viewing/saving behind authentication. It does not currently carry that user into the existing editor/checkout path.
- Video Memories are represented in the UI copy and have extensive backend scaffolding, but the active editor explicitly passes `enableVideoMemories={false}`. Do not describe the feature as live.
- Local quality is healthy as of this handoff: lint passed, 17 Vitest files / 58 tests passed, and the production build passed on 2026-09-19.
- Local success does not prove launch readiness. The most recent production audit found material configuration, database, access-control, checkout-connection, DNS, and operations gaps. Those findings are dated and must be rechecked before being reported as current.

## 2. Source-of-truth hierarchy

Use this order when sources disagree:

1. Current code and migrations in `/Users/myphu/Documents/GitHub/ourTailTales`.
2. Current repository documentation, especially `docs/BRAND_GUIDELINES.md` and `docs/free-book-launch.md`.
3. This handoff, which explains how the pieces relate.
4. Dated PDFs and market reports in `/Users/myphu/Downloads/ourTailTales`.
5. Prior audit notes, which are historical evidence rather than proof of current external state.

Important examples of superseded plans:

- The original MVP brief described two base chapters at $49.99 and $10 per extra chapter. Current code uses five base chapters at $49.99 and $4.99 per extra chapter.
- Market reports modeled a $69.99 entry price and a $10 Video Memory add-on. Current code uses a different book ladder and $9.99 per Video Memory pack.
- The original brief said no accounts. The current free-book flow uses Supabase Auth to save and privately reopen a generated preview.
- The original brand PDF specified DM Serif Display. Current repository guidance and code use Merienda for display, Cormorant Garamond for cover titles, and Inter for UI/body copy.

Never copy a number, API payload, or launch claim out of an older PDF without checking the current code and the live vendor documentation.

## 3. Paths and repositories

### Canonical application repository

`/Users/myphu/Documents/GitHub/ourTailTales`

- Branch: `main`
- Remote tracking: `origin/main`
- Head observed for this handoff: `fd284d63ea5b14c85679c31e5f06b765b21603d4` (`CODEXupdate`, 2026-09-17)
- The working tree was not clean when this handoff was assembled. Preserve the user's uncommitted edits in:
  - `src/components/create/QuickUploadStage.tsx`
  - `src/components/editor/albumTiles.ts`
  - `src/lib/drafts/local.ts`
- Those edits add a compact upload-library control, deletion, usable-media counts, accessible filenames, and video-only local persistence. Do not overwrite or revert them.

Before changing code, read `AGENTS.md`. This repository uses Next.js 16.3.5 and explicitly instructs agents to read the relevant installed documentation under `node_modules/next/dist/docs/` before assuming older Next.js behavior.

### Research and product-artifact folder

`/Users/myphu/Downloads/ourTailTales`

Important files:

- `ourTailTales_MVP_Cursor_Build_Spec.pdf`: original product and technical brief, verified 2026-09-11.
- `ourTailTales_Canva_Brand_Guidelines.pdf`: original visual direction.
- `ourTailTales_Lulu_Print_API_Cursor_Handoff.pdf`: Lulu setup and API handoff, 2026-09-12.
- `output/pdf/pet_memoir_market_analysis_2026-09-13.pdf`: quantitative market snapshot.
- `output/pdf/pet_memoir_competitor_deep_dive_2026-09-15.pdf`: competitor, channel, and positioning audit.
- `pet_memoir_market_data_2026-09-13.xlsx`: supporting market workbook.
- `output/pet_memorabilia_social_posts_50_2026-09-15.csv`: social-content research.

These are valuable context, not automatically current truth.

## 4. Vision, customer problem, and product philosophy

### Vision

Make it easy to turn the visual record of a pet's whole life into a durable, coherent story that can sit on a bookshelf or memorial shelf and be revisited privately or with family.

### Customer problem

Pet owners often have hundreds or thousands of photos but no coherent artifact. Building a book manually requires sorting years of images, choosing representative moments, reconstructing dates, designing pages, writing context, and navigating printing. For grieving owners, that work can also be emotionally difficult.

### Core solution

- Process the album locally where possible.
- Use metadata and deterministic logic to reconstruct chronology.
- Propose chapters and representative photos.
- Use AI only to name and summarize evidence-backed chapters.
- Let the owner review and correct the result.
- Produce a display-worthy physical book.

### Emotional and ethical standard

- Never invent specific memories, emotions, relationships, routines, medical events, favorite places, or facts.
- Label or gently qualify inferred dates and locations.
- Treat the owner's real photos and supplied memories as the emotional center.
- Avoid manipulative urgency around pet loss.
- Do not solicit grieving users in support communities that discourage promotion.
- A memorial edition should feel gentle, but the overall brand should celebrate a whole life rather than visually centering death.

### Product principles

1. The finished physical book matters more than the software.
2. A user should review a nearly finished book, not design a scrapbook from scratch.
3. Chronology and selection should be deterministic and explainable; AI should not control raw ordering.
4. Privacy should be a product feature: originals stay local until an order or an explicitly selected video workflow requires an upload.
5. Full proof before purchase is important because memorial buyers need trust and control.
6. The product must earn its premium by saving time and producing a better narrative, not by advertising AI.

## 5. Audience and positioning

### Primary audience hypotheses

- Owners celebrating a living pet's life.
- Owners of senior pets who want to organize memories before a loss.
- Owners making a remembrance book after a loss.
- Gift buyers who know the recipient and timing well.
- Partners with privileged memories or trust: pet photographers, daycares, groomers, veterinary teams, rescue groups, and pet portrait artists.

Do not mix celebration and grief audiences in one acquisition experiment. Their timing, language, emotional needs, and objections differ.

### Primary positioning

Recommended plain-language promise:

> Your pet's life story, made from your photos and memories.

Current brand line:

> Their life, in chapters.

Current code-level hero copy:

- Title: `Hold their Life Story`
- Subtitle: `Upload their photos and videos. We organize their memories into a personalized storybook you can hold forever.`
- CTA: `Create their story`

### Stronger buyer/search language

Use these phrases in acquisition and SEO tests:

- personalized pet memory book
- pet photo book
- pet memorial book
- dog storybook
- pet loss gift
- keepsake
- pet life story book

"Pet memoir" is useful as an internal category description, but dated search research found it weak as the primary consumer keyword.

### Differentiation hypothesis

The defensible combination is not any one feature. Competitors already offer AI drafting, QR video, photo books, guided stories, or human-written biographies. The combined hypothesis is:

- whole-album ingestion;
- date-aware life chronology;
- fast chapter and photo selection;
- real photos rather than generic illustrations;
- owner review and corrections;
- a finished physical proof;
- optional durable video access later.

That is a product hypothesis, not a proven moat.

## 6. Brand system

### Brand personality

- Literary: a life story, not a photo dump.
- Gentle: supportive without grief clichés.
- Personal: real photos and real memories stay central.
- Modern: clear software and pricing, no scrapbook clutter.
- Hopeful: celebrates a whole life.
- Trustworthy: calm UI, transparent process, proof before purchase.

### Naming and capitalization

- Always write `ourTailTales`.
- Domain: `ourtailtales.com`.
- Do not display `Our Tail Tales`, `Tail Tales`, or `OurTailTales` as the brand name.

### Official colors

| Role | Name | Hex | Use |
| --- | --- | --- | --- |
| Primary | Chapter Periwinkle | `#5B68C8` | CTA, links, progress, key moments |
| Hover | Periwinkle Deep | `#4A56B0` in docs; current dark UI token is lighter | Button interaction |
| Secondary | Memory Blue | `#C9D8FA` | Dropzones, cards, soft fields |
| Secondary | Keepsake Lavender | `#E2D7F5` | Chapter accents and creation field |
| Secondary | Quiet Sage | `#C9DED7` | Success/supportive accents |
| Accent | Warm Petal | `#EDB8AA` | Small warm accent only |
| Text | Ink | `#252A3A` | Light-surface headings and body |
| Background | Cloud | `#F7F8FC` | Light page background |
| Surface | White | `#FFFFFF` | Cards and book pages |

The repository has evolved into a dark "night" hero/chrome with pastel text, followed by light Cloud/paper sections. Inspect `src/app/globals.css` before changing tokens: semantic names such as `ink` are remapped in the dark chrome, while `page-ink` preserves the canonical dark text on book and light UI surfaces.

### Typography

Current implementation:

- Merienda: display headings and brand wordmark.
- Cormorant Garamond: literary book-cover titles.
- Inter: navigation, forms, prices, buttons, metadata, and body copy.

The older brand PDF's DM Serif Display recommendation is superseded by the repository guideline and `src/app/layout.tsx`.

### Photography and layout

- Prefer candid, documentary pet photos: naps, walks, car rides, family moments, outdoor trips, imperfect phone photos.
- Real life is more important than polished stock imagery.
- Use 16-24 px radii for web cards and restrained shadows/borders.
- Keep printed pages clean, rectangular, and editorial.
- Use white pages, generous margins, and quiet photo layouts.
- If a decoration competes with the customer's pet photo, remove it.

Avoid:

- beige/tan-dominant branding;
- funeral-like black styling;
- angel wings, halos, and rainbow-bridge clichés;
- excessive paw prints;
- scrapbook textures;
- sad stock photography;
- cartoon clip art;
- AI as the visual or emotional centerpiece;
- heavy gradients or glassmorphism.

### Logo and assets

- Master mark: `public/branding/logo.png` (2000 x 2000).
- Web mark: `public/branding/logo-512.png`.
- Use through `src/components/BrandMark.tsx`.
- App icons come from the same mark.
- Marketing assets live in `public/marketing/`.
- Preserve generous clear space; do not stretch, crop, recolor arbitrarily, or repeat the logo as decoration.

### Voice

Warm, direct, specific, and concise. Write like someone helping organize meaningful memories, not a grief counselor or an AI vendor.

Preferred language:

- their story
- their life
- the moments you shared
- keep their story close

Avoid technical AI language in customer copy.

## 7. Current product rules from code

The source of truth is `src/lib/pricing.ts`.

| Rule | Current value |
| --- | --- |
| Physical product | 8.5 x 8.5 in square hardcover casewrap |
| Cover | Matte by current product copy; still requires physical-sample confirmation |
| Interior | Premium full color, 80# coated white |
| Base chapters | 5 |
| Story pages per chapter | 10 |
| Fixed pages | 4: title, dedication, closing, imprint |
| Base printed interior | 54 pages = 50 story + 4 fixed |
| Base price | $49.99 before shipping/tax |
| Extra chapter | $4.99 per additional 10-page chapter |
| Maximum chapters | 50, pending physical-sample and operational validation |
| Photo target | 5-30 photos per chapter |
| Minimum creation gate | 25 usable photos/videos |
| Shipping geography | Code and checkout types are US-only |
| Quantity | One copy in current fulfillment path |
| Paperback | Coming soon; not implemented |

Pricing is based on chapter count, not total album size.

The currently verified historical Lulu manufacturing quote was $20.43 for a 44-page book on 2026-09-12, before shipping, fulfillment, tax, or fees. That quote does not describe the current 54-page base product. Requote the current product before making margin claims.

### Video Memory rules in code

- $9.99 per pack of 10 unique placed videos.
- Pack math counts unique videos with active placements, not uploads or repeated QR placements.
- Maximum clip duration: 60 seconds.
- Default maximum original upload: 500 MB.
- Processed target: 30 MB; hard processed cap: 40 MB.
- Target height: 1080p; maximum edge 1920 px; maximum 30 FPS.
- QR minimum physical size: 1.25 in; default 1.75 in.
- Permanent archival is designed around encryption and Turbo/Arweave after paid consent.

This is implementation scaffolding, not a live product guarantee. The active editor disables Video Memories, required production configuration is absent locally, and end-to-end playback/printed-QR durability has not been verified.

## 8. Customer journeys

### Current landing/free-book journey

1. Landing hero and product listing.
2. Upload photos and videos in the embedded creation section.
3. Browser processes images, creates thumbnails, reads EXIF, scores quality, and groups duplicates.
4. User reaches the minimum usable-media threshold.
5. The app generates a five-chapter story and complete screen-resolution preview.
6. Local draft and preview are stored in IndexedDB.
7. The result screen offers `View my free book` and `View PDF`.
8. Those actions require authentication.
9. The app uploads the private preview PDF and optional cover thumbnail to Supabase `book-previews`, upserts a `book_projects` row, and opens `/book/[id]`.

Current gap: this result journey does not expose the existing full editor and order/checkout action. Connecting free preview completion to editing and checkout is the highest product-flow blocker.

### Existing editor/order journey in code

1. User edits chapter text, photo order, cover, and layout-controlled content.
2. User can request a five-page watermarked sample after email capture.
3. On order, the browser renders the print interior and cover PDFs.
4. `/api/orders` creates a server-priced `pending_payment` order.
5. `/api/lulu/cover-dimensions` obtains exact cover dimensions.
6. `/api/order-assets` issues private signed Supabase upload URLs.
7. Browser uploads only the two final print PDFs.
8. `/checkout?order=<uuid>` collects US shipping address, phone, email, and shipping method.
9. Lulu shipping options and costs are calculated server-side.
10. `/api/stripe/payment-intent` recalculates book/video/shipping totals server-side.
11. Stripe collects payment.
12. A verified Stripe webhook marks the order paid and submits exactly one Lulu job, or queues video archival first.
13. Lulu webhook and daily reconciliation update print status.
14. `/order/[id]` displays progress and tracking.

The architecture exists, but do not call it customer-ready until the landing flow reaches it and a real end-to-end test proves the external integrations.

## 9. Photo and story pipeline

### On-device media processing

Key modules:

- `src/lib/photo/process.ts`
- `src/lib/photo/worker.ts`
- `src/lib/photo/exif.ts`
- `src/lib/photo/quality.ts`
- `src/lib/photo/dedupe.ts`
- `src/lib/photo/cluster.ts`
- `src/lib/photo/assetStore.ts`

Design invariants:

- Do not decode the entire album at once.
- Process in bounded batches/worker flow.
- Do not keep hundreds of decoded bitmaps or base64 images in React state.
- Keep binary originals and thumbnail blobs in the module-level asset store; keep lightweight metadata/object URLs in Zustand.
- Prefer EXIF date; fall back to `lastModified` and preserve the date source.
- Mark weak or duplicate photos instead of silently deleting them.
- Customer-facing usable counts must match the placement definition: non-duplicate, print-usable photos plus videos where the current gate treats videos as eligible.

### Deterministic chapters

- Sort usable photos chronologically.
- Use time gaps and GPS distance as boundary signals.
- Fall back to time only when GPS is sparse.
- Fall back to weaker file ordering when dates are missing and communicate uncertainty.
- Enforce minimum photos per chapter.
- Select representative photos across temporal bins to avoid one event dominating a long chapter.
- Penalize duplicates and near-identical clusters.
- Preserve unselected chapter candidates for swaps.

### AI story generation

Key modules:

- `src/lib/ai/provider.ts`
- `src/lib/ai/gemini.ts`
- `src/lib/ai/prompt.ts`
- `src/app/api/story/route.ts`
- `src/lib/story/client.ts`

Current default provider/model behavior is Gemini with a configurable server-side model. `GEMINI_API_KEY` is server-only.

The AI should receive structured chapter context and a small number of representative thumbnails, not the whole album. It returns a chapter title, date label, and short blurb. The prompt must forbid unsupported memory fabrication.

Reverse geocoding should use reduced-precision representative centroids only. It is optional; the book must work with dates alone.

## 10. Book composition and print output

Key modules:

- `src/lib/book/layouts.ts`
- `src/lib/book/pagination.ts`
- `src/lib/book/preview-model.ts`
- `src/lib/book/sample-pdf.ts`
- `src/lib/book/interior-pdf.ts`
- `src/lib/book/cover-pdf.ts`
- `src/components/book-viewer/`

Supported layout vocabulary includes:

- full bleed;
- one large plus two small;
- two-photo vertical split;
- two-photo horizontal split;
- three-image editorial;
- four-image grid;
- chapter opener.

The editor should feel like correcting a finished book, not operating Canva. Keep controls constrained to useful corrections such as chapter text, photo swaps/reordering, cover selection, and bounded layout decisions.

### Lulu print specification

Verified package ID:

`0850X0850.FC.PRE.CW.080CW444.MXX`

Configuration:

- Square 8.5 x 8.5 in hardcover casewrap.
- Premium color.
- 80# coated white.
- Matte finish for the initial sample.
- Full-bleed interior PDF pages are 8.75 x 8.75 in.
- Lulu requires a multipage interior PDF and one single-page cover-spread PDF.
- Cover width/spine must be requested from Lulu for the exact page count. Never hardcode the historical 44-page value.
- Historical 44-page reference: cover 19 x 10.25 in, 0.25 in spine.

Before public orders, obtain a physical sample of the exact current base configuration and inspect crop, dark-photo reproduction, small text, hinge placement, spine behavior, binding, and matte/gloss choice.

## 11. Technical stack

| Layer | Current technology |
| --- | --- |
| Framework | Next.js 16.3.5 App Router |
| UI | React 19.2.8, TypeScript 5, Tailwind CSS 4 |
| State | Zustand 5 |
| Validation | Zod 4 |
| Photo metadata | exifr |
| Images | Browser APIs, canvas/worker pipeline, object URLs |
| PDFs | pdf-lib |
| Database/storage/auth | Supabase Postgres, private Storage, Supabase Auth/SSR |
| Payments | Stripe PaymentIntents + webhook |
| AI | Google Gemini through a server-side provider abstraction |
| Print/fulfillment | Lulu Print API |
| Video archival | Turbo SDK / Arweave scaffolding |
| Analytics | PostHog, Vercel Analytics, Vercel Speed Insights |
| Deployment | Vercel |
| Testing | Vitest |
| Icons/motion | lucide-react, Motion |

There is no separate backend service. Next.js route handlers are the backend. Heavy album work stays in the browser; Supabase stores business records, private previews, temporary print assets, and video/order data where enabled.

## 12. Repository map

| Area | Location | Responsibility |
| --- | --- | --- |
| App entry | `src/app/page.tsx` | Landing page |
| Landing composition | `src/components/LandingPage.tsx` | Hero -> product -> funnel -> FAQ |
| Creation state machine | `src/components/Funnel.tsx` | Upload, generation, preview, auth, editor, checkout |
| Upload | `src/components/create/QuickUploadStage.tsx` | Album collection and processing UI |
| Free result | `src/components/create/BookReadyStage.tsx` | Auth-gated free preview actions |
| Editor | `src/components/editor/BookEditor.tsx` | Guided editing flow |
| Book viewer | `src/components/book-viewer/` | Interactive browser preview |
| Store | `src/store/useOurTailTalesStore.ts` | Funnel, media, chapters, pages, drafts |
| Local drafts | `src/lib/drafts/local.ts` | IndexedDB restoration/persistence |
| Cloud books | `src/lib/books/` | Snapshot and authenticated preview save |
| Pricing | `src/lib/pricing.ts` | Authoritative book pricing/page math |
| Photo pipeline | `src/lib/photo/` | Metadata, thumbnails, quality, dedupe, chapters |
| AI | `src/lib/ai/`, `src/app/api/story/` | Evidence-bound chapter writing |
| PDF generation | `src/lib/book/` | Preview/sample/interior/cover PDFs |
| Orders | `src/lib/order/`, `src/app/api/orders/` | Create/freeze/read/submit orders |
| Checkout | `src/components/CheckoutForm.tsx`, `src/app/checkout/` | Quote and payment UI |
| Lulu | `src/lib/lulu/client.ts`, `src/app/api/lulu/` | Dimensions, quotes, jobs, status |
| Stripe | `src/lib/stripe.ts`, `src/app/api/stripe/` | PaymentIntent and webhook |
| Supabase | `src/lib/supabase/`, `supabase/migrations/` | DB, storage, auth |
| Video Memories | `src/lib/video-memory/`, `src/lib/archival/`, video API routes | Upload, processing, placement, archival, QR |
| Analytics | `src/lib/analytics.ts`, PostHog helpers | Funnel and error events |
| Brand | `docs/BRAND_GUIDELINES.md`, `src/lib/brand.ts`, `src/app/globals.css` | Brand rules and tokens |
| Deployment | `vercel.ts` | Four daily cron routes |

## 13. Data, storage, auth, and privacy

### Supabase tables

Base order schema:

- `leads`
- `orders`
- `order_shipping`

Video/draft schema:

- `book_drafts`
- `video_assets`
- `video_memory_placements`
- `order_video_memories`
- additional fulfillment/video fields on `orders`

Authenticated free-book schema:

- `book_projects`

### Storage buckets

- `ourtailtales-orders`: private temporary print PDFs and video-related assets.
- `book-previews`: private authenticated preview PDFs and cover thumbnails.

### Auth models coexist

- Order APIs primarily use server/service-role access and UUID order IDs.
- Video draft operations use a draft UUID plus bearer secret.
- Saved free books use Supabase Auth and RLS ownership.

Do not collapse these models casually. They protect different workflows.

### Privacy claims and reality

- Original photos are processed locally during ordinary book creation.
- Final print PDFs are uploaded when an order is prepared.
- Small representative thumbnails may be sent for AI story generation.
- Video originals are uploaded only when the optional Video Memory workflow is used.
- Analytics must never include filenames, image content, or coordinates.
- Print files have a cleanup workflow, but retention language and actual cleanup behavior must remain aligned.

The current Privacy Policy and Terms are implementation drafts, not legal advice. Tax, refunds, cancellation, retention, and regional compliance still need business/legal review.

## 14. External integrations

### Supabase

Used for Postgres, private object storage, signed URLs, and Auth/RLS for saved free previews.

Never expose `SUPABASE_SERVICE_ROLE_KEY` to the browser. The free-preview feature additionally requires `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.

Migration warning: `docs/free-book-launch.md` says the linked project's migration history was previously inconsistent around `0003_video_memories.sql`. Do not run an unrestricted `supabase db push` until migration history is reconciled. Apply or repair migrations deliberately.

### Gemini

The server-side story route uses Gemini by default. Keep provider and model configurable. Do not put the API key in a `NEXT_PUBLIC_` variable.

### Stripe

- Server recalculates book price and shipping.
- Browser-supplied prices are not trusted.
- Only a verified Stripe webhook may mark an order paid and initiate fulfillment.
- Submission must be idempotent under webhook retries.
- Current local Stripe variables are empty; local build success does not prove payment readiness.
- Stripe Tax or professional tax guidance is required before a real public launch; do not hardcode a guessed tax rule.

### Lulu

- Sandbox base: `https://api.sandbox.lulu.com`.
- Production base: `https://api.lulu.com`.
- OAuth client-credentials token flow.
- API calls and credentials stay server-side.
- Cost calculation uses `shipping_option`; print-job creation uses `shipping_level`.
- Print-job line items use `pod_package_id`, `interior.source_url`, and `cover.source_url` directly under the line item in the verified API shape.
- Subscribe to `PRINT_JOB_STATUS_CHANGED`.
- Verify `Lulu-HMAC-SHA256` over the raw request body.
- Rejected or ambiguous jobs go to `needs_review`; do not silently create another paid print job.
- Production requires merchant billing and Auto Pay.

The portal and credentials existed in prior work, but an end-to-end sandbox print job and a physical sample were not verified. Never equate portal access with fulfillment readiness.

### Vercel

Known project: `startup-work-from-wrys/our-tail-tales`.

`vercel.ts` schedules four Hobby-compatible daily jobs:

- 04:00 UTC: cleanup assets.
- 05:00 UTC: process videos.
- 06:00 UTC: fulfill/archive video orders.
- 07:00 UTC: reconcile Lulu status.

An earlier `*/30 * * * *` Lulu reconciliation schedule prevented Vercel Hobby deployments. Commit `2eae143` changed the schedules and was verified Ready at that time. For any new deployment, verify GitHub `main` SHA -> Vercel deployment SHA -> Ready -> production route. A successful push alone is not proof.

### Analytics

The code emits funnel events through PostHog and also includes Vercel Analytics/Speed Insights. Event data should be structural only: counts, stage, chapter count, price, and status. Do not send photo content, filenames, or raw coordinates.

`.env.example` currently omits the PostHog variables used in code. Update documentation carefully if analytics configuration is part of the task.

## 15. Environment variables

Use `.env.example` as the starting point, but also search current code for newly used names.

Core groups:

- Site: `NEXT_PUBLIC_SITE_URL`.
- Supabase: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET`.
- AI: `GEMINI_API_KEY`, `AI_PROVIDER`, `AI_MODEL`.
- Geocoding: `GEOCODE_URL`, `GEOCODE_API_KEY`.
- Stripe: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.
- Lulu: `LULU_ENV`, `LULU_CLIENT_KEY`, `LULU_CLIENT_SECRET`, `LULU_POD_PACKAGE_ID`, `LULU_CONTACT_EMAIL`, optional/fallback `LULU_WEBHOOK_SECRET`.
- Cron: `CRON_SECRET`.
- Video: `VIDEO_MEMORY_MAX_SOURCE_BYTES`, `VIDEO_MEMORY_OPERATIONAL_MAX_ASSETS_PER_DRAFT`, `VIDEO_MEMORY_WRAP_KEY`, `TURBO_PAYMENT_KEY`, `ARWEAVE_JWK`, `ARWEAVE_PLAYER_TX`.
- Analytics used in code: `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN`, `NEXT_PUBLIC_POSTHOG_HOST`.

Local state observed without reading secret values on 2026-09-19:

- Supabase URL, service role, Gemini, Lulu credentials, cron, and PostHog variables were present.
- `LULU_ENV=sandbox`.
- Stripe variables were empty.
- Supabase public/publishable auth key was missing.
- Video wrapping and Turbo/Arweave variables were missing.
- `NEXT_PUBLIC_SITE_URL` was missing.

Do not put real secret values in commits, logs, screenshots, chat messages, or handoff documents.

## 16. Market and competitor context

All numbers below are dated snapshots from 2026-09-13 through 2026-09-15. Recheck before using them publicly.

### What the evidence supports

- A close Etsy custom real-life pet storybook had 61 item-specific purchase reviews at a displayed starting price above $113. This is the strongest public behavioral proof in the research set.
- Adjacent Etsy products had modeled lifetime sales or review signals, but many were blank journals, albums, or preset children's stories rather than completed biographies.
- Exact Etsy book terms were each below eRank's 20-search monthly reporting floor in the snapshot.
- Broader `pet memorial gift` demand was much larger but also extremely competitive and not book-specific.
- Reddit contained first-person examples of owners ordering photo books and of the manual process being time-consuming and emotionally difficult.

This supports a real niche. It does not establish total addressable market, monthly category revenue, paid conversion for this exact offer, or profitable acquisition.

### Direct and specialist competitors

| Competitor | Dated public offer | Overlap / lesson |
| --- | --- | --- |
| Petmoir | $99; guided AI memoir; QR video; pre-launch terms | Closest feature overlap, but paid traction was not verified |
| Your Pet's Story | $43 / $83; guided book; video/audio QR | QR is not unique; app displayed 0+ downloads in snapshot |
| My Companion Chronicles | $29 digital / $129 print | Prompts and low-friction digital step |
| Everypaw | $4.99/mo / $79/yr | Ongoing AI journal + annual print |
| Life Story Lane | $449 / $999 | Human interview and premium trust |
| Puffin Story Co | Quote-based | Founder story and vet-referral approach |
| PawMemo | From $35 | AI biography/memorial hardcover |

### Scaled adjacent competitors

- Mixbook: AI Story Mode, pet themes, mature photo-book creation and acquisition.
- Print Chapters: pet product page, auto-layout, SEO, creator program, active Meta creative testing.
- My Social Book: dated social import, affiliate program, feed-to-book automation.
- Chatbooks: strong automated photo-book history and creator-led growth.
- Crown & Paw: large pet audience and pet-book cross-sell potential.
- Shutterfly and MILK Books: trusted general photo-book alternatives.

Their advantage is not necessarily a better pet narrative. It is mature ingestion, printing, reviews, discounts, and acquisition channels.

### Buyer insights

- Buyers want a hardcover, dates/captions, credible print quality, and control over the final result.
- Manual book creation can take many hours.
- Sorting images after a loss can be difficult; timing matters.
- A surprise memorial gift can be emotionally risky.
- Care teams and family may have meaningful photos or stories the owner does not possess.
- Owners commonly keep books on bookshelves, memorial shelves, curio cabinets, bedroom shelves, mantels, or near framed photos, collars, paw prints, and urns.
- The book is usually a readable keepsake kept within reach, not permanently displayed open.

Design the cover and spine for display, and the interior for private rereading.

## 17. Go-to-market and validation standard

### Recommended acquisition tests

- Pet-photo and pet-memory SEO pages tied to a concrete workflow.
- Short page-turn or before/after album-to-book videos.
- Pet photographer, daycare, groomer, rescue, and veterinary partnerships.
- Founder-led trust content and product demonstrations.
- Distinct campaigns for living pets, senior pets, memorial search, and partner referrals.
- A/B tests of "their whole life, from your album" versus a later Video Memory-led message.

### Metrics that count

Track by channel:

- qualified sessions;
- album starts;
- usable albums processed;
- previews generated;
- preview edits;
- checkout starts;
- paid orders;
- delivered books;
- refunds/reprints;
- net realized price;
- Lulu printing and shipping cost;
- Stripe fees;
- AI/video/hosting cost;
- customer acquisition cost;
- contribution margin;
- Video Memory attach rate, if/when live.

Views, followers, likes, email signups, active ads, and free previews are diagnostic proxies. They do not validate the business.

### Validation bar

Before claiming product-market validation:

1. Produce and inspect one physical sample of the exact live product.
2. Obtain at least five full-price orders from strangers/non-friends.
3. Deliver the books.
4. Track actual labor, printing, shipping, fees, AI/video costs, support, reprints, refunds, and acquisition source.
5. Interview buyers after delivery.

## 18. Current quality and implementation status

### Fresh local verification on 2026-09-19

- `npm run lint`: passed.
- `npm test`: passed, 17 files and 58 tests.
- `npm run build`: passed under Next.js 16.3.5.
- The build emitted non-fatal `Couldn't load fs` / `Couldn't load zlib` lines during static generation; it still completed successfully.
- Route build included 31 static/dynamic entries plus proxy middleware.

### Known functional strengths

- Memory-bounded client photo processing architecture.
- EXIF/fallback date provenance.
- Duplicate and quality handling.
- Deterministic chapter proposal.
- Structured, evidence-bound AI prompts.
- Browser preview and PDF generation.
- Server-side price recalculation.
- Private signed asset uploads.
- Lulu dimensions/quote/job client.
- Stripe webhook-driven fulfillment.
- Lulu webhook and reconciliation paths.
- Authenticated, RLS-protected free-preview storage in code/migration.
- Daily operational cron routes.
- Test coverage around pricing, pagination, snapshots, Video Memory math, QR, archival gating, and state.

### Important current inconsistencies

- Landing/product copy advertises optional Video Memories, but the active editor disables them.
- The free-book result has no edit/order continuation even though editor and checkout code exist.
- The current 54-page base product differs from the 44-page Lulu quote and older pricing research.
- `README.md` is still a generic starter-style file and understates the actual environment and architecture.
- The original MVP "no accounts" rule conflicts with the current authenticated free-book save.
- Product copy says photos and videos count toward the hardcover creation threshold, while photos currently build the story pages and videos are not enabled in the editor.
- Terms mention international-order behavior, but checkout types and quote flow are US-only.

Do not hide these mismatches. Resolve them deliberately or adjust customer-facing claims.

## 19. Launch blockers and risks

The last production-readiness audit was performed on 2026-09-17. Treat external findings as a dated checklist to reverify.

### P0: must be resolved before accepting real orders

1. Connect the free-book result to the editor and checkout, or intentionally redesign the conversion path.
2. Reconcile and apply the correct Supabase migrations and buckets. Do not blindly push the migration directory.
3. Configure and verify Supabase Auth, redirect URLs, RLS, and production SMTP.
4. Secure order access. `/order/[id]` and checkout currently rely on possession of a UUID; the route exposes order/customer details to anyone with the ID. Add authenticated ownership or a separate high-entropy access token and protect mutation endpoints consistently.
5. Add abuse controls/rate limits to anonymous AI, lead, order, geocode, draft, and upload-authorizing endpoints.
6. Configure Stripe and verify webhook signatures, amount/currency consistency, idempotency, and duplicate-delivery behavior.
7. Complete a Lulu sandbox order end to end and then a paid physical sample with production Auto Pay.
8. Reconcile current pricing and margins against the 54-page base, shipping, tax, payment fees, AI cost, reprints, and support.
9. Decide and implement sales tax handling.
10. Verify DNS, `NEXT_PUBLIC_SITE_URL`, production secrets, and expected deployment SHA.
11. Add operational email/notification flows for receipt, fulfillment status, rejection, refund, cancellation, and internal failure alerts.
12. Define refund, cancellation, damaged-book, reprint, privacy-retention, and support procedures.

### P1: important reliability and product fixes

- IndexedDB restore has no timeout or `onblocked` handling. A blocked/slow database can leave the initial spinner running indefinitely. Add bounded timeout, error state, retry, and start-fresh controls.
- Confirm large-album behavior on real mobile devices and memory-constrained browsers.
- Add browser-level end-to-end tests. Unit tests and a production build are not an order-flow test.
- Verify PDF dimensions, font embedding, crop/safe areas, color/dark-photo behavior, and Lulu validation for every supported page count.
- Add explicit low-resolution review rather than only console warnings.
- Ensure cleanup never deletes assets for unresolved, rejected, or needs-review orders.
- Verify emails and operator alerts rather than promising them in UI before implementation.

### Video Memories: keep disabled until all are true

- Live migrations are applied.
- Source bucket limits and CORS are correct.
- `VIDEO_MEMORY_WRAP_KEY`, Turbo/Arweave credentials, and player transaction are configured.
- Processing throughput and retry behavior meet customer turnaround needs.
- Purchase consent, encryption, archival verification, and QR stamping pass end to end.
- A printed QR works from a real book on common phones.
- The public retention/durability promise is legally and operationally supportable.
- Storage economics and failure support are understood.

## 20. Security invariants

Preserve these unless a deliberate design review changes them:

- Secrets are server-only and never use a `NEXT_PUBLIC_` prefix.
- Browser prices, page totals, and shipping amounts are untrusted.
- Payment success is established only by a verified Stripe webhook.
- Lulu calls happen server-side.
- Lulu webhook signatures are verified against raw request bytes.
- Duplicate webhooks cannot create duplicate print jobs.
- Ambiguous Lulu creation is reconciled by external order ID before any retry.
- Rejected orders go to manual review; never auto-charge or silently resubmit.
- Storage buckets are private.
- Signed URLs are scoped and short-lived.
- Authenticated saved books are owner-only under RLS.
- Analytics exclude photo content, filenames, and precise coordinates.
- Original album files should not be uploaded merely to create a draft.
- Never log or expose vendor secrets.

## 21. Agent working rules

### Before making changes

1. Read `AGENTS.md`.
2. Read the relevant Next.js 16 documentation in the installed package.
3. Run `git status --short --branch` and inspect existing diffs.
4. Do not revert the user's current upload-library/local-draft edits.
5. Read the source file that defines the behavior; do not infer current rules from the older PDFs.
6. If a task touches Supabase, inspect migration history and live state separately.
7. If a task touches production configuration, distinguish variable-name presence, secret-value correctness, environment scope, deployment adoption, and end-to-end behavior.

### During implementation

- Keep changes narrowly scoped.
- Preserve brand tokens and adjacent visual continuity.
- Reuse store actions that release object URLs; do not mutate media arrays directly.
- Keep customer-visible counts aligned with usable media rather than raw tiles.
- Keep original images out of React state.
- Keep AI language evidence-bound.
- Add tests for pricing, state, idempotency, or transformations when behavior changes.
- Do not enable a customer-facing feature merely because backend code exists.

### Minimum verification

```bash
npm run lint
npm test
npm run build
git diff --check
```

For UI changes, also inspect a real browser at mobile and desktop widths. Refresh DOM/accessibility state after navigation. For deployment work, verify the exact Git SHA in Vercel and load the production route. For database/vendor work, run a real scoped integration test without exposing credentials.

## 22. Recommended next work sequence

Unless the user reprioritizes, the most coherent order is:

1. Preserve and finish the current upload-library work; fix the IndexedDB restore hang.
2. Decide the intended post-preview journey and connect the free book to editing/order.
3. Reconcile Supabase migrations and deploy the authenticated preview schema safely.
4. Secure order reads and mutations with ownership/access tokens.
5. Configure Stripe in test mode and prove duplicate-webhook idempotency.
6. Prove Lulu sandbox authentication, dimensions, quote, PDF validation, print-job submission, webhook, and reconciliation.
7. Requote the current 54-page base and reconcile pricing/margins.
8. Add order/customer/operator emails and refund/reprint operations.
9. Verify DNS and production deployment configuration.
10. Run one complete test purchase and inspect a physical sample.
11. Only then run the five full-price stranger-order validation test.
12. Treat Video Memories as a later gated launch unless product strategy explicitly prioritizes them and all prerequisites are funded.

## 23. Open product decisions

The next agent should surface these rather than silently choosing:

- Is the free five-chapter preview the permanent acquisition model, or should users configure chapter count before generation?
- Should account creation remain required to view the free result, or should it gate saving/order only?
- Is the current $49.99 / five-chapter base economically viable at 54 printed pages?
- Is 50 chapters a real sellable maximum or only a code cap?
- Should videos count toward the 25-media creation threshold while Video Memories are disabled?
- Should marketing remove Video Memory claims until the feature is operational?
- Is the launch strictly US-only, and should the Terms say so?
- Which owner-supplied anecdotes/questions are necessary to make chapter text feel personal rather than metadata-derived?
- What exact retention promise can be made for preview PDFs, print PDFs, and permanent videos?
- What refund, reprint, cancellation, and support policy will be offered?
- Is the first validation channel direct web checkout, Etsy/manual concierge, or partner referrals?

## 24. Definition of launch-ready

Do not mark the product launch-ready until all of the following are proven, not merely coded:

- A new visitor can upload a realistic album on mobile without a stuck state.
- The generated chronology and chapter selection are credible.
- The owner can correct the story and approve every page.
- The app produces correct interior and cover PDFs for the live SKU/page count.
- The live Supabase schema, buckets, auth, and RLS match the code.
- Checkout securely calculates current Lulu shipping and the authoritative total.
- Stripe test payment succeeds and duplicate webhook delivery creates exactly one Lulu job.
- Lulu accepts and processes the print files.
- Lulu webhook or reconciliation updates the customer order.
- Unauthorized users cannot read or mutate another customer's book/order.
- Customer and operator notifications work.
- Tax, refund, cancellation, privacy, and support policies are operational.
- The expected commit is deployed, DNS resolves, and the production route is tested.
- A paid physical sample passes visual and durability review.

Passing lint, unit tests, and a build is necessary but not sufficient.

## 25. Primary reference documents

Current repository references:

- `docs/BRAND_GUIDELINES.md`
- `docs/free-book-launch.md`
- `src/lib/brand.ts`
- `src/lib/pricing.ts`
- `src/components/Funnel.tsx`
- `src/lib/order/prepare.ts`
- `src/lib/lulu/client.ts`
- `src/app/api/stripe/webhook/route.ts`
- `supabase/migrations/`
- `.env.example`
- `vercel.ts`

Dated research references:

- `/Users/myphu/Downloads/ourTailTales/ourTailTales_MVP_Cursor_Build_Spec.pdf`
- `/Users/myphu/Downloads/ourTailTales/ourTailTales_Canva_Brand_Guidelines.pdf`
- `/Users/myphu/Downloads/ourTailTales/ourTailTales_Lulu_Print_API_Cursor_Handoff.pdf`
- `/Users/myphu/Downloads/ourTailTales/output/pdf/pet_memoir_market_analysis_2026-09-13.pdf`
- `/Users/myphu/Downloads/ourTailTales/output/pdf/pet_memoir_competitor_deep_dive_2026-09-15.pdf`

External vendor sources should be freshly checked when used:

- Lulu Print API documentation and current OpenAPI schema.
- Stripe documentation and dashboard configuration.
- Supabase project schema, Auth settings, RLS, and Storage policies.
- Vercel deployment and environment dashboards.

## 26. One-paragraph kickoff prompt for another agent

You are joining ourTailTales, a Next.js 16 app that turns a pet owner's photo album into a chronological, owner-reviewed hardcover life story fulfilled through Lulu. Treat `/Users/myphu/Documents/GitHub/ourTailTales` as the canonical codebase, read `AGENTS.md`, inspect the dirty working tree, and preserve existing user edits. The product should feel like a literary book company with technology underneath; real photos and memories are central, AI must not fabricate facts, and current pricing comes from `src/lib/pricing.ts`. The most important current gap is that the landing/free-book flow ends at an authenticated preview instead of continuing into the existing editor/checkout. Video Memories are not live even though scaffolding and marketing copy exist. Local lint, 58 tests, and build pass, but production readiness remains unproven: reverify Supabase migrations/auth/RLS, secure order access, configure Stripe, prove Lulu sandbox and physical print, reconcile the 54-page base economics, add operational emails/refunds/monitoring, and verify DNS/deployment before accepting real orders.

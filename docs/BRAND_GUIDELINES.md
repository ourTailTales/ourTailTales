# ourTailTales Brand Guidelines

Brand name:
ourTailTales

Website:
ourtailtales.com

Brand line:
“Their life, in chapters.”

## Brand direction

ourTailTales should feel:
- Literary
- Gentle
- Personal
- Modern
- Hopeful
- Trustworthy

The product should feel like a beautifully edited book company with technology underneath, not an AI app with a pet theme.

The customer's real photos and memories are the emotional centerpiece.

Avoid:
- Beige/tan-dominant branding
- Funeral-like styling
- Heavy black memorial aesthetics
- Angel wings
- Halos
- Rainbow bridge clichés
- Excessive paw-print motifs
- Scrapbook textures
- Sad stock photography
- Cartoon clip art
- Making AI the visual/emotional centerpiece

## Official colors

Primary:
Chapter Periwinkle
`#5B68C8`

Use for:
- Primary CTA buttons
- Links
- Progress indicators
- Active controls
- Key brand moments

Secondary:
Memory Blue
`#C9D8FA`

Use for:
- Dropzones
- Cards
- Soft backgrounds
- Upload areas

Keepsake Lavender
`#E2D7F5`

Use for:
- Chapter accents
- Secondary highlights
- Soft decorative fields

Quiet Sage
`#C9DED7`

Use for:
- Success states
- Positive/supportive UI
- Secondary accents

Warm Petal
`#EDB8AA`

Use sparingly:
- Small warm accent
- Never use as the dominant interface color

Neutrals:

Ink
`#252A3A`

Use for:
- Headings
- Body copy
- High contrast text

Cloud
`#F7F8FC`

Use as:
- Main website background
- Replacement for the current tan/cream background

White
`#FFFFFF`

Recommended overall visual ratio:
- 60% Cloud / white
- 20% Ink
- 12% Periwinkle
- 8% supporting pastels

Primary buttons:
`#5B68C8` background
white text

Do not put light text directly on pastel backgrounds unless contrast is accessible.
Pastel surfaces should usually use Ink text.

### Implementation tokens

CSS / Tailwind (`src/app/globals.css`) and TypeScript (`src/lib/brand.ts`):

| Token | Hex | Notes |
|-------|-----|-------|
| `--color-periwinkle` | `#5B68C8` | Primary |
| `--color-periwinkle-deep` | `#4A56B0` | Hover / pressed |
| `--color-periwinkle-wash` | `#EEF1FB` | Soft primary tint |
| `--color-memory-blue` | `#C9D8FA` | Soft surfaces |
| `--color-lavender` | `#E2D7F5` | Chapter accents |
| `--color-sage` | `#C9DED7` | Success wash |
| `--color-sage-deep` | `#3F6B5C` | Success text (accessible) |
| `--color-petal` | `#EDB8AA` | Sparse warm accent |
| `--color-ink` | `#252A3A` | Text |
| `--color-ink-soft` | `#5A6070` | Secondary text |
| `--color-ink-faint` | `#8B91A0` | Metadata |
| `--color-line` | `#D5DCEB` | Borders |
| `--color-cloud` | `#F7F8FC` | Page background |
| `--color-white` | `#FFFFFF` | Cards, book pages |

## Typography

Display / editorial:
DM Serif Display

Use for:
- Hero headings
- Chapter titles
- Emotional statements
- Book titles
- Major section headings

Product/UI/body:
Inter

Use for:
- Navigation
- Instructions
- Forms
- Buttons
- Pricing
- Metadata
- Body copy
- Checkout UI

Recommended web hierarchy:

H1:
DM Serif Display
48–64px desktop
responsive down appropriately on mobile

H2:
DM Serif Display
32–40px

Body:
Inter Regular
16–18px

Buttons / UI:
Inter SemiBold
14–16px

Metadata:
Inter Medium
12–14px
Ink with reduced opacity

Use `next/font` for both fonts (`src/app/layout.tsx`).

## Shape and interface language

Web cards and dropzones:
- 16–24px border radius
- thin 1px borders
- restrained shadows
- no glassmorphism
- no heavy gradients
- no excessive decoration

Book pages:
- Mostly square/rectangular
- Clean editorial layouts
- Generous margins
- White page backgrounds
- Very subtle page shadow in previews

Chapter opening pages may use:
- Memory Blue
- Keepsake Lavender
- Quiet Sage

behind chapter title/date/blurb.

Regular photo pages should stay visually quiet.

Rule:
If a design element competes with the customer's pet photo, remove it.

## Photography

Prioritize genuine candid pet photography:
- couch naps
- walks
- car rides
- family moments
- outdoor trips
- imperfect phone photos

Real-life imagery is preferable to polished stock imagery.

## Logo

Primary mark:
`public/branding/logo.png` (master, 2000×2000)

Web-optimized:
`public/branding/logo-512.png`

Use the book-with-paw mark alongside the wordmark `ourTailTales` in site headers via `BrandMark`.

Do:
- Pair logo + wordmark in navigation/headers
- Keep generous clear space around the mark
- Use the transparent PNG on Cloud / white / soft pastel surfaces

Don’t:
- Recolor the mark arbitrarily
- Stretch or crop the book
- Place the logo heavily inside printed book page layouts (photos stay the focus)
- Use the logo as a repeating decorative pattern

App icons are generated from the same mark (`src/app/icon.png`, `src/app/apple-icon.png`).

## Icons

Use one consistent simple line-icon family.

Suitable icon concepts:
- book
- image/photo
- location pin
- sparkle
- heart

Avoid cartoon-style pet iconography beyond the official logo mark.

## Brand voice

Warm, direct and specific.

Write like someone helping organize meaningful memories, not like a grief counselor.

Preferred language:
- “their story”
- “their life”
- “the moments you shared”
- “keep their story close”

Keep copy concise.

Avoid:
- manipulative urgency around loss
- overly dramatic grief language
- constant mentions of AI
- technical AI terminology in customer-facing copy

AI helps organize the story.
The pet and the customer's memories are the product.

## Capitalization

Always:

- Brand: `ourTailTales`
- Domain: `ourtailtales.com`

Never: Our Tail Tales, Tail Tales, OurTailTales (as display brand).

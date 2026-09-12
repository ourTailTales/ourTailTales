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

2. Edit `.env.local` with your values.

| Variable | Description |
| --- | --- |
| `NEXT_PUBLIC_APP_NAME` | Public app display name |
| `NEXT_PUBLIC_APP_URL` | Public base URL |

`NEXT_PUBLIC_*` variables are available in the browser. Keep secrets server-only (no `NEXT_PUBLIC_` prefix). `.env`, `.env.local`, and other env files are gitignored; commit `.env.example` only.

## Scripts

```bash
npm run dev    # development server
npm run build  # production build
npm run start  # run production build
npm run lint   # ESLint
```

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Learn Next.js](https://nextjs.org/learn)

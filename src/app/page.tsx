export default function Home() {
  const appName = process.env.NEXT_PUBLIC_APP_NAME ?? "ourTailTales";

  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex flex-1 w-full max-w-3xl flex-col items-center justify-center gap-6 py-32 px-16 text-center sm:items-start sm:text-left">
        <h1 className="text-4xl font-semibold tracking-tight text-black dark:text-zinc-50">
          {appName}
        </h1>
        <p className="max-w-md text-lg leading-8 text-zinc-600 dark:text-zinc-400">
          Memory book creation software. Edit{" "}
          <code className="rounded bg-black/[.06] px-1.5 py-0.5 font-mono text-[0.9em] dark:bg-white/[.08]">
            src/app/page.tsx
          </code>{" "}
          to get started.
        </p>
      </main>
    </div>
  );
}

/// <reference lib="webworker" />

import { processFile } from "@/lib/photo/pipeline";

/** Files decoded at once. Kept low so large albums stay memory-bounded. */
const CONCURRENCY = 4;

export type WorkerRequest =
  | { type: "process"; items: { id: string; file: File }[] }
  | { type: "cancel" };

export type WorkerResponse =
  | { type: "photo"; photo: Awaited<ReturnType<typeof processFile>> }
  | { type: "failed"; id: string; reason: string }
  | { type: "done" };

let canceled = false;

self.addEventListener("message", (event: MessageEvent<WorkerRequest>) => {
  const message = event.data;

  if (message.type === "cancel") {
    canceled = true;
    return;
  }

  if (message.type === "process") {
    canceled = false;
    void run(message.items);
  }
});

async function run(items: { id: string; file: File }[]): Promise<void> {
  let cursor = 0;

  const lane = async (): Promise<void> => {
    while (!canceled) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;

      const { id, file } = items[index];
      try {
        const photo = await processFile(id, file);
        post({ type: "photo", photo });
      } catch (error) {
        post({
          type: "failed",
          id,
          reason: error instanceof Error ? error.message : "unreadable",
        });
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, items.length) }, lane),
  );

  if (!canceled) post({ type: "done" });
}

function post(message: WorkerResponse): void {
  (self as unknown as Worker).postMessage(message);
}

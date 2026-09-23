"use client";

import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";

import { BookStudio } from "@/components/studio/BookStudio";
import { PetIntake } from "@/components/studio/PetIntake";
import { UploadMediaModal } from "@/components/editor/UploadMediaModal";
import { filesFromDataTransfer } from "@/lib/photo/process";
import { bookSpec, MIN_PHOTOS_FOR_BOOK } from "@/lib/pricing";
import { track } from "@/lib/analytics";
import {
  summarizeAlbum,
  useOurTailTalesStore,
} from "@/store/useOurTailTalesStore";

/**
 * Who, then the album, then the wait, then the book.
 *
 * The old flow asked the customer to choose how many chapters they wanted and
 * press a button to start writing. That is gone — the chapter count follows
 * from how many usable photos there are, and there is no decision left to make
 * once the album is in.
 *
 * What stays is the short intake, because the writer genuinely cannot work
 * without it. A name, what kind of animal, whether they are still here: none
 * of that is in the photographs, and a book written without it is about an
 * anonymous animal in the past tense. Everything the intake collects stays
 * editable afterwards from the title page.
 */
export function BookFlow({
  onFiles,
  onStartOver,
  onCreateStory,
  onRegenerate,
  onUnlock,
  onDownload,
  onCheckout,
  unlocked,
  downloading,
  notice,
}: {
  onFiles: (files: File[]) => void;
  onStartOver: () => void;
  onCreateStory: () => void;
  onRegenerate: (chapterId: string) => void;
  onUnlock: () => void;
  onDownload: () => void;
  onCheckout: () => void;
  unlocked: boolean;
  downloading: boolean;
  notice?: string | null;
}) {
  const funnelState = useOurTailTalesStore((state) => state.funnelState);
  const petName = useOurTailTalesStore((state) => state.meta.petName);
  const photos = useOurTailTalesStore((state) => state.photos);
  const albumVideos = useOurTailTalesStore((state) => state.albumVideos);
  const progress = useOurTailTalesStore((state) => state.progress);
  const processingError = useOurTailTalesStore((state) => state.processingError);
  const chapters = useOurTailTalesStore((state) => state.chapters);
  const chapterCount = useOurTailTalesStore((state) => state.chapterCount);
  const leadEmail = useOurTailTalesStore((state) => state.leadEmail);
  const setLeadEmail = useOurTailTalesStore((state) => state.setLeadEmail);
  const confirmBookSize = useOurTailTalesStore((state) => state.confirmBookSize);

  const summary = useMemo(() => summarizeAlbum(photos), [photos]);
  const mediaCount = summary.placeable + albumVideos.length;

  const [dragOver, setDragOver] = useState(false);
  const [dropping, setDropping] = useState(false);
  const [uploadDismissed, setUploadDismissed] = useState(false);
  // A restored draft has already been through this, so it never sees it twice.
  const [intakeDone, setIntakeDone] = useState(() => Boolean(petName.trim()));

  const processing = funnelState === "processing" || dropping;
  const atStart = funnelState === "idle" && mediaCount === 0;
  const showIntake = atStart && !intakeDone;
  const showUploadModal = atStart && intakeDone && !uploadDismissed;

  // Build the skeleton as soon as there is enough media. Runs once — later
  // uploads add to the pool photos can be swapped from, they never reset
  // pages the customer has already read or edited.
  useEffect(() => {
    if (chapters.length > 0) return;
    if (funnelState === "processing") return;
    if (mediaCount < MIN_PHOTOS_FOR_BOOK) return;
    confirmBookSize();
    track("book_size_confirmed", {
      chapters: chapterCount,
      price: bookSpec(chapterCount).price,
    });
  }, [chapters.length, funnelState, mediaCount, confirmBookSize, chapterCount]);

  // ...and start writing the moment it exists. There is no question left to
  // ask at this point, so a button here would only be a door to hold open.
  //
  // Latched rather than left to the dependency list: generation costs a model
  // call per chapter, and an effect that runs twice — which React does on
  // purpose in development — would pay for the whole book twice.
  const writingStarted = useRef(false);
  useEffect(() => {
    if (funnelState !== "organizing") return;
    if (chapters.length === 0) return;
    if (writingStarted.current) return;
    writingStarted.current = true;
    onCreateStory();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fires on entering `organizing`, not on identity changes
  }, [funnelState, chapters.length]);

  const handleDrop = (event: DragEvent<HTMLElement>): void => {
    event.preventDefault();
    event.stopPropagation();
    setDragOver(false);
    void (async () => {
      setDropping(true);
      try {
        const files = await filesFromDataTransfer(event.dataTransfer);
        if (files.length > 0) onFiles(files);
      } finally {
        setDropping(false);
      }
    })();
  };

  const reading = funnelState === "editing" || funnelState === "exporting";

  return (
    <section
      className={`relative w-full ${
        dragOver ? "ring-4 ring-inset ring-periwinkle/70" : ""
      }`}
      onDragEnter={(event) => {
        event.preventDefault();
        setDragOver(true);
      }}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
        setDragOver(true);
      }}
      onDragLeave={(event) => {
        const next = event.relatedTarget;
        if (next instanceof Node && event.currentTarget.contains(next)) return;
        setDragOver(false);
      }}
      onDrop={handleDrop}
    >
      {showUploadModal && !showIntake ? (
        <UploadMediaModal
          onFiles={onFiles}
          processing={processing}
          onClose={() => setUploadDismissed(true)}
          email={leadEmail}
          onEmailChange={setLeadEmail}
        />
      ) : null}

      <div className="mx-auto w-full max-w-[90rem] px-5 py-6 sm:px-8 sm:py-8">
        {showIntake ? (
          <PetIntake onDone={() => setIntakeDone(true)} />
        ) : reading ? (
          <>
            <BookStudio
              unlocked={unlocked}
              price={bookSpec(chapterCount).price}
              onUnlock={onUnlock}
              onRegenerate={onRegenerate}
              onFiles={onFiles}
              processing={processing}
              onDownload={onDownload}
              onCheckout={onCheckout}
              downloading={downloading}
              notice={notice}
            />
            <div className="mt-8 flex justify-center">
              <button
                type="button"
                onClick={onStartOver}
                className="text-xs text-page-ink-faint underline decoration-page-line underline-offset-4 hover:text-periwinkle-deep"
              >
                Start over with a different album
              </button>
            </div>
          </>
        ) : (
          <Waiting
            funnelState={funnelState}
            processed={progress.processed}
            total={progress.total}
            chaptersDone={chapters.filter((chapter) => chapter.aiStatus === "done").length}
            chapterCount={chapters.length}
            onOpenUpload={() => setUploadDismissed(false)}
            hasMedia={mediaCount > 0}
            petName={petName}
          />
        )}

        {processingError ? (
          <p role="alert" className="mt-4 text-center text-sm text-periwinkle-deep">
            {processingError}
          </p>
        ) : null}
      </div>
    </section>
  );
}

/**
 * Everything between dropping the album and reading the book.
 *
 * Deliberately one screen with a changing line rather than a sequence of
 * steps: from the customer's side this is a single wait, and cutting it into
 * named stages only makes it feel longer than it is.
 */
function Waiting({
  funnelState,
  processed,
  total,
  chaptersDone,
  chapterCount,
  onOpenUpload,
  hasMedia,
  petName,
}: {
  funnelState: string;
  processed: number;
  total: number;
  chaptersDone: number;
  chapterCount: number;
  onOpenUpload: () => void;
  hasMedia: boolean;
  petName: string;
}) {
  const writing = funnelState === "ai_generating";
  const reading = funnelState === "processing";

  const name = petName.trim();
  const line = writing
    ? chapterCount > 0
      ? `Writing chapter ${Math.min(chaptersDone + 1, chapterCount)} of ${chapterCount}`
      : "Writing the chapters"
    : reading
      ? total > 0
        ? `Reading your photos — ${processed} of ${total}`
        : "Reading your photos"
      : name
        ? `Sorting ${name}\u2019s life into chapters`
        : "Sorting your album into chapters";

  const done = writing
    ? chapterCount > 0
      ? chaptersDone / chapterCount
      : 0
    : total > 0
      ? processed / total
      : 0;

  if (funnelState === "idle" && !hasMedia) {
    return (
      <div className="flex min-h-[55dvh] flex-col items-center justify-center gap-4 text-center">
        <h1 className="font-display text-2xl text-page-ink">
          {petName.trim()
            ? `Now ${petName.trim()}\u2019s photos`
            : "Start with their photos"}
        </h1>
        <p className="max-w-sm text-sm leading-6 text-page-ink-soft">
          Drop the album in and we&rsquo;ll write the whole book — chapters,
          cover and all — in a couple of minutes.
        </p>
        <button
          type="button"
          onClick={onOpenUpload}
          className="mt-1 inline-flex min-h-12 items-center rounded-xl bg-periwinkle px-6 text-base font-semibold text-white shadow-lift hover:bg-periwinkle-deep"
        >
          Choose photos
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-[55dvh] flex-col items-center justify-center gap-5 text-center">
      <span
        className="size-10 animate-spin rounded-full border-[3px] border-periwinkle/25 border-t-periwinkle"
        aria-hidden
      />
      <div>
        <p role="status" className="font-display text-xl text-page-ink">
          {line}
        </p>
        <p className="mt-1.5 text-sm text-page-ink-soft">
          {writing
            ? "Every chapter comes from the photos you gave us. You can change all of it afterwards."
            : "This happens on your own device — nothing is uploaded."}
        </p>
      </div>

      <div
        className="h-1.5 w-56 overflow-hidden rounded-full bg-page-line"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(done * 100)}
      >
        <span
          className="block h-full rounded-full bg-periwinkle transition-[width] duration-500"
          style={{ width: `${Math.max(4, Math.round(done * 100))}%` }}
        />
      </div>
    </div>
  );
}

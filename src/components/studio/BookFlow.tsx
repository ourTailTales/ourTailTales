"use client";

import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";

import { BookStudio } from "@/components/studio/BookStudio";
import { FinishBook } from "@/components/studio/FinishBook";
import { PetIntake } from "@/components/studio/PetIntake";
import { UploadMedia } from "@/components/editor/UploadMedia";
import { nextBookStep } from "@/lib/book/progress";
import { filesFromDataTransfer } from "@/lib/photo/process";
import { bookSpec } from "@/lib/pricing";
import { track } from "@/lib/analytics";
import {
  secondsRemaining,
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
  onStopStory,
  onRegenerate,
  onUnlock,
  onDownload,
  onCheckout,
  unlocked,
  downloading,
  notice,
}: {
  onFiles: (files: File[], target?: { chapterId: string; pageIndex: number }) => void;
  onStartOver: () => void;
  onCreateStory: () => void;
  /** Gives up on the chapters still being written and opens what is done. */
  onStopStory: () => void;
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
  const goToEditing = useOurTailTalesStore((state) => state.goToEditing);
  const removeAlbumPhoto = useOurTailTalesStore((state) => state.removeAlbumPhoto);
  const removeAlbumVideo = useOurTailTalesStore((state) => state.removeAlbumVideo);

  const summary = useMemo(() => summarizeAlbum(photos), [photos]);
  const mediaCount = summary.placeable + albumVideos.length;

  /**
   * Done editing, looking at what it costs.
   *
   * Not a funnel state, because the book is no different for being looked at:
   * this is which screen is up, and a reload puts somebody back in the editor
   * rather than in front of a checkout they may have walked away from. It also
   * clears itself whenever the book leaves the editor — a new album, more
   * photographs to process — since `reading` gates it.
   */
  const [finishing, setFinishing] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [dropping, setDropping] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  // A restored draft has already been through this, so it never sees it twice.
  const [intakeDone, setIntakeDone] = useState(() => Boolean(petName.trim()));

  const processing = funnelState === "processing" || dropping;

  const unwritten = chapters.filter(
    (chapter) => chapter.aiStatus !== "done",
  ).length;
  const step = nextBookStep({
    funnelState,
    chapterCount: chapters.length,
    unwritten,
    mediaCount,
    photoCount: summary.placeable,
  });
  const shortOfPhotos = step === "needPhotos";

  // Nothing to build with yet, whether that is because nothing has arrived
  // or because what arrived wasn't enough. Either way the answer is the same
  // album step, not a hand-off to a screen that only repeats the "add at
  // least N" line already sitting under the drop target.
  const atStart = (funnelState === "idle" && mediaCount === 0) || shortOfPhotos;
  const showIntake = atStart;

  /**
   * Confirming the animal does not replace the screen, it extends it.
   *
   * The upload step used to be a modal that opened itself over the intake the
   * moment the intake was answered, which is two screens fighting over the
   * same moment. Now the album step is simply the next thing down the page
   * and the page travels to it, so the intake stays where it was and the
   * motion says where the flow went.
   */
  const uploadRef = useRef<HTMLDivElement>(null);
  // A restored draft arrives with the intake already answered. It should find
  // the page where it left it, not be thrown down it on load.
  const confirmedOnArrival = useRef(intakeDone);
  useEffect(() => {
    if (!atStart || !intakeDone || confirmedOnArrival.current) return;
    const node = uploadRef.current;
    if (!node) return;
    const frame = requestAnimationFrame(() => {
      node.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    return () => cancelAnimationFrame(frame);
  }, [atStart, intakeDone]);

  /**
   * Gets the book from wherever it is to written, in one place.
   *
   * This was two effects, each guarding a single step of the happy path, and
   * between them they left two states that advanced nowhere. A draft restored
   * mid-generation comes back with its chapters already built but its state
   * recorded as `album_ready`, which neither effect would touch — the book sat
   * on the waiting screen forever, with everything it needed already in hand.
   * An album under the minimum sat there too, with no way to add more.
   *
   * So the rule is stated from the book's own condition rather than from the
   * step it last completed: no chapters means build them, chapters with
   * nothing written means write them, everything written means open the book.
   * Any state that is recoverable now recovers on its own, on the next render.
   */
  const writingFor = useRef<string | null>(null);
  useEffect(() => {
    if (step === "build") {
      confirmBookSize();
      track("book_size_confirmed", {
        chapters: chapterCount,
        price: bookSpec(chapterCount).price,
      });
      return;
    }

    if (step === "open") {
      // A finished book that was only ever one flag short of being readable.
      goToEditing();
      return;
    }

    if (step !== "write") return;

    // Generation costs a model call per chapter, so this must not fire twice
    // for the same work — which React does on purpose in development.
    //
    // It used to latch on a plain boolean, which stopped it firing twice and
    // also stopped it ever firing again. Adding photos from inside the editor
    // sends the book back through here, and with one earlier chapter left
    // unwritten the latch was already closed: nothing advanced, the book
    // never reopened, and the only way out was Start over, which destroys it.
    // Latching on the work instead means the same work is refused and new
    // work is not.
    const work = `${chapters.length}:${unwritten}`;
    if (writingFor.current === work) return;
    writingFor.current = work;
    onCreateStory();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- driven by the book's condition, not by callback identity
  }, [step, chapterCount, chapters.length, unwritten, confirmBookSize, goToEditing]);

  const handleDrop = (event: DragEvent<HTMLElement>): void => {
    event.preventDefault();
    event.stopPropagation();
    setDragOver(false);
    // Handled again in `handleFiles`, which is the chokepoint every path
    // goes through; this just avoids reading the files at all.
    if (processing || funnelState === "ai_generating" || funnelState === "organizing") {
      return;
    }
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
    // `book-editor-field` carries the light theme the whole app area runs on.
    // Without it the studio inherits the dark tokens the hero uses, and every
    // `text-ink` inside it turns the wrong colour against white paper.
    <section
      className={`book-editor-field relative w-full ${
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
      <div className="mx-auto w-full max-w-[90rem] px-5 py-6 sm:px-8 sm:py-8">
        {showIntake ? (
          <>
            <PetIntake onDone={() => setIntakeDone(true)} confirmed={intakeDone} />
            {intakeDone ? (
              <div
                ref={uploadRef}
                className="flex animate-fade-up scroll-mt-6 flex-col justify-center border-t border-page-line/70 py-10"
              >
                <UploadMedia
                  heading={
                    petName.trim()
                      ? `Now ${petName.trim()}\u2019s photos`
                      : "Now their photos"
                  }
                  onFiles={onFiles}
                  processing={processing}
                  email={leadEmail}
                  onEmailChange={setLeadEmail}
                  photoCount={summary.placeable}
                  photos={photos}
                  videos={albumVideos}
                  onRemovePhoto={removeAlbumPhoto}
                  onRemoveVideo={removeAlbumVideo}
                />
              </div>
            ) : null}
          </>
        ) : uploadOpen && !reading ? (
          <div className="flex flex-col justify-center py-10">
            <UploadMedia
              heading="Add more photos"
              onFiles={(files) => {
                setUploadOpen(false);
                onFiles(files);
              }}
              processing={processing}
              email={leadEmail}
              onEmailChange={setLeadEmail}
              onCancel={() => setUploadOpen(false)}
              photoCount={summary.placeable}
              photos={photos}
              videos={albumVideos}
              onRemovePhoto={removeAlbumPhoto}
              onRemoveVideo={removeAlbumVideo}
            />
          </div>
        ) : reading && finishing ? (
          <div className="animate-fade-up py-2">
            {notice ? (
              <p
                role="alert"
                className="mx-auto mb-5 w-full max-w-3xl rounded-xl border border-periwinkle/30 bg-periwinkle-wash/40 px-4 py-3 text-sm text-periwinkle-deep"
              >
                {notice}
              </p>
            ) : null}
            <FinishBook
              onBack={() => setFinishing(false)}
              onCheckout={onCheckout}
              onDownload={onDownload}
              downloading={downloading}
            />
          </div>
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
              onFinish={() => {
                setFinishing(true);
                track("book_finished", {
                  chapters: chapterCount,
                  price: bookSpec(chapterCount).price,
                });
              }}
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
            mediaCount={mediaCount}
            remaining={secondsRemaining(progress)}
            processed={progress.processed}
            total={progress.total}
            chaptersDone={chapters.filter((chapter) => chapter.aiStatus === "done").length}
            chapterCount={chapters.length}
            onOpenUpload={() => setUploadOpen(true)}
            onStartOver={onStartOver}
            onStopStory={onStopStory}
            hasMedia={mediaCount > 0}
            petName={petName}
            error={processingError}
          />
        )}
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
/** "two minutes", "40 seconds" — the shape of a wait, not a stopwatch. */
function describeWait(seconds: number): string {
  if (seconds < 20) return "a few seconds";
  if (seconds < 90) return `${Math.round(seconds / 10) * 10} seconds`;
  const minutes = Math.round(seconds / 60);
  return minutes === 1 ? "a minute" : `${minutes} minutes`;
}

function Waiting({
  funnelState,
  mediaCount,
  remaining,
  onStartOver,
  onStopStory,
  error,
  processed,
  total,
  chaptersDone,
  chapterCount,
  onOpenUpload,
  hasMedia,
  petName,
}: {
  funnelState: string;
  mediaCount: number;
  /** Seconds of reading left, once enough has been read to say. */
  remaining: number | null;
  onStartOver: () => void;
  onStopStory: () => void;
  /** Reading the album failed. */
  error: string | null;
  processed: number;
  total: number;
  chaptersDone: number;
  chapterCount: number;
  onOpenUpload: () => void;
  hasMedia: boolean;
  petName: string;
}) {
  const writing = funnelState === "ai_generating";
  const readingPhotos = funnelState === "processing";

  const name = petName.trim();
  const line = writing
    ? chapterCount > 0
      ? `Writing chapter ${Math.min(chaptersDone + 1, chapterCount)} of ${chapterCount}`
      : "Writing the chapters"
    : readingPhotos
      ? total > 0
        ? `Reading your photos, ${processed.toLocaleString()} of ${total.toLocaleString()}`
        : "Reading your photos"
      : name
        ? `Sorting ${name}\u2019s life into chapters`
        : "Sorting your album into chapters";

  // An album of four thousand is a few minutes of reading, and a bar creeping
  // across with no numbers on it is the same picture whether it has thirty in
  // it or four thousand. Measured from what has actually been read so far.
  const left = readingPhotos ? remaining : null;
  const under = left === null ? null : describeWait(left);

  const done = writing
    ? chapterCount > 0
      ? chaptersDone / chapterCount
      : 0
    : total > 0
      ? processed / total
      : 0;

  // Reading the album failed. This used to be a line of text printed under a
  // spinner that carried on turning at four percent forever, because the
  // failure left the funnel idle with photos already in, which no branch
  // below claims. A dead end with an explanation is still a dead end.
  if (error) {
    return (
      <div className="flex min-h-[55dvh] flex-col items-center justify-center gap-4 text-center">
        <h1 className="font-display text-2xl text-page-ink">
          Something went wrong reading your photos
        </h1>
        <p role="alert" className="max-w-sm text-sm leading-6 text-page-ink-soft">
          {error}
        </p>
        <div className="mt-1 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={onOpenUpload}
            className="inline-flex min-h-12 items-center rounded-xl bg-periwinkle px-6 text-base font-semibold text-white shadow-lift hover:bg-periwinkle-deep"
          >
            Choose photos again
          </button>
          <button
            type="button"
            onClick={onStartOver}
            className="text-xs text-page-ink-faint underline decoration-page-line underline-offset-4 hover:text-periwinkle-deep"
          >
            Start over
          </button>
        </div>
        {mediaCount > 0 ? (
          <p className="text-xs text-page-ink-faint">
            The {mediaCount} we did read are still here.
          </p>
        ) : null}
      </div>
    );
  }

  if (funnelState === "idle" && !hasMedia) {
    return (
      <div className="flex min-h-[55dvh] flex-col items-center justify-center gap-4 text-center">
        <h1 className="font-display text-2xl text-page-ink">
          {petName.trim()
            ? `Now ${petName.trim()}\u2019s photos`
            : "Start with their photos"}
        </h1>
        <p className="max-w-sm text-sm leading-6 text-page-ink-soft">
          Drop the album in. We write the whole book, chapters and cover,
          in a couple of minutes.
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
            : under
              ? `About ${under} left. This happens on your own device — nothing is uploaded.`
              : "This happens on your own device. Nothing is uploaded."}
        </p>
      </div>

      {writing ? (
        <button
          type="button"
          onClick={onStopStory}
          className="text-xs text-page-ink-faint underline decoration-page-line underline-offset-4 hover:text-periwinkle-deep"
        >
          Stop and open what is written
        </button>
      ) : null}

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

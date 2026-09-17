"use client";

import { ArrowLeft, ArrowRight, FolderUp, X } from "lucide-react";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type DragEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";

import { EDGE_PEEL_ZONE } from "@/components/book-viewer/bookGeometry";
import { filesFromDataTransfer, isLikelyMedia } from "@/lib/photo/process";
import { MIN_PHOTOS_FOR_BOOK } from "@/lib/pricing";

function subscribeNever(): () => void {
  return () => {};
}

function useIsClient(): boolean {
  return useSyncExternalStore(subscribeNever, () => true, () => false);
}

export const HERO_UPLOAD_LEAF = "[data-hero-upload-leaf]";
export const HERO_ALBUM_SCROLL = "[data-hero-album-scroll]";

export type AlbumTile = {
  id: string;
  thumbUrl: string;
  kind: "photo" | "video";
  previewUrl?: string;
};

/** File pickers inside the 3D book never open — keep the inputs on `document.body`. */
export function openFilePicker(input: HTMLInputElement | null): void {
  if (!input) return;
  try {
    input.showPicker();
  } catch {
    input.click();
  }
}

export function PortaledImageInputs({
  photosRef,
  folderRef,
  disabled,
  onFiles,
}: {
  photosRef: RefObject<HTMLInputElement | null>;
  folderRef?: RefObject<HTMLInputElement | null>;
  disabled?: boolean;
  onFiles: (files: File[]) => void;
}): ReactNode {
  const mounted = useIsClient();

  const emit = (list: FileList | File[] | null): void => {
    const files = Array.from(list ?? []).filter(isLikelyMedia);
    if (files.length > 0) onFiles(files);
  };

  if (!mounted) return null;

  return createPortal(
    <div className="sr-only" aria-hidden>
      <input
        ref={photosRef}
        type="file"
        accept="image/*,video/*"
        multiple
        disabled={disabled}
        tabIndex={-1}
        onChange={(event) => {
          emit(event.target.files);
          event.target.value = "";
        }}
      />
      {folderRef ? (
        <input
          ref={folderRef}
          type="file"
          {...({ webkitdirectory: "", directory: "" } as object)}
          multiple
          disabled={disabled}
          tabIndex={-1}
          onChange={(event) => {
            emit(event.target.files);
            event.target.value = "";
          }}
        />
      ) : null}
    </div>,
    document.body,
  );
}

type HeroHit = {
  action: string;
  mediaId?: string;
  mediaKind?: "photo" | "video";
};

function heroHitAt(x: number, y: number): HeroHit | null {
  let hit: HeroHit | null = null;
  for (const node of document.querySelectorAll("[data-hero-hit]")) {
    const rect = node.getBoundingClientRect();
    if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
      const kind = node.getAttribute("data-hero-kind");
      hit = {
        action: node.getAttribute("data-hero-hit") ?? "",
        mediaId: node.getAttribute("data-hero-media") ?? undefined,
        mediaKind: kind === "photo" || kind === "video" ? kind : undefined,
      };
    }
  }
  return hit;
}

function AlbumCell({ cell }: { cell: AlbumTile }) {
  return (
    <div className="relative h-full w-full overflow-hidden bg-ink/10">
      {cell.kind === "video" && cell.previewUrl ? (
        <AlbumVideo src={cell.previewUrl} poster={cell.thumbUrl} />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- local browser object URL
        <img src={cell.thumbUrl} alt="" className="h-full w-full object-cover" />
      )}
      <span
        data-hero-hit="remove"
        data-hero-media={cell.id}
        data-hero-kind={cell.kind}
        className="absolute right-0.5 top-0.5 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-ink/70 text-white"
      >
        <X aria-hidden className="h-3 w-3" strokeWidth={2.5} />
        <span className="sr-only">Remove from album</span>
      </span>
    </div>
  );
}

function AlbumVideo({ src, poster }: { src: string; poster: string }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    node.muted = true;
    node.defaultMuted = true;
    const play = () => {
      void node.play().catch(() => {});
    };
    play();
    node.addEventListener("loadeddata", play);
    node.addEventListener("canplay", play);
    return () => {
      node.removeEventListener("loadeddata", play);
      node.removeEventListener("canplay", play);
    };
  }, [src]);

  return (
    <video
      ref={ref}
      src={src}
      poster={poster}
      muted
      loop
      autoPlay
      playsInline
      preload="auto"
      disablePictureInPicture
      controls={false}
      className="h-full w-full object-cover"
    />
  );
}

export function PageTurnLink({
  direction,
  enabled = true,
  onClick,
}: {
  direction: "next" | "prev";
  enabled?: boolean;
  onClick?: () => void;
}) {
  const className = `inline-flex items-center gap-1 font-display text-base font-semibold tracking-wide underline decoration-line underline-offset-4 ${
    enabled ? "text-periwinkle" : "text-ink/35 no-underline"
  }`;
  const label =
    direction === "prev" ? (
      <>
        <ArrowLeft aria-hidden className="h-4 w-4" strokeWidth={2.25} />
        Previous
      </>
    ) : (
      <>
        Next
        <ArrowRight aria-hidden className="h-4 w-4" strokeWidth={2.25} />
      </>
    );

  if (onClick) {
    return (
      <button
        type="button"
        data-hero-hit={direction}
        disabled={!enabled}
        onClick={onClick}
        className={`${className} bg-transparent p-0 disabled:cursor-not-allowed`}
      >
        {label}
      </button>
    );
  }

  return (
    <span data-hero-hit={direction} className={className}>
      {label}
    </span>
  );
}

export function albumColumns(count: number): number {
  if (count <= 0) return 1;
  return Math.min(8, Math.ceil(Math.sqrt(count)));
}

function AlbumGrid({ tiles }: { tiles: AlbumTile[] }) {
  const columns = albumColumns(tiles.length);
  return (
    <div
      data-album-cols={columns}
      className="grid w-full gap-px bg-ink/8"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {tiles.map((cell) => (
        <div key={cell.id} className="aspect-square min-w-0">
          <AlbumCell cell={cell} />
        </div>
      ))}
    </div>
  );
}

export function HeroAlbumPage({
  tiles,
  pane,
  isOver,
  processing,
  readyCount = 0,
  videoCount = 0,
  canTurn = false,
}: {
  tiles: AlbumTile[];
  pane: "left" | "right";
  isOver: boolean;
  processing: boolean;
  readyCount?: number;
  videoCount?: number;
  canTurn?: boolean;
}) {
  if (pane === "left") {
    if (tiles.length === 0) return null;
    return (
      <div
        data-hero-upload-leaf
        data-hero-album-scroll
        data-bv-bleed
        className="h-full overflow-x-hidden overflow-y-auto"
      >
        <AlbumGrid tiles={tiles} />
      </div>
    );
  }

  const uploaded = readyCount + videoCount;
  const photos =
    readyCount === 1 ? "1 photo" : `${readyCount.toLocaleString()} photos`;
  const videos =
    videoCount === 1 ? "1 video" : `${videoCount.toLocaleString()} videos`;

  return (
    <div
      data-hero-upload-leaf
      data-bv-bleed
      className="relative flex h-full flex-col items-center justify-center"
    >
      {uploaded > 0 ? (
        <p className="mb-3 text-center font-display text-sm leading-snug text-ink">
          {readyCount > 0 && videoCount > 0
            ? `${photos} · ${videos}`
            : readyCount > 0
              ? photos
              : videos}
        </p>
      ) : null}
      <div
        data-hero-hit="add"
        className={`flex aspect-square w-[min(100%,14.5rem)] flex-col items-center justify-center rounded-2xl border-2 border-dotted px-5 text-center transition-[border-color,background-color,box-shadow] duration-200 ${
          isOver
            ? "border-periwinkle bg-periwinkle/10 shadow-[inset_0_0_0_1px_var(--color-periwinkle)]"
            : "border-line bg-white/40"
        }`}
      >
        <FolderUp
          aria-hidden
          className="h-10 w-10 text-periwinkle"
          strokeWidth={1.5}
        />
        <span className="mt-3 font-display text-xl leading-snug text-ink">
          {processing ? "Reading…" : "Add photos & videos"}
        </span>
        <span className="mt-1.5 max-w-48 text-xs leading-4 text-ink-soft">
          At least {MIN_PHOTOS_FOR_BOOK} photos & videos to make a book.
        </span>
      </div>
      <span
        data-hero-hit="folder"
        className="mt-3 text-xs font-medium text-periwinkle underline decoration-line underline-offset-4"
      >
        or choose a folder
      </span>
      <span className="absolute bottom-4 right-4">
        <PageTurnLink direction="next" enabled={canTurn} />
      </span>
    </div>
  );
}

export function albumChromeCopy(
  readyCount: number,
  videoCount: number,
  processing: boolean,
): { title: string; status: string } {
  const mediaCount = readyCount + videoCount;
  const remaining = Math.max(0, MIN_PHOTOS_FOR_BOOK - mediaCount);
  const photos =
    mediaCount >= MIN_PHOTOS_FOR_BOOK
      ? `${readyCount.toLocaleString()} photos`
      : `${mediaCount.toLocaleString()} of ${MIN_PHOTOS_FOR_BOOK} photos & videos`;
  const videos =
    videoCount > 0 && mediaCount >= MIN_PHOTOS_FOR_BOOK
      ? ` · ${videoCount.toLocaleString()} video${videoCount === 1 ? "" : "s"}`
      : "";
  return {
    title:
      mediaCount >= MIN_PHOTOS_FOR_BOOK
        ? `${photos}${videos}`
        : photos,
    status: processing
      ? "Reading the rest of their album…"
      : remaining > 0
        ? `${remaining.toLocaleString()} more photos & videos to start a book.`
        : "Add more anytime, or turn the page.",
  };
}

/** Invisible 2D hit target — the painted UI lives on the book page. */
export function HeroUploadLayer({
  onFiles,
  disabled = false,
  isOver,
  onDragState,
  onInteract,
  onHoverChange,
  canContinue = false,
  onNext,
  onRemove,
}: {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
  isOver: boolean;
  onDragState: (over: boolean) => void;
  onInteract?: () => void;
  onHoverChange?: (hovering: boolean) => void;
  canContinue?: boolean;
  onNext?: () => void;
  onRemove?: (id: string, kind: "photo" | "video") => void;
}) {
  const photosRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<CSSProperties | null>(null);
  const [chromePos, setChromePos] = useState<{
    capture: CSSProperties;
  } | null>(null);
  const [reading, setReading] = useState(false);
  const busy = disabled || reading;

  useLayoutEffect(() => {
    let raf = 0;
    let tries = 0;
    const observed = new Set<Element>();
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    });

    const watch = () => {
      for (const node of [
        document.querySelector(".landing-hero-book .bv-book"),
        document.querySelector(".bv-book"),
        document.querySelector(HERO_UPLOAD_LEAF),
        document.querySelector(HERO_ALBUM_SCROLL),
        document.querySelector(".bv-soft-page--right"),
        document.querySelector(".landing-hero-book [data-hero-hit=\"next\"]"),
        document.querySelector(".bv-anchor"),
        document.querySelector(".bv-viewport"),
      ]) {
        if (node && !observed.has(node)) {
          ro.observe(node);
          observed.add(node);
        }
      }
    };

    const update = () => {
      watch();
      const book =
        document.querySelector<HTMLElement>(".landing-hero-book .bv-book") ??
        document.querySelector<HTMLElement>(".bv-book");
      const leaf = document.querySelector<HTMLElement>(HERO_UPLOAD_LEAF);
      const target = book ?? leaf;
      if (!target) {
        setBox(null);
        if (tries < 60) {
          tries += 1;
          raf = requestAnimationFrame(update);
        }
        return;
      }
      const bookRect = target.getBoundingClientRect();
      const page = document.querySelector<HTMLElement>(
        ".landing-hero-book .bv-soft-page--right",
      ) ?? document.querySelector<HTMLElement>(".bv-soft-page--right");
      const pageRect = page?.getBoundingClientRect();
      const left = Math.min(bookRect.left, pageRect?.left ?? bookRect.left);
      const top = Math.min(bookRect.top, pageRect?.top ?? bookRect.top);
      const right = Math.max(bookRect.right, pageRect?.right ?? bookRect.right);
      const bottom = Math.max(bookRect.bottom, pageRect?.bottom ?? bookRect.bottom);
      setBox({
        position: "fixed",
        left,
        top,
        width: right - left,
        height: bottom - top,
        zIndex: 40,
      });
      if (pageRect) {
        const peel = Math.max(72, pageRect.width * EDGE_PEEL_ZONE);
        setChromePos({
          capture: {
            position: "absolute",
            left: 0,
            top: 0,
            width: Math.max(0, pageRect.right - peel - left),
            height: bottom - top,
          },
        });
      } else if (tries < 60) {
        setChromePos(null);
        tries += 1;
        raf = requestAnimationFrame(update);
      } else {
        setChromePos(null);
      }
    };

    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", schedule, { passive: true, capture: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("scroll", schedule, true);
      window.removeEventListener("resize", schedule);
    };
  }, []);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    const onWheel = (event: WheelEvent) => {
      const scroller = document.querySelector<HTMLElement>(HERO_ALBUM_SCROLL);
      if (!scroller || scroller.scrollHeight <= scroller.clientHeight) return;
      const rect = scroller.getBoundingClientRect();
      if (
        event.clientX < rect.left ||
        event.clientX > rect.right ||
        event.clientY < rect.top ||
        event.clientY > rect.bottom
      ) {
        return;
      }
      event.preventDefault();
      scroller.scrollTop += event.deltaY;
    };
    layer.addEventListener("wheel", onWheel, { passive: false });
    return () => layer.removeEventListener("wheel", onWheel);
  }, [box]);

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const hit = heroHitAt(event.clientX, event.clientY);
    const pointer =
      hit?.action === "next"
        ? canContinue
          ? "pointer"
          : "default"
        : hit
          ? "pointer"
          : "default";
    event.currentTarget.style.cursor = busy ? "default" : pointer;
  };

  const handleClick = (event: MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (busy) return;
    const hit = heroHitAt(event.clientX, event.clientY);
    if (hit?.action === "next") {
      if (canContinue) onNext?.();
      return;
    }
    if (hit?.action === "remove" && hit.mediaId && hit.mediaKind) {
      onRemove?.(hit.mediaId, hit.mediaKind);
      return;
    }
    onInteract?.();
    if (hit?.action === "folder") {
      openFilePicker(folderRef.current);
      return;
    }
    if (hit?.action === "add") {
      openFilePicker(photosRef.current);
    }
  };

  if (!box) return null;

  const captureHandlers = {
    onPointerEnter: () => onHoverChange?.(true),
    onPointerLeave: () => {
      onHoverChange?.(false);
      onDragState(false);
    },
    onPointerMove: handlePointerMove,
    onPointerDown: (event: PointerEvent<HTMLDivElement>) => {
      event.stopPropagation();
    },
    onPointerUp: (event: PointerEvent<HTMLDivElement>) => {
      event.stopPropagation();
    },
    onClick: handleClick,
    onDragEnter: (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      onInteract?.();
      onDragState(true);
    },
    onDragOver: (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      onInteract?.();
      onDragState(true);
    },
    onDragLeave: (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      onDragState(false);
    },
    onDrop: (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      onDragState(false);
      void (async () => {
        setReading(true);
        try {
          const files = await filesFromDataTransfer(event.dataTransfer);
          if (files.length > 0) onFiles(files);
        } finally {
          setReading(false);
        }
      })();
    },
  };

  return createPortal(
    <div
      ref={layerRef}
      data-hero-upload-layer
      style={box}
      className="pointer-events-none"
    >
      <span className="sr-only">
        {isOver ? "Drop photos or videos to add them" : "Add photos and videos"}
      </span>
      <div
        data-hero-capture
        className="pointer-events-auto"
        style={
          chromePos?.capture ?? {
            position: "absolute",
            inset: 0,
          }
        }
        {...captureHandlers}
      />
      <PortaledImageInputs
        photosRef={photosRef}
        folderRef={folderRef}
        disabled={busy}
        onFiles={onFiles}
      />
    </div>,
    document.body,
  );
}

function hitBox(action: "next" | "prev"): CSSProperties | null {
  const painted = document.querySelector<HTMLElement>(
    `.landing-hero-book [data-hero-hit="${action}"]`,
  );
  if (!painted) return null;
  const rect = painted.getBoundingClientRect();
  if (rect.width < 2 || rect.height < 2) return null;
  return {
    position: "fixed",
    left: rect.left,
    top: rect.top,
    width: Math.max(rect.width, 44),
    height: Math.max(rect.height, 24),
    zIndex: 41,
  };
}

/** 2D hits for painted Previous / Next — clicks inside the 3D book never fire. */
export function HeroTurnChrome({
  canNext = false,
  canPrev = false,
  onNext,
  onPrev,
}: {
  canNext?: boolean;
  canPrev?: boolean;
  onNext?: () => void;
  onPrev?: () => void;
}) {
  const [nextBox, setNextBox] = useState<CSSProperties | null>(null);
  const [prevBox, setPrevBox] = useState<CSSProperties | null>(null);
  const mounted = useIsClient();

  useLayoutEffect(() => {
    let raf = 0;
    const update = () => {
      setNextBox(hitBox("next"));
      setPrevBox(hitBox("prev"));
    };
    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    };
    update();
    const ro = new ResizeObserver(schedule);
    const book = document.querySelector(".landing-hero-book .bv-book");
    if (book) ro.observe(book);
    window.addEventListener("scroll", schedule, { passive: true, capture: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("scroll", schedule, true);
      window.removeEventListener("resize", schedule);
    };
  }, []);

  if (!mounted) return null;

  return createPortal(
    <>
      {prevBox ? (
        <span
          data-hero-turn="prev"
          style={prevBox}
          className={canPrev ? "cursor-pointer" : "cursor-default"}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            if (canPrev) onPrev?.();
          }}
        />
      ) : null}
      {nextBox ? (
        <span
          data-hero-turn="next"
          style={nextBox}
          className={canNext ? "cursor-pointer" : "cursor-default"}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            if (canNext) onNext?.();
          }}
        />
      ) : null}
    </>,
    document.body,
  );
}

/** Live form on top of the right leaf — 3D pages swallow pointer events. */
export function HeroLeafLayer({ children }: { children: ReactNode }) {
  const [box, setBox] = useState<CSSProperties | null>(null);
  const mounted = useIsClient();

  useLayoutEffect(() => {
    let raf = 0;
    const update = () => {
      const page =
        document.querySelector<HTMLElement>(
          ".landing-hero-book .bv-soft-page--right",
        ) ?? document.querySelector<HTMLElement>(".bv-soft-page--right");
      if (!page) {
        setBox(null);
        return;
      }
      const rect = page.getBoundingClientRect();
      if (rect.width < 8 || rect.height < 8) {
        setBox(null);
        return;
      }
      setBox({
        position: "fixed",
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
        zIndex: 42,
        backgroundColor: "#f3eee4",
        boxShadow: "none",
        overflow: "auto",
        padding: "1.25rem 1.35rem",
        borderRadius: "0 8px 8px 0",
      });
    };
    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    };
    update();
    const ro = new ResizeObserver(schedule);
    const page = document.querySelector(".landing-hero-book .bv-soft-page--right");
    if (page) ro.observe(page);
    window.addEventListener("scroll", schedule, { passive: true, capture: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("scroll", schedule, true);
      window.removeEventListener("resize", schedule);
    };
  }, []);

  if (!mounted || !box) return null;

  return createPortal(
    <div
      data-hero-leaf-layer
      style={box}
      className="pointer-events-auto text-ink"
      onPointerDown={(event) => event.stopPropagation()}
    >
      {children}
    </div>,
    document.body,
  );
}

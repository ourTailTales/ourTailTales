"use client";

import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";

import { DURATION, EASE, animate, motionOk } from "@/lib/motion";

/**
 * The book, turning.
 *
 * One page is on the table at a time and turning it lifts the sheet off its
 * right edge and swings it left about the spine, so the next page comes out
 * from underneath. That is a real leaf of a real book: in a bound memoir the
 * page you are reading and the page after it are the two sides of one sheet,
 * which is why a single-page view can turn like this and still be honest
 * about the object it is standing in for.
 *
 * The pages stay live DOM rather than becoming textures on a mesh. Rendering
 * the book into WebGL would buy a truer curl and cost the three things the
 * flip-through is for: text that stays sharp at the size someone actually
 * reads it, edits that appear on the next render instead of after a
 * re-rasterise, and a page a screen reader can still read. So the geometry is
 * CSS and the choreography is anime.js, and the curl is faked with light and
 * shadow, which is most of what the eye is reading during a 700ms turn
 * anyway.
 *
 * The interaction model comes straight off the reference: grab the right half
 * to go forward, the left half to go back, drag as far as you like, and let
 * go. Past roughly a third of the way the page falls forward under its own
 * weight; short of that it drops back where it was. Nothing commits on
 * release alone, which is what makes it safe to grab the page just to look.
 */

/** Share of the turn a drag must cross before releasing commits it. */
const COMMIT_AT = 0.32;

/** How much of the page's width a full turn's drag covers. */
const DRAG_SPAN = 0.62;

/**
 * Pixels of travel before a press on the page counts as turning it.
 *
 * Below this a press is a press: a tap on a photo, or the start of a scroll
 * down the screen. The gesture also has to be more sideways than vertical,
 * because on a phone the page fills the screen and most of what happens on it
 * is somebody scrolling past it.
 */
const GESTURE_THRESHOLD = 8;

type Turn = {
  /** The page the sheet is leaving. */
  from: number;
  /** The page it is arriving at. */
  to: number;
  /** 1 going forward through the book, -1 going back. */
  dir: 1 | -1;
  /** True while a finger or cursor is on the page. */
  held: boolean;
};

export function PageTurn({
  position,
  count,
  onTurn,
  renderPage,
  className,
}: {
  /** The page that should end up on the table. */
  position: number;
  count: number;
  /** Called when a turn the visitor started should change the selection. */
  onTurn: (next: number) => void;
  renderPage: (index: number) => ReactNode;
  className?: string;
}) {
  /** The page actually lying flat right now, which lags `position` mid-turn. */
  const [shown, setShown] = useState(position);
  /** A turn the visitor is driving with their own hand. */
  const [held, setHeld] = useState<Turn | null>(null);

  /**
   * The turn in progress, if any.
   *
   * A turn someone started somewhere else — a thumbnail, an arrow key — is not
   * a fact worth storing: it is exactly the gap between the page asked for and
   * the page on the table, so it is derived. Only a turn being dragged has
   * state of its own, because only that one knows something React does not.
   */
  const turn: Turn | null =
    held ??
    (position !== shown
      ? {
          from: shown,
          to: position,
          dir: position > shown ? 1 : -1,
          held: false,
        }
      : null);

  const sceneRef = useRef<HTMLDivElement>(null);
  const leafRef = useRef<HTMLDivElement>(null);
  const glareRef = useRef<HTMLDivElement>(null);
  const castRef = useRef<HTMLDivElement>(null);
  const edgeRef = useRef<HTMLDivElement>(null);

  /** 0 = not turned at all, 1 = fully turned. */
  const progress = useRef(0);
  const playing = useRef<{ cancel: () => void } | null>(null);
  const grab = useRef<{
    x: number;
    y: number;
    width: number;
    pointer: number;
    dir: 1 | -1;
    to: number;
    /** Set once the movement is unambiguously a turn. */
    committed: boolean;
  } | null>(null);

  /**
   * Put the sheet where `progress` says it is.
   *
   * Written straight to style rather than through React: this runs on every
   * frame of a drag, and a re-render per frame is how a page turn becomes a
   * stutter on the phones most of these visitors are holding.
   */
  const paint = useCallback((value: number, dir: 1 | -1): void => {
    progress.current = value;

    // Going back is the same sheet running the other way.
    const swung = dir === 1 ? value : 1 - value;
    const angle = -180 * swung;
    // Peaks halfway through, where the sheet is most off the table.
    const lift = Math.sin(Math.PI * swung);

    const leaf = leafRef.current;
    if (leaf) {
      leaf.style.transform = `rotateY(${angle}deg)`;
      leaf.style.boxShadow = `${18 * lift}px ${10 * lift}px ${40 * lift}px -${
        8 * lift
      }px rgb(25 32 58 / ${0.36 * lift})`;
    }

    // Light running across the sheet as it stands up.
    if (glareRef.current) {
      glareRef.current.style.opacity = String(0.5 * lift);
    }
    // The sheet's own shadow falling across the page underneath.
    if (castRef.current) {
      castRef.current.style.opacity = String(0.42 * lift);
      castRef.current.style.width = `${Math.max(0, 100 - swung * 92)}%`;
    }
    // A sliver of paper thickness at the spine, so the sheet has a body.
    if (edgeRef.current) {
      edgeRef.current.style.opacity = String(Math.min(1, lift * 1.6));
    }
  }, []);

  /** Run the sheet to `to` and then do something. */
  const glide = useCallback(
    (to: number, dir: 1 | -1, duration: number, done: () => void): void => {
      playing.current?.cancel();

      if (!motionOk()) {
        paint(to, dir);
        // Never synchronously, so that a caller inside an effect does not turn
        // this into a cascading render.
        queueMicrotask(done);
        return;
      }

      const state = { p: progress.current };
      const run = animate(state, {
        p: to,
        duration,
        ease: EASE.paper,
        onUpdate: () => paint(state.p, dir),
        onComplete: () => {
          playing.current = null;
          done();
        },
      });
      playing.current = { cancel: () => run.pause() };
    },
    [paint],
  );

  /** Land the turn: the arriving page becomes the page on the table. */
  const land = useCallback((next: number): void => {
    progress.current = 0;
    setShown(next);
    setHeld(null);
    // Clear the mid-turn styling before the flat page paints.
    if (leafRef.current) {
      leafRef.current.style.transform = "rotateY(0deg)";
      leafRef.current.style.boxShadow = "none";
    }
  }, []);

  /**
   * Somebody chose a page somewhere else: a thumbnail, an arrow, the keyboard.
   * Turn to it rather than cutting, so the filmstrip and the book stay the
   * same gesture.
   */
  useEffect(() => {
    if (held || position === shown) return;
    // Already turning towards it; let that finish.
    if (playing.current) return;
    const dir: 1 | -1 = position > shown ? 1 : -1;
    paint(0, dir);
    glide(1, dir, DURATION.turn, () => land(position));
  }, [position, shown, held, glide, land, paint]);

  useEffect(() => () => playing.current?.cancel(), []);

  const startDrag = (event: React.PointerEvent<HTMLDivElement>): void => {
    if (event.button !== 0) return;
    // Let a turn already in flight finish rather than fighting it.
    if (turn) return;

    const scene = sceneRef.current;
    if (!scene) return;

    const box = scene.getBoundingClientRect();
    // Grab the right half to go forward, the left half to go back, exactly
    // where a hand would reach for the page.
    const dir: 1 | -1 = event.clientX - box.left > box.width * 0.5 ? 1 : -1;
    const to = shown + dir;
    if (to < 0 || to >= count) return;

    // Nothing moves and nothing is captured yet: this might still turn out to
    // be a tap or a scroll.
    grab.current = {
      x: event.clientX,
      y: event.clientY,
      width: box.width,
      pointer: event.pointerId,
      dir,
      to,
      committed: false,
    };
  };

  const moveDrag = (event: React.PointerEvent<HTMLDivElement>): void => {
    const g = grab.current;
    if (!g) return;

    const dx = g.x - event.clientX;
    const dy = g.y - event.clientY;

    if (!g.committed) {
      if (Math.abs(dx) < GESTURE_THRESHOLD) return;
      // A scroll down the page is not a page turn.
      if (Math.abs(dy) > Math.abs(dx)) {
        grab.current = null;
        return;
      }
      // Only a turn in the direction the page was grabbed for.
      if (Math.sign(dx) !== g.dir) {
        grab.current = null;
        return;
      }
      g.committed = true;
      setHeld({ from: shown, to: g.to, dir: g.dir, held: true });
      paint(0, g.dir);
      sceneRef.current?.setPointerCapture(event.pointerId);
    }

    // Forward is a pull to the left, back is a pull to the right.
    const travelled = dx * g.dir;
    paint(
      Math.min(1, Math.max(0, travelled / (g.width * DRAG_SPAN))),
      g.dir,
    );
  };

  const endDrag = (event: React.PointerEvent<HTMLDivElement>): void => {
    const g = grab.current;
    grab.current = null;
    if (!g?.committed) return;

    const scene = sceneRef.current;
    if (scene?.hasPointerCapture(event.pointerId)) {
      scene.releasePointerCapture(event.pointerId);
    }

    const { to, dir } = g;
    setHeld({ from: shown, to, dir, held: false });

    if (progress.current > COMMIT_AT) {
      // Carry the rest of the turn at the speed it was already going.
      glide(1, dir, Math.max(180, DURATION.turn * (1 - progress.current)), () => {
        land(to);
        onTurn(to);
      });
    } else {
      glide(0, dir, DURATION.settle, () => setHeld(null));
    }
  };

  // Mid-turn the page underneath is the one being arrived at; the sheet on top
  // carries the one being left. Going back, those swap.
  const beneath = turn ? (turn.dir === 1 ? turn.to : turn.from) : shown;
  const onLeaf = turn ? (turn.dir === 1 ? turn.from : turn.to) : shown;

  return (
    <div
      ref={sceneRef}
      onPointerDown={startDrag}
      onPointerMove={moveDrag}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      className={`book-scene relative aspect-square w-full touch-pan-y select-none overflow-hidden ${
        className ?? ""
      }`}
    >
      {/* The page on the table. */}
      <div className="absolute inset-0">{renderPage(beneath)}</div>

      {/* Its shadow, cast by whatever is standing up over it. */}
      <div
        ref={castRef}
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 opacity-0"
        style={{
          background:
            "linear-gradient(to right, rgb(25 32 58 / 0.55), rgb(25 32 58 / 0.14) 45%, transparent)",
        }}
      />

      {/* The sheet. Hinged at the spine, which is the left edge. */}
      <div
        ref={leafRef}
        aria-hidden={Boolean(turn)}
        className="absolute inset-0 origin-left"
        style={{ transformStyle: "preserve-3d", willChange: "transform" }}
      >
        <div className="absolute inset-0 [backface-visibility:hidden]">
          {renderPage(onLeaf)}
          <div
            ref={glareRef}
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-0"
            style={{
              background:
                "linear-gradient(105deg, rgb(255 255 255 / 0.62), rgb(255 255 255 / 0.05) 38%, rgb(25 32 58 / 0.1))",
            }}
          />
        </div>

        {/* The back of the sheet. Paper, in its own shadow, which is all you
            ever actually see of the reverse of a page you are lifting. */}
        <div
          aria-hidden
          className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)]"
          style={{
            background:
              "linear-gradient(255deg, #f3efe7 0%, #ece7dd 58%, #ddd6c9 100%)",
          }}
        />
      </div>

      {/* Paper thickness at the spine. */}
      <div
        ref={edgeRef}
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 w-[3px] opacity-0"
        style={{
          background: "linear-gradient(to right, rgb(25 32 58 / 0.3), transparent)",
        }}
      />
    </div>
  );
}

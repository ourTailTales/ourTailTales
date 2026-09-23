import { animate, createTimeline, eases, stagger, utils } from "animejs";

/**
 * The motion vocabulary for building a book.
 *
 * One deliberate constraint runs through all of it: nothing bounces. A good
 * share of these books are about an animal that has died, and springy,
 * playful motion in the middle of that reads as a product that has not
 * understood what it is holding. So everything here behaves like paper and
 * like weight. Things leave quickly and arrive slowly, they settle instead of
 * overshooting, and they move a short distance. The warmth comes from the
 * unhurriedness, not from the springiness.
 *
 * Every helper is a no-op when the visitor has asked their system for less
 * motion. That check happens here rather than at each call site so it cannot
 * be forgotten in one place and honoured in four others.
 */

/** How long things take. Milliseconds. */
export const DURATION = {
  /** A control acknowledging a press. Below this it reads as a glitch. */
  tap: 150,
  /** Something arriving on screen. */
  enter: 460,
  /** One step of the flow giving way to the next. */
  step: 560,
  /** A page of the book turning under its own weight. */
  turn: 760,
  /** A page falling back because the turn was never committed. */
  settle: 320,
} as const;

/**
 * How things move.
 *
 * `paper` is the one that matters: a sheet leaves the hand fast and lands
 * slow, and it never travels past where it is going. It is the same curve the
 * page turn uses, which is why the rest of the flow feels like it belongs to
 * the same object.
 */
export const EASE = {
  paper: "outQuart",
  enter: "outCubic",
  exit: "inQuad",
  /** Reserved for a value counting up, where linear looks mechanical. */
  count: "outExpo",
} as const;

/** Distance something rises as it fades in. Pixels. */
const RISE = 14;

/**
 * Whether to animate at all.
 *
 * Read fresh every time rather than cached: the setting can change while a
 * tab is open, and a memoir is the wrong place to make someone reload to be
 * taken seriously.
 */
export function motionOk(): boolean {
  if (typeof window === "undefined") return false;
  if (typeof window.matchMedia !== "function") return true;
  return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

type Target = Element | Element[] | NodeListOf<Element> | string | null;

function list(target: Target): Element[] {
  if (!target) return [];
  if (typeof target === "string") {
    return Array.from(document.querySelectorAll(target));
  }
  if (target instanceof Element) return [target];
  return Array.from(target);
}

/**
 * Bring elements in: a short rise out of nothing, one after another.
 *
 * The stagger is what makes a screen read as composed rather than dumped. It
 * is deliberately small; at anything longer the visitor is waiting for the
 * interface instead of reading it.
 */
export function reveal(
  target: Target,
  options: { delay?: number; gap?: number; distance?: number } = {},
): void {
  const targets = list(target);
  if (!targets.length) return;

  const { delay = 0, gap = 55, distance = RISE } = options;

  if (!motionOk()) {
    utils.set(targets, { opacity: 1, translateY: 0 });
    return;
  }

  utils.set(targets, { opacity: 0, translateY: distance });
  animate(targets, {
    opacity: 1,
    translateY: 0,
    duration: DURATION.enter,
    ease: EASE.enter,
    delay: targets.length > 1 ? stagger(gap, { start: delay }) : delay,
  });
}

/**
 * Acknowledge a press without moving anything anyone is reading.
 *
 * A hair of scale, back again. This exists so that on a phone, where there is
 * no hover to tell you a chip registered, the tap still answers.
 */
export function press(target: Target): void {
  const targets = list(target);
  if (!targets.length || !motionOk()) return;
  animate(targets, {
    scale: [{ to: 0.965, duration: DURATION.tap * 0.4 }, { to: 1, duration: DURATION.tap }],
    ease: EASE.paper,
  });
}

/**
 * Count a number up to where it now is.
 *
 * Used on the generation screen. A percentage that snaps between values looks
 * like it is guessing; one that travels looks like it is measuring something.
 */
export function countTo(
  element: Element | null,
  to: number,
  format: (value: number) => string,
): void {
  if (!element) return;
  const from = Number(element.getAttribute("data-count") ?? "0");
  element.setAttribute("data-count", String(to));

  if (!motionOk() || from === to) {
    element.textContent = format(to);
    return;
  }

  const state = { value: from };
  animate(state, {
    value: to,
    duration: DURATION.step,
    ease: EASE.count,
    onUpdate: () => {
      element.textContent = format(state.value);
    },
  });
}

export { animate, createTimeline, eases, stagger, utils };

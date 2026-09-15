import type { ReactNode } from "react";

/** One physical leaf in the flipbook (hard cover or soft paper). */
export type FlipSheet = {
  id: string;
  kind: "hard" | "soft";
  front: ReactNode;
  /** Reverse of this leaf — never a mirrored copy of `front`. */
  back?: ReactNode;
};

/** A single visible face in the double-page coordinate system. */
export type FlipFace = {
  id: string;
  sheetId: string;
  kind: "hard" | "soft";
  side: "front" | "back";
  content: ReactNode | null;
};

export type Corner = "top-left" | "top-right" | "bottom-left" | "bottom-right";

export type TurnDirection = "forward" | "backward";

export type InteractionState =
  | "idle"
  | "hoveringCorner"
  | "dragging"
  | "completingTurn"
  | "cancellingTurn";

export type Point = { x: number; y: number };

/** Soft-turn geometry applied as CSS vars on the turning leaf. */
export type FoldGeometry = {
  progress: number;
  /** rotateY degrees for the flipping leaf (0 → ±180). */
  flipDeg: number;
  transformOrigin: string;
  frontShadow: string;
  backShadow: string;
  underShadow: string;
  highlight: string;
  contactShadow: string;
  clipPath: string;
  corner: Corner;
  direction: TurnDirection;
};
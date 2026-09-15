import type { FunnelState } from "@/store/useOurTailTalesStore";

export const EDITOR_STEP_COUNT = 5;

export const EDITOR_STEP_LABELS = [
  "Upload their album",
  "Tell us about them",
  "Choose the chapter names",
  "Customize the pages",
  "Order hardcover",
] as const;

/** Restore a carousel index from persisted funnel state. */
export function stepFromFunnelState(funnelState: FunnelState): number {
  switch (funnelState) {
    case "configure":
      return 2;
    case "organizing":
    case "ai_generating":
    case "editing":
    case "exporting":
      return 3;
    default:
      return 0;
  }
}

/** Highest slide the customer may open. */
export function farthestStep(
  funnelState: FunnelState,
  canLeaveUpload: boolean,
): number {
  switch (funnelState) {
    case "editing":
    case "exporting":
      return 4;
    case "organizing":
    case "ai_generating":
      return 3;
    case "configure":
      return 2;
    default:
      return canLeaveUpload ? 1 : 0;
  }
}

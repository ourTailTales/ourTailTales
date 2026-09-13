import type { FrozenBookRevision } from "@/types/video-memory";
import { includedUniqueVideoIds } from "@/lib/video-memory/count";
import { canEnterPermanentArchival } from "@/lib/video-memory/processing/contract";

export function videosEligibleForArchival(revision: FrozenBookRevision): FrozenBookRevision["processedVideos"] {
  const placed = new Set(includedUniqueVideoIds(revision.placements));
  return revision.processedVideos.filter(
    (video) =>
      placed.has(video.videoAssetId) &&
      canEnterPermanentArchival(video.processedBytes),
  );
}

export function mayStartArchival(args: {
  orderStatus: string;
  fulfillmentStage: string | null;
  consentAt: string | null;
}): boolean {
  return (
    args.orderStatus === "paid" &&
    Boolean(args.consentAt) &&
    (args.fulfillmentStage === "pending_archive" ||
      args.fulfillmentStage === "archiving")
  );
}

export function archivalHasStarted(args: {
  fulfillmentStage: string | null;
  hasArweaveTx: boolean;
}): boolean {
  return (
    args.hasArweaveTx ||
    args.fulfillmentStage === "archiving" ||
    args.fulfillmentStage === "archived" ||
    args.fulfillmentStage === "preparing_print"
  );
}

import { describe, expect, it } from "vitest";

import {
  archivalHasStarted,
  mayStartArchival,
  videosEligibleForArchival,
} from "@/lib/archival/can-archive";
import type { FrozenBookRevision } from "@/types/video-memory";

const revision: FrozenBookRevision = {
  pages: [{ id: "p22", pageNumber: 22, kind: "photos" }],
  placements: [
    {
      id: "pl1",
      type: "video-memory",
      videoAssetId: "rocket",
      pageId: "p22",
      x: 0.6,
      y: 0.7,
      width: 0.2,
      height: 0.2,
    },
  ],
  processedVideos: [
    {
      videoAssetId: "rocket",
      processedPath: "drafts/a/videos/rocket/processed.mp4",
      processedBytes: 20_000_000,
      contentSha256: "hash",
      durationMs: 45_000,
      width: 1920,
      height: 1080,
    },
    {
      videoAssetId: "unused",
      processedPath: "drafts/a/videos/unused/processed.mp4",
      processedBytes: 20_000_000,
      contentSha256: "hash2",
      durationMs: 40_000,
      width: 1280,
      height: 720,
    },
  ],
};

describe("archival selection", () => {
  it("archives only unique placed videos from the frozen revision", () => {
    expect(videosEligibleForArchival(revision).map((video) => video.videoAssetId)).toEqual([
      "rocket",
    ]);
  });

  it("requires paid + consent before archival", () => {
    expect(
      mayStartArchival({
        orderStatus: "pending_payment",
        fulfillmentStage: "pending_archive",
        consentAt: "2026-01-01",
      }),
    ).toBe(false);
    expect(
      mayStartArchival({
        orderStatus: "paid",
        fulfillmentStage: "pending_archive",
        consentAt: "2026-01-01",
      }),
    ).toBe(true);
  });

  it("treats archival as irreversible once a tx exists", () => {
    expect(
      archivalHasStarted({ fulfillmentStage: "pending_archive", hasArweaveTx: false }),
    ).toBe(false);
    expect(
      archivalHasStarted({ fulfillmentStage: "archiving", hasArweaveTx: false }),
    ).toBe(true);
  });
});

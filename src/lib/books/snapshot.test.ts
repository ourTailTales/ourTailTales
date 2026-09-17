import { describe, expect, it } from "vitest";

import { createBookProjectSnapshot } from "@/lib/books/snapshot";

describe("createBookProjectSnapshot", () => {
  it("keeps book structure without photo files or browser URLs", () => {
    const snapshot = createBookProjectSnapshot({
      meta: {
        petName: "Milo",
        birthYear: "2018",
        deathYear: "",
        dedication: "For our best friend",
        coverPhotoId: "photo-1",
      },
      chapters: [
        {
          id: "chapter-1",
          index: 0,
          photoIds: ["photo-1"],
          candidateIds: ["photo-1"],
          startAt: 1,
          endAt: 2,
          title: "The beginning",
          dateLabel: "2018",
          blurb: "Milo came home.",
          places: [{ city: "Hanoi" }],
          heroPhotoId: "photo-1",
          aiStatus: "done",
        },
      ],
      pages: [
        {
          id: "page-1",
          kind: "photos",
          pageNumber: 1,
          layoutId: "full-bleed",
          photoIds: ["photo-1"],
          chapterId: "chapter-1",
          chapterIndex: 0,
        },
      ],
    });

    expect(snapshot.version).toBe(1);
    expect(snapshot.meta.petName).toBe("Milo");
    expect(JSON.stringify(snapshot)).not.toContain("blob:");
    expect(JSON.stringify(snapshot)).not.toContain("fileName");
    expect(JSON.stringify(snapshot)).not.toContain("lat");
    expect(JSON.stringify(snapshot)).not.toContain("lng");
  });
});

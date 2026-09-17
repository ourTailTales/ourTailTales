import type { BookMeta, BookPage, Chapter } from "@/types/book";

export type BookProjectSnapshot = {
  version: 1;
  meta: BookMeta;
  chapters: Chapter[];
  pages: BookPage[];
};

export function createBookProjectSnapshot(input: {
  meta: BookMeta;
  chapters: Chapter[];
  pages: BookPage[];
}): BookProjectSnapshot {
  return {
    version: 1,
    meta: structuredClone(input.meta),
    chapters: structuredClone(input.chapters),
    pages: structuredClone(input.pages),
  };
}

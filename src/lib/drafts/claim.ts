import { track } from "@/lib/analytics";
import { renderFullPreviewPdf } from "@/lib/book/sample-pdf";
import { saveBookProject } from "@/lib/books/cloud";
import { bankBook } from "@/lib/drafts/upload";
import { photoMapOf, useOurTailTalesStore } from "@/store/useOurTailTalesStore";

/**
 * Renders the whole book from this browser's own local copy and banks it as
 * the draft's clean file — the one step that turns "make a free account"
 * from a promise into something `checkout-digital` will actually sell.
 *
 * Only works on the device that made the book: photos are never uploaded
 * anywhere the server can read them until this call chooses to, so there is
 * nothing to render from anywhere else. Callers are expected to have already
 * confirmed `pages.length > 0` for the draft they mean to unlock.
 */
export async function renderAndBankFullBook(): Promise<{ bookUrl: string | null }> {
  const state = useOurTailTalesStore.getState();
  if (state.pages.length === 0) {
    throw new Error("This device does not have this book's photos.");
  }

  const pdf = await renderFullPreviewPdf({
    pages: state.pages,
    chapters: state.chapters,
    meta: state.meta,
    photos: photoMapOf(state.photos),
  });

  const banked = await bankBook({
    pdf,
    petName: state.meta.petName,
    chapterCount: state.chapterCount,
    kind: "full",
    email: state.leadEmail,
  });
  useOurTailTalesStore.getState().setBookUrl(banked.url);

  const saved = useOurTailTalesStore.getState();
  await saveBookProject({
    meta: saved.meta,
    chapters: saved.chapters,
    pages: saved.pages,
    photos: saved.photos,
  });
  track("free_book_saved", { chapters: saved.chapterCount });

  return { bookUrl: banked.url };
}

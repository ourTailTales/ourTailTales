import { track } from "@/lib/analytics";
import { renderCleanBookPdf } from "@/lib/book/sample-pdf";
import { saveBookProject } from "@/lib/books/cloud";
import { getLocalDraftId, persistLocalDraft } from "@/lib/drafts/local";
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
/**
 * Banks the clean whole book for a hardcover order, and nothing else.
 *
 * Run alongside a hardcover checkout, so the PDF that comes with the hardcover
 * exists on the server when the payment lands and is the same book that is
 * going to print. Needs no account, unlike `renderAndBankFullBook`.
 *
 * Banked as `order`, not `full`. A `full` bank also replaces what the draft's
 * public link shows with the whole watermarked book and restarts its expiry,
 * which handed the thing an account is asked for to anybody who pressed
 * checkout. This one writes the clean file only, so the link, its expiry and
 * the book URL remembered in this browser are all left as they were.
 */
export async function bankCleanBookForOrder(): Promise<{
  draftId: string;
  secret: string;
} | null> {
  const state = useOurTailTalesStore.getState();
  if (state.pages.length === 0) return null;

  const pdf = await renderCleanBookPdf({
    pages: state.pages,
    chapters: state.chapters,
    meta: state.meta,
    photos: photoMapOf(state.photos),
  });
  const banked = await bankBook({
    pdf,
    petName: state.meta.petName,
    chapterCount: state.chapterCount,
    kind: "order",
    email: state.leadEmail,
  });
  return { draftId: banked.draftId, secret: banked.secret };
}

export async function renderAndBankFullBook(): Promise<{ bookUrl: string | null }> {
  const state = useOurTailTalesStore.getState();
  if (state.pages.length === 0) {
    throw new Error("This device does not have this book's photos.");
  }

  // Rendering and banking take long enough for the customer to start over or
  // open another address. Whatever is in the store afterwards is then a
  // different book, or none, and saving that one and marking it kept is worse
  // than saving nothing. The book is named here and checked before each write.
  const draftId = state.localDraftId ?? getLocalDraftId();
  const leadEmail = state.leadEmail;
  const assertSameBook = (): void => {
    const now = useOurTailTalesStore.getState();
    const nowId = now.localDraftId ?? getLocalDraftId();
    const same =
      now.pages.length > 0 &&
      now.leadEmail === leadEmail &&
      // Before its first local save a book has no id, and gains one below.
      (draftId === null || nowId === draftId);
    if (!same) throw new Error("The book changed while it was being saved.");
  };

  const pdf = await renderCleanBookPdf({
    pages: state.pages,
    chapters: state.chapters,
    meta: state.meta,
    photos: photoMapOf(state.photos),
  });
  assertSameBook();

  const banked = await bankBook({
    pdf,
    petName: state.meta.petName,
    chapterCount: state.chapterCount,
    kind: "full",
    email: state.leadEmail,
  });
  assertSameBook();
  useOurTailTalesStore.getState().setBookUrl(banked.url);

  const saved = useOurTailTalesStore.getState();
  await saveBookProject({
    meta: saved.meta,
    chapters: saved.chapters,
    pages: saved.pages,
    photos: saved.photos,
  });
  track("free_book_saved", { chapters: saved.chapterCount });
  assertSameBook();

  // Remembered with the local book, so the editor does not render and bank
  // the whole thing again the next time it opens signed in.
  useOurTailTalesStore.getState().setClaimedAt(new Date().toISOString());
  await persistLocalDraft(useOurTailTalesStore.getState()).catch(() => undefined);

  return { bookUrl: banked.url };
}

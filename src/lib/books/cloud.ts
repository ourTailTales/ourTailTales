import * as assetStore from "@/lib/photo/assetStore";
import { createBookProjectSnapshot } from "@/lib/books/snapshot";
import { getLocalDraftId, getLocalPreviewPdf } from "@/lib/drafts/local";
import { createAuthBrowserClient } from "@/lib/supabase/auth-browser";
import type { OurTailTalesStore } from "@/store/useOurTailTalesStore";

type SaveableBook = Pick<
  OurTailTalesStore,
  "meta" | "chapters" | "pages" | "photos"
>;

export async function saveBookProject(state: SaveableBook): Promise<string> {
  const localDraftId = getLocalDraftId();
  const previewPdf = getLocalPreviewPdf();
  if (!localDraftId || !previewPdf) {
    throw new Error("Finish creating the free preview before saving your book.");
  }

  const supabase = createAuthBrowserClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) {
    throw new Error("Sign in to save and open your book.");
  }

  const userId = authData.user.id;
  const bookId = localDraftId;
  const basePath = `${userId}/${bookId}`;
  const previewPath = `${basePath}/preview.pdf`;

  const { error: previewError } = await supabase.storage
    .from("book-previews")
    .upload(previewPath, previewPdf, {
      upsert: true,
      contentType: "application/pdf",
      cacheControl: "3600",
    });
  if (previewError) throw previewError;

  const coverId =
    state.meta.coverPhotoId ?? state.chapters[0]?.heroPhotoId ?? null;
  const coverBlob = coverId ? assetStore.getThumbBlob(coverId) : undefined;
  let coverPath: string | null = null;
  if (coverBlob) {
    const extension = coverBlob.type === "image/webp" ? "webp" : "jpg";
    coverPath = `${basePath}/cover.${extension}`;
    const { error: coverError } = await supabase.storage
      .from("book-previews")
      .upload(coverPath, coverBlob, {
        upsert: true,
        contentType: coverBlob.type || "image/jpeg",
        cacheControl: "3600",
      });
    if (coverError) throw coverError;
  }

  const { error: projectError } = await supabase.from("book_projects").upsert(
    {
      id: bookId,
      user_id: userId,
      local_draft_id: localDraftId,
      pet_name: state.meta.petName.trim(),
      status: "ready",
      book_snapshot: createBookProjectSnapshot(state),
      preview_pdf_path: previewPath,
      cover_preview_path: coverPath,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );
  if (projectError) throw projectError;

  return bookId;
}

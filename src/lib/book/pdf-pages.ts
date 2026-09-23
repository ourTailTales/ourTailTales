import { PDFDocument } from "pdf-lib";

/**
 * How many pages are actually in these bytes.
 *
 * Used to check a claim the client made about a file it uploaded. The client
 * says which book it is banking, and one of the answers skips watermarking, so
 * that answer has to be checked against the file rather than believed.
 *
 * Returns null when the bytes are not a PDF we can read, which the caller
 * should treat as a failed upload rather than as a page count of zero.
 */
export async function pdfPageCount(bytes: Uint8Array): Promise<number | null> {
  try {
    const document = await PDFDocument.load(bytes, { updateMetadata: false });
    return document.getPageCount();
  } catch {
    return null;
  }
}

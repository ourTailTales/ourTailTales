import { coverPanelsPt, type CoverDimensionsPt, type CoverPanelRectPt } from "@/lib/book/coverGeometry";
import { customCoverKindFor } from "@/lib/book/customCover";

export type CustomCoverCrops = {
  /** Data URL of the front panel (front trim + bleed + wrap), cropped from the uploaded file. */
  frontUrl: string;
  /** Data URL of the back panel (wrap + back trim + bleed), cropped from the uploaded file. */
  backUrl: string;
};

/** Preview render resolution for a PDF page, in canvas px per PDF point — plenty sharp for an on-screen tab, far below print DPI (which would be ~4.17 px/pt at 300 DPI). */
const PDF_PREVIEW_PX_PER_PT = 2;

/**
 * Renders the customer's uploaded cover file (image or PDF, already
 * validated to `dimensions`) to an offscreen canvas and crops out the
 * front-panel and back-panel sub-images, using the exact same panel split
 * `renderCoverPdf` bleeds print art into (`coverPanelsPt`). Used so the
 * Front cover / Back cover tabs can preview what the customer's own file
 * actually contains, once they've uploaded one, instead of the in-app
 * design.
 *
 * Client-side only (canvas, Image, pdfjs-dist) — never called during SSR.
 */
export async function buildCustomCoverCrops(
  file: File,
  dimensions: CoverDimensionsPt,
): Promise<CustomCoverCrops> {
  const kind = customCoverKindFor(file);
  const canvas =
    kind === "pdf" ? await renderPdfPageToCanvas(file) : await renderImageToCanvas(file);

  // Both render paths are sized in direct proportion to `dimensions`, so a
  // single px-per-pt ratio (from width) is exact for both axes.
  const pxPerPt = canvas.width / dimensions.width;
  const panels = coverPanelsPt(dimensions);

  return {
    frontUrl: cropToDataUrl(canvas, panels.front, pxPerPt),
    backUrl: cropToDataUrl(canvas, panels.back, pxPerPt),
  };
}

/**
 * Every panel `coverPanelsPt` returns spans the full canvas height (y: 0),
 * so cropping is a plain horizontal slice — no vertical offset or flip
 * needed despite PDF's bottom-left origin.
 */
function cropToDataUrl(
  source: HTMLCanvasElement,
  panel: CoverPanelRectPt,
  pxPerPt: number,
): string {
  const sx = Math.round(panel.x * pxPerPt);
  const sw = Math.max(1, Math.round(panel.width * pxPerPt));
  const sh = source.height;

  const out = document.createElement("canvas");
  out.width = sw;
  out.height = sh;
  const ctx = out.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable.");
  ctx.drawImage(source, sx, 0, sw, sh, 0, 0, sw, sh);
  return out.toDataURL("image/png");
}

function renderImageToCanvas(file: File): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      URL.revokeObjectURL(url);
      if (!ctx) {
        reject(new Error("Canvas 2D context unavailable."));
        return;
      }
      ctx.drawImage(img, 0, 0);
      resolve(canvas);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read that image."));
    };
    img.src = url;
  });
}

async function renderPdfPageToCanvas(file: File): Promise<HTMLCanvasElement> {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  const data = await file.arrayBuffer();
  // `getDocument` returns a loading task, not the document itself — only the
  // task has `destroy()`; the resolved `PDFDocumentProxy` does not.
  const loadingTask = pdfjsLib.getDocument({ data });
  try {
    const doc = await loadingTask.promise;
    const page = await doc.getPage(1);
    const viewport = page.getViewport({ scale: PDF_PREVIEW_PX_PER_PT });

    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context unavailable.");

    await page.render({ canvas, viewport }).promise;
    return canvas;
  } finally {
    await loadingTask.destroy();
  }
}

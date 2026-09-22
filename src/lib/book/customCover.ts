import { PDFDocument } from "pdf-lib";

import type { CoverDimensionsPt } from "@/lib/book/cover-pdf";

const PT_PER_INCH = 72;

/** A PDF's page box is exact; only round-trip rounding should ever separate it from the target. */
const PDF_TOLERANCE_PT = 3;

/** A flat image's pixel size is compared against the target at the print resolution, with a little slack for export rounding. */
const IMAGE_TOLERANCE_FRACTION = 0.015;

export type CustomCoverKind = "pdf" | "image";

export type CustomCoverValidation =
  | { ok: true; kind: CustomCoverKind; widthPt: number; heightPt: number }
  | { ok: false; message: string };

export function customCoverKindFor(file: File): CustomCoverKind | null {
  const name = file.name.toLowerCase();
  if (file.type === "application/pdf" || name.endsWith(".pdf")) return "pdf";
  if (
    file.type === "image/png" ||
    file.type === "image/jpeg" ||
    /\.(png|jpe?g)$/.test(name)
  ) {
    return "image";
  }
  return null;
}

/**
 * Checks an uploaded file against Lulu's exact required cover size for this
 * book. Rejects outright rather than auto-scaling — a mismatched cover would
 * either leave white space or crop into the spine/back, and neither should
 * happen silently.
 */
export async function validateCustomCoverFile(
  file: File,
  target: CoverDimensionsPt,
  targetPpi = 300,
): Promise<CustomCoverValidation> {
  const kind = customCoverKindFor(file);
  if (!kind) {
    return { ok: false, message: "Upload a PNG, JPG, or PDF file." };
  }

  if (kind === "pdf") {
    let pdf;
    try {
      pdf = await PDFDocument.load(await file.arrayBuffer());
    } catch {
      return {
        ok: false,
        message: "That PDF could not be read — try re-exporting it and upload again.",
      };
    }
    if (pdf.getPageCount() < 1) {
      return { ok: false, message: "That PDF has no pages." };
    }
    const { width, height } = pdf.getPage(0).getSize();
    if (
      Math.abs(width - target.width) > PDF_TOLERANCE_PT ||
      Math.abs(height - target.height) > PDF_TOLERANCE_PT
    ) {
      return {
        ok: false,
        message: `That PDF is ${inches(width)}″ × ${inches(height)}″ this book needs exactly ${inches(target.width)}″ × ${inches(target.height)}″ (one flat page: front, spine, and back).`,
      };
    }
    return { ok: true, kind, widthPt: width, heightPt: height };
  }

  const targetWidthPx = Math.round((target.width / PT_PER_INCH) * targetPpi);
  const targetHeightPx = Math.round((target.height / PT_PER_INCH) * targetPpi);
  const size = await imagePixelSize(file);
  if (!size) {
    return { ok: false, message: "That image could not be read." };
  }
  const widthOk =
    Math.abs(size.width - targetWidthPx) <= targetWidthPx * IMAGE_TOLERANCE_FRACTION;
  const heightOk =
    Math.abs(size.height - targetHeightPx) <= targetHeightPx * IMAGE_TOLERANCE_FRACTION;
  if (!widthOk || !heightOk) {
    return {
      ok: false,
      message: `That image is ${size.width}×${size.height}px — at ${targetPpi} DPI this book needs ${targetWidthPx}×${targetHeightPx}px (${inches(target.width)}″ × ${inches(target.height)}″).`,
    };
  }
  return { ok: true, kind, widthPt: target.width, heightPt: target.height };
}

function inches(pt: number): string {
  return (pt / PT_PER_INCH).toFixed(2);
}

function imagePixelSize(file: File): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      resolve(null);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });
}

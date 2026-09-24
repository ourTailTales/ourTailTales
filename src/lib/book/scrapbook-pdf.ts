import {
  concatTransformationMatrix,
  popGraphicsState,
  pushGraphicsState,
  rgb,
  type PDFFont,
  type PDFImage,
  type PDFPage,
} from "pdf-lib";

import {
  DOODLE_PATHS,
  DOODLE_STROKE,
  TAPE_OUTLINE,
  photoWindow,
  type Box,
  type Doodle,
  type Print,
  type Scrap,
  type Tape,
} from "@/lib/book/scrapbook";
import { drawable } from "@/lib/book/pdf-fonts";
import { brand, hexToRgb01 } from "@/lib/brand";

/**
 * Draws a `PageDesign`'s pieces into a pdf-lib page.
 *
 * Every piece is drawn in its own frame: the origin moved to the piece's
 * centre and the axes turned by its tilt, so the piece itself is always drawn
 * level around (0, 0). pdf-lib's own `rotate` options pivot on a corner, which
 * would make every tilt drift; a transform around the centre is the same
 * rotation CSS applies on screen.
 */

export function hex(color: string) {
  const { r, g, b } = hexToRgb01(color);
  return rgb(r, g, b);
}

const INK = hex(brand.colors.ink);
const WHITE = hex(brand.colors.white);
const PLACEHOLDER = hex(brand.colors.memoryBlue);

type Frame = { page: PDFPage; pagePt: number };

/** Runs `draw` with the origin at a box's centre and the axes turned by `rotation`. */
export function inFrame(
  frame: Frame,
  box: Pick<Box, "cx" | "cy">,
  rotation: number,
  draw: () => void,
): void {
  const { page, pagePt } = frame;
  // Clockwise on the page is negative in PDF space, where y runs up.
  const radians = (-rotation * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  page.pushOperators(
    pushGraphicsState(),
    concatTransformationMatrix(cos, sin, -sin, cos, box.cx * pagePt, pagePt - box.cy * pagePt),
  );
  try {
    draw();
  } finally {
    page.pushOperators(popGraphicsState());
  }
}

export function drawScrap(frame: Frame, scrap: Scrap): void {
  const w = scrap.w * frame.pagePt;
  const h = scrap.h * frame.pagePt;
  inFrame(frame, scrap, scrap.rotation, () => {
    frame.page.drawRectangle({
      x: -w / 2,
      y: -h / 2,
      width: w,
      height: h,
      color: hex(scrap.color),
      opacity: scrap.opacity,
    });
  });
}

/** A plain white card, with a soft shadow, e.g. behind a dedication. */
export function drawCard(frame: Frame, box: Box, rotation = 0): void {
  const w = box.w * frame.pagePt;
  const h = box.h * frame.pagePt;
  inFrame(frame, box, rotation, () => {
    drawShadow(frame.page, w, h);
    frame.page.drawRectangle({ x: -w / 2, y: -h / 2, width: w, height: h, color: WHITE });
  });
}

/**
 * PDF has no blur, so the shadow is two offset, very faint layers: enough to
 * lift a print off the page without a hard grey edge.
 */
function drawShadow(page: PDFPage, w: number, h: number): void {
  page.drawRectangle({ x: -w / 2 + 1.6, y: -h / 2 - 3, width: w + 1, height: h + 1, color: INK, opacity: 0.05 });
  page.drawRectangle({ x: -w / 2 + 0.8, y: -h / 2 - 1.6, width: w, height: h, color: INK, opacity: 0.09 });
}

/**
 * One print: shadow, white border, the photo (or a placeholder field), and
 * the handwritten caption on a polaroid's deep bottom edge. Tape is drawn
 * separately, after every print, so a strip can lie across a neighbour.
 */
export function drawPrint(
  frame: Frame,
  print: Print,
  args: { image: PDFImage | null; handFont: PDFFont },
): void {
  const pagePt = frame.pagePt;
  const w = print.w * pagePt;
  const h = print.h * pagePt;
  const window = photoWindow(print);
  const windowPt = {
    x: -w / 2 + window.x * pagePt,
    // The window is measured from the top; PDF y runs up from the bottom.
    y: h / 2 - (window.y + window.h) * pagePt,
    width: window.w * pagePt,
    height: window.h * pagePt,
  };

  inFrame(frame, print, print.rotation, () => {
    drawShadow(frame.page, w, h);
    frame.page.drawRectangle({ x: -w / 2, y: -h / 2, width: w, height: h, color: WHITE });

    if (args.image) {
      frame.page.drawImage(args.image, windowPt);
    } else {
      frame.page.drawRectangle({ ...windowPt, color: PLACEHOLDER, opacity: 0.6 });
    }

    if (print.caption) {
      const bottomPt = print.bottom * pagePt;
      const size = Math.min(bottomPt * 0.52, 20);
      const text = drawable(args.handFont, print.caption);
      const width = args.handFont.widthOfTextAtSize(text, size);
      frame.page.drawText(text, {
        x: -width / 2,
        y: -h / 2 + bottomPt * 0.34,
        size,
        font: args.handFont,
        color: INK,
        opacity: 0.8,
      });
    }
  });
}

export function drawTape(frame: Frame, tape: Tape): void {
  const w = tape.w * frame.pagePt;
  const h = tape.h * frame.pagePt;
  const path =
    TAPE_OUTLINE.map(
      ([x, y], index) => `${index === 0 ? "M" : "L"}${(x * w).toFixed(2)} ${(y * h).toFixed(2)}`,
    ).join(" ") + " Z";
  inFrame(frame, tape, tape.rotation, () => {
    // drawSvgPath's origin is the path's top-left corner, with y running down.
    frame.page.drawSvgPath(path, {
      x: -w / 2,
      y: h / 2,
      color: hex(tape.color),
      opacity: tape.opacity,
    });
  });
}

export function drawDoodle(frame: Frame, doodle: Doodle): void {
  const size = doodle.size * frame.pagePt;
  const scale = size / 24;
  const { d, fill } = DOODLE_PATHS[doodle.kind];
  const color = hex(doodle.color);
  inFrame(frame, doodle, doodle.rotation, () => {
    frame.page.drawSvgPath(d, {
      x: -size / 2,
      y: size / 2,
      scale,
      ...(fill
        ? { color, opacity: 0.85 }
        : {
            borderColor: color,
            // The stroke is scaled along with the path.
            borderWidth: DOODLE_STROKE,
            borderLineCap: 1,
            borderOpacity: 0.9,
          }),
    });
  });
}

/** A round sticker with a number on it, e.g. the chapter number. */
export function drawSticker(
  frame: Frame,
  sticker: { cx: number; cy: number; r: number },
  args: { text: string; font: PDFFont; color: string },
): void {
  const r = sticker.r * frame.pagePt;
  inFrame(frame, sticker, -6, () => {
    frame.page.drawCircle({ x: 0.8, y: -1.4, size: r, color: INK, opacity: 0.1 });
    frame.page.drawCircle({ x: 0, y: 0, size: r, color: hex(args.color) });
    frame.page.drawCircle({
      x: 0,
      y: 0,
      size: r * 0.86,
      borderColor: WHITE,
      borderWidth: 0.8,
      borderDashArray: [2, 2],
      borderOpacity: 0.7,
    });
    const text = drawable(args.font, args.text);
    const size = r * 1.05;
    const width = args.font.widthOfTextAtSize(text, size);
    frame.page.drawText(text, {
      x: -width / 2,
      y: -size * 0.34,
      size,
      font: args.font,
      color: WHITE,
    });
  });
}

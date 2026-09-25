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
  DEFAULT_CAPTION_COLOR,
  DOODLE_PATHS,
  DOODLE_STROKE,
  TAPE_OUTLINE,
  cornerTriangles,
  photoWindow,
  type Box,
  type Doodle,
  type FontRole,
  type PageDesign,
  type Print,
  type Shape,
  type Tape,
  type TextBlock,
} from "@/lib/book/design/primitives";
import { layoutTextBlock } from "@/lib/book/design/text";
import { drawable, type BookFonts } from "@/lib/book/pdf-fonts";
import { brand, hexToRgb01 } from "@/lib/brand";

/**
 * Draws a `PageDesign` into a pdf-lib page — any design's, since a design is
 * only ever these primitives.
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
const PLACEHOLDER = hex(brand.colors.memoryBlue);

export type Frame = { page: PDFPage; pagePt: number };

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

export function fontFor(fonts: BookFonts, role: FontRole): PDFFont {
  switch (role) {
    case "display":
      return fonts.playfair;
    case "displayBold":
      return fonts.playfairBold;
    default:
      return fonts[role];
  }
}

/**
 * Draws a whole page: paper, what lies under the photos, the photos, their
 * tape and corners, what lies over them, doodles, then the words.
 * `imageFor` supplies each print's embedded photo, one at a time.
 */
export async function drawDesign(
  frame: Frame,
  design: PageDesign,
  args: { fonts: BookFonts; imageFor: (print: Print) => Promise<PDFImage | null> },
): Promise<void> {
  const { page, pagePt } = frame;
  page.drawRectangle({ x: 0, y: 0, width: pagePt, height: pagePt, color: hex(design.paper) });

  for (const shape of design.under) drawShape(frame, shape);
  for (const print of design.prints) {
    drawPrint(frame, print, { image: await args.imageFor(print), fonts: args.fonts });
  }
  // After every print, so a strip of tape can lie across a neighbour.
  for (const print of design.prints) {
    for (const tape of print.tapes) drawTape(frame, tape);
    drawCorners(frame, print);
  }
  for (const shape of design.over) drawShape(frame, shape);
  for (const doodle of design.doodles) drawDoodle(frame, doodle);
  for (const block of design.texts) drawTextBlock(frame, block, args.fonts);
}

/**
 * PDF has no blur, so the shadow is two offset, very faint layers: enough to
 * lift a print off the page without a hard grey edge.
 */
function drawShadow(page: PDFPage, w: number, h: number): void {
  page.drawRectangle({ x: -w / 2 + 1.6, y: -h / 2 - 3, width: w + 1, height: h + 1, color: INK, opacity: 0.05 });
  page.drawRectangle({ x: -w / 2 + 0.8, y: -h / 2 - 1.6, width: w, height: h, color: INK, opacity: 0.09 });
}

export function drawShape(frame: Frame, shape: Shape): void {
  const { page, pagePt } = frame;
  switch (shape.kind) {
    case "rect": {
      const w = shape.w * pagePt;
      const h = shape.h * pagePt;
      inFrame(frame, shape, shape.rotation, () => {
        if (shape.shadow) drawShadow(page, w, h);
        page.drawRectangle({
          x: -w / 2,
          y: -h / 2,
          width: w,
          height: h,
          ...(shape.fill ? { color: hex(shape.fill), opacity: shape.opacity ?? 1 } : {}),
          ...(shape.stroke
            ? {
                borderColor: hex(shape.stroke.color),
                borderWidth: shape.stroke.width,
                borderOpacity: shape.stroke.opacity ?? 1,
              }
            : {}),
        });
      });
      return;
    }
    case "circle": {
      const r = shape.r * pagePt;
      const x = shape.cx * pagePt;
      const y = pagePt - shape.cy * pagePt;
      if (shape.shadow) page.drawCircle({ x: x + 0.8, y: y - 1.4, size: r, color: INK, opacity: 0.1 });
      page.drawCircle({
        x,
        y,
        size: r,
        ...(shape.fill ? { color: hex(shape.fill), opacity: shape.opacity ?? 1 } : {}),
        ...(shape.stroke
          ? {
              borderColor: hex(shape.stroke.color),
              borderWidth: shape.stroke.width,
              borderOpacity: shape.stroke.opacity ?? 1,
              ...(shape.stroke.dash ? { borderDashArray: [shape.stroke.dash, shape.stroke.dash] } : {}),
            }
          : {}),
      });
      return;
    }
    case "line":
      page.drawLine({
        start: { x: shape.x1 * pagePt, y: pagePt - shape.y1 * pagePt },
        end: { x: shape.x2 * pagePt, y: pagePt - shape.y2 * pagePt },
        thickness: shape.width,
        color: hex(shape.color),
        opacity: shape.opacity ?? 1,
      });
      return;
    case "tape":
      drawTape(frame, shape);
      return;
  }
}

/**
 * One print: shadow, border, the photo (or a placeholder field), a keyline,
 * and the caption on a deep bottom border. Tape and corners are drawn
 * separately, after every print.
 */
export function drawPrint(
  frame: Frame,
  print: Print,
  args: { image: PDFImage | null; fonts: BookFonts },
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
    if (print.shadow) drawShadow(frame.page, w, h);
    if (print.side > 0 || print.bottom > 0) {
      frame.page.drawRectangle({ x: -w / 2, y: -h / 2, width: w, height: h, color: hex(print.border) });
    }

    if (args.image) {
      frame.page.drawImage(args.image, windowPt);
    } else {
      frame.page.drawRectangle({ ...windowPt, color: PLACEHOLDER, opacity: 0.6 });
    }

    if (print.keyline) {
      frame.page.drawRectangle({
        ...windowPt,
        borderColor: hex(print.keyline.color),
        borderWidth: print.keyline.width,
        borderOpacity: print.keyline.opacity,
      });
    }

    if (print.caption) {
      const font = fontFor(args.fonts, print.captionFont ?? "hand");
      const bottomPt = print.bottom * pagePt;
      const size = Math.min(bottomPt * 0.52, 20);
      const text = drawable(font, print.caption);
      const width = font.widthOfTextAtSize(text, size);
      frame.page.drawText(text, {
        x: -width / 2,
        y: -h / 2 + bottomPt * 0.34,
        size,
        font,
        color: hex(print.captionColor ?? DEFAULT_CAPTION_COLOR),
        opacity: 0.8,
      });
    }
  });
}

function drawCorners(frame: Frame, print: Print): void {
  if (!print.corners) return;
  const pagePt = frame.pagePt;
  const w = print.w * pagePt;
  const h = print.h * pagePt;
  const color = hex(print.corners.color);
  inFrame(frame, print, print.rotation, () => {
    for (const triangle of cornerTriangles(print)) {
      const path =
        triangle
          .map(([x, y], index) => `${index === 0 ? "M" : "L"}${(x * pagePt).toFixed(2)} ${(y * pagePt).toFixed(2)}`)
          .join(" ") + " Z";
      // drawSvgPath's origin is the path's top-left corner, with y running down.
      frame.page.drawSvgPath(path, { x: -w / 2, y: h / 2, color, opacity: print.corners!.opacity });
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
  const { d, fill: filledByDefault } = DOODLE_PATHS[doodle.kind];
  const filled = doodle.fill ?? filledByDefault;
  const color = hex(doodle.color);
  inFrame(frame, doodle, doodle.rotation, () => {
    frame.page.drawSvgPath(d, {
      x: -size / 2,
      y: size / 2,
      scale,
      ...(filled ? { color, opacity: doodle.outline ? 1 : 0.85 } : {}),
      // A sticker keeps its cut edge; a pen drawing is only the line.
      ...(doodle.outline
        ? { borderColor: hex(doodle.outline), borderWidth: DOODLE_STROKE * 1.6, borderLineCap: 1 }
        : filled
          ? {}
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

/**
 * Draws the lines `layoutTextBlock` laid out. Line breaks and baselines come
 * from the shared layout; only the horizontal placement inside each line uses
 * the embedded font's own widths, so centred text is centred exactly.
 */
export function drawTextBlock(frame: Frame, block: TextBlock, fonts: BookFonts): void {
  const laid = layoutTextBlock(block);
  if (laid.lines.length === 0) return;
  const { page, pagePt } = frame;
  const centre = { cx: (laid.left + laid.width / 2) / pagePt, cy: (laid.top + laid.height / 2) / pagePt };
  // Block-relative points (y down from the block's top) → the centred frame.
  const fx = (x: number): number => x - laid.width / 2;
  const fy = (y: number): number => laid.height / 2 - y;

  inFrame(frame, centre, laid.rotation, () => {
    for (const rule of laid.rules) {
      page.drawLine({
        start: { x: fx(rule.x1), y: fy(rule.y) },
        end: { x: fx(rule.x2), y: fy(rule.y) },
        thickness: 0.5,
        color: hex(rule.color),
        opacity: rule.opacity,
      });
    }

    for (const pill of laid.pills) {
      const r = pill.h / 2;
      const straight = Math.max(0, pill.w - pill.h);
      page.drawSvgPath(
        `M${r} 0 L${r + straight} 0 A${r} ${r} 0 0 1 ${r + straight} ${pill.h} L${r} ${pill.h} A${r} ${r} 0 0 1 ${r} 0 Z`,
        {
          x: fx(pill.cx - pill.w / 2),
          y: fy(pill.cy - pill.h / 2),
          borderColor: hex(pill.color),
          borderWidth: 1,
          borderOpacity: pill.opacity,
        },
      );
    }

    for (const line of laid.lines) {
      const font = fontFor(fonts, line.font);
      const text = drawable(font, line.text);
      if (!text) continue;
      const characters = [...text];
      const width = font.widthOfTextAtSize(text, line.size) + line.tracking * Math.max(0, characters.length - 1);
      const x =
        line.align === "center"
          ? line.left + (line.width - width) / 2
          : line.align === "right"
            ? line.left + line.width - width
            : line.left;
      const options = { font, size: line.size, color: hex(line.color), opacity: line.opacity };
      if (line.tracking) {
        // pdf-lib has no letter-spacing, so tracked text is set glyph by glyph.
        let cursor = x;
        for (const character of characters) {
          page.drawText(character, { ...options, x: fx(cursor), y: fy(line.baseline) });
          cursor += font.widthOfTextAtSize(character, line.size) + line.tracking;
        }
      } else {
        page.drawText(text, { ...options, x: fx(x), y: fy(line.baseline) });
      }
    }
  });
}

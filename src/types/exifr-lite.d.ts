/**
 * The bare `"exifr"` specifier resolves to the package's "full" bundle,
 * which is built with Node in mind: on load it tries `require("fs")` and
 * `require("zlib")` for its Node-only file and gzip readers, catches the
 * failure, and logs `Couldn't load fs` / `Couldn't load zlib` to the
 * console every time that happens somewhere that isn't actually Node —
 * which in this app is always, since `readExif` only ever runs in the
 * browser on a `File` the customer picked.
 *
 * `exifr/dist/lite.esm.js` is the browser-built bundle: same TIFF/EXIF/GPS
 * parsing this app reads (`readExif` uses none of what only "full" adds —
 * IPTC/ICC, non-JPEG formats, Node's own http(s) and gzip fallbacks), none
 * of the Node probing. It just isn't a path the package's own `index.d.ts`
 * covers, since that file is wired up for the bare `"exifr"` specifier
 * only — so this borrows its types, which the lite bundle satisfies
 * exactly for everything `readExif` calls.
 */
declare module "exifr/dist/lite.esm.js" {
  export { default } from "exifr";
}

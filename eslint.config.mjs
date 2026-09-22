import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Vendored pdfjs-dist worker build, copied into public/ as a static
    // asset for client-side PDF rendering (see lib/book/customCoverPreview.ts)
    // — minified third-party code, not ours to lint.
    "public/pdf.worker.min.mjs",
  ]),
]);

export default eslintConfig;

"use client";

import { useEffect } from "react";

/**
 * Last resort: the root layout itself failed, so there is no shell, no fonts
 * and no Tailwind to rely on. Everything here is inline and self-contained.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[ourTailTales] Root layout error", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#FAF7F2",
          fontFamily: "Helvetica, Arial, sans-serif",
          color: "#252A3A",
          padding: "24px",
        }}
      >
        <div style={{ maxWidth: "26rem", textAlign: "center" }}>
          <p
            style={{
              margin: 0,
              fontFamily: "Georgia, 'Times New Roman', serif",
              fontWeight: 700,
              color: "#5B68C8",
            }}
          >
            ourTailTales
          </p>
          <h1
            style={{
              margin: "12px 0 0 0",
              fontFamily: "Georgia, 'Times New Roman', serif",
              fontSize: "26px",
            }}
          >
            Something went wrong on our side
          </h1>
          <p style={{ margin: "12px 0 24px 0", fontSize: "15px", lineHeight: 1.6, color: "#5A6070" }}>
            Not your fault. Your photos stay on your own device, so nothing you
            were working on has been lost.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              border: 0,
              borderRadius: "12px",
              backgroundColor: "#5B68C8",
              color: "#FFFFFF",
              padding: "14px 26px",
              fontSize: "15px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}

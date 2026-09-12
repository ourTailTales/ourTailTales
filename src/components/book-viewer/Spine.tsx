"use client";

export function Spine({ openProgress }: { openProgress: number }) {
  const opacity = Math.max(0, Math.min(1, openProgress)) * 0.9;
  return (
    <div aria-hidden className="bv-spine" style={{ opacity }}>
      <div className="bv-spine__left" />
      <div className="bv-spine__right" />
    </div>
  );
}

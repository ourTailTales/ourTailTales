"use client";

export function Spine({
  openProgress,
  gapFill = false,
  hingeLeft,
  height,
}: {
  openProgress: number;
  /** Hero: 3D spine block at the hinge while the cover board is the left leaf. */
  gapFill?: boolean;
  hingeLeft: number;
  height: number;
}) {
  const bindingOpacity = Math.max(0, Math.min(1, openProgress)) * 0.9;

  return (
    <>
      {gapFill ? (
        <div
          aria-hidden
          className="bv-spine-prism"
          style={{ left: hingeLeft, height }}
        >
          <div className="bv-spine-prism__face bv-spine-prism__face--front" />
          <div className="bv-spine-prism__face bv-spine-prism__face--back" />
          <div className="bv-spine-prism__face bv-spine-prism__face--left" />
          <div className="bv-spine-prism__face bv-spine-prism__face--right" />
        </div>
      ) : null}
      <div
        aria-hidden
        className="bv-spine"
        style={{ left: hingeLeft, height, opacity: bindingOpacity }}
      >
        <div className="bv-spine__core" />
        <div className="bv-spine__left" />
        <div className="bv-spine__right" />
      </div>
    </>
  );
}

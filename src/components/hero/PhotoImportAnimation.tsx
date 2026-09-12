"use client";

import { AnimatePresence, motion } from "motion/react";
import { useMemo } from "react";

type Flyer = {
  id: string;
  src: string;
  startX: number;
  startY: number;
  rotation: number;
  delay: number;
};

const DESKTOP_CAP = 18;
const MOBILE_CAP = 10;

/**
 * Samples a small set of processed thumbnails and flies them into the open book.
 * Never mounts one node per album photo.
 */
export function PhotoImportAnimation({
  thumbUrls,
  active,
  reducedMotion,
  isMobile,
}: {
  thumbUrls: string[];
  active: boolean;
  reducedMotion: boolean;
  isMobile: boolean;
}) {
  const cap = isMobile ? MOBILE_CAP : DESKTOP_CAP;

  const flyers = useMemo(() => {
    if (!active || reducedMotion || thumbUrls.length === 0) return [] as Flyer[];

    const step = Math.max(1, Math.floor(thumbUrls.length / cap));
    const picked: Flyer[] = [];

    for (let i = 0; i < thumbUrls.length && picked.length < cap; i += step) {
      const src = thumbUrls[i];
      if (!src) continue;
      const index = picked.length;
      const side = index % 2 === 0 ? -1 : 1;
      picked.push({
        id: `${src}-${index}`,
        src,
        startX: side * (48 + (index % 5) * 14),
        startY: -42 - (index % 6) * 10,
        rotation: side * (8 + (index % 4) * 3),
        delay: index * 0.12,
      });
    }

    return picked;
  }, [active, reducedMotion, thumbUrls, cap]);

  if (flyers.length === 0) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-30 overflow-visible"
    >
      <AnimatePresence>
        {flyers.map((flyer) => (
          <motion.div
            key={flyer.id}
            className="absolute left-1/2 top-1/2 h-14 w-11 overflow-hidden rounded-sm bg-white shadow-lift ring-1 ring-ink/10 sm:h-16 sm:w-12"
            initial={{
              x: `${flyer.startX}%`,
              y: `${flyer.startY}%`,
              rotate: flyer.rotation,
              scale: 1,
              opacity: 0,
            }}
            animate={{
              x: `${(flyer.startX > 0 ? 8 : -18) + flyer.rotation * 0.2}%`,
              y: `${6 + Math.abs(flyer.rotation) * 0.15}%`,
              rotate: flyer.rotation * 0.2,
              scale: 0.35,
              opacity: [0, 1, 1, 0],
            }}
            exit={{ opacity: 0, scale: 0.2 }}
            transition={{
              duration: 1.35,
              delay: flyer.delay,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- local object URL */}
            <img
              src={flyer.src}
              alt=""
              className="h-full w-full object-cover"
              draggable={false}
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

import {
  BookOpen,
  File,
  FolderUp,
  Heart,
  Package,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { EDITOR_STEP_LABELS } from "@/components/editor/steps";

const HARDCOVER_GOLD = "#F0D15A";

const TEN_POINT_STAR =
  "50,0 61.74,13.86 79.39,9.55 80.74,27.66 97.55,34.55 88,50 97.55,65.45 80.74,72.34 79.39,90.45 61.74,86.14 50,100 38.26,86.14 20.61,90.45 19.26,72.34 2.45,65.45 12,50 2.45,34.55 19.26,27.66 20.61,9.55 38.26,13.86";

const steps: {
  Icon: LucideIcon;
  chip: string;
  shape: "circle" | "star";
}[] = [
  {
    Icon: FolderUp,
    chip: "border-memory-blue bg-memory-blue",
    shape: "circle",
  },
  {
    Icon: Heart,
    chip: "border-lavender bg-lavender",
    shape: "circle",
  },
  {
    Icon: BookOpen,
    chip: "border-sage bg-sage",
    shape: "circle",
  },
  {
    Icon: File,
    chip: "border-petal bg-petal",
    shape: "circle",
  },
  {
    Icon: Package,
    chip: "",
    shape: "star",
  },
];

/** Icon centers in a 400×120 viewBox — shallow Y stagger, straight connectors. */
const NODES = [
  { x: 40, y: 48 },
  { x: 120, y: 74 },
  { x: 200, y: 48 },
  { x: 280, y: 74 },
  { x: 360, y: 48 },
] as const;

function StepGlyph({
  Icon,
  shape,
  chip,
  active,
}: {
  Icon: LucideIcon;
  shape: "circle" | "star";
  chip: string;
  active: boolean;
}) {
  const icon = (
    <Icon
      aria-hidden
      className="relative z-10 size-3.5 text-page-ink sm:size-5"
      strokeWidth={1.5}
    />
  );

  if (shape === "star") {
    return (
      <span
        className={`relative flex size-7 items-center justify-center sm:size-11 ${
          active ? "scale-110" : ""
        }`}
      >
        <svg
          aria-hidden
          viewBox="0 0 100 100"
          className="absolute inset-0 h-full w-full overflow-visible"
        >
          <polygon points={TEN_POINT_STAR} fill={HARDCOVER_GOLD} />
        </svg>
        {icon}
      </span>
    );
  }

  return (
    <span
      className={`flex size-7 items-center justify-center rounded-full border sm:size-11 ${chip} ${
        active ? "ring-2 ring-periwinkle ring-offset-1 ring-offset-editor-field" : ""
      }`}
    >
      {icon}
    </span>
  );
}

export function EditorProgressTimeline({
  activeIndex = 0,
  farthestIndex = 0,
  onSelect,
}: {
  activeIndex?: number;
  farthestIndex?: number;
  onSelect?: (index: number) => void;
}) {
  return (
    <ol
      role="list"
      className="relative mx-auto h-24 w-full max-w-md list-none overflow-visible p-0 sm:h-32 sm:max-w-none"
    >
      <svg
        aria-hidden
        viewBox="0 0 400 120"
        className="pointer-events-none absolute inset-0 h-full w-full overflow-visible text-page-ink-faint"
        preserveAspectRatio="none"
      >
        <polyline
          points={NODES.map((node) => `${node.x},${node.y}`).join(" ")}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.25"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="1.4 7"
          opacity="0.55"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {steps.map((step, index) => {
        const node = NODES[index];
        const labelAbove = index % 2 === 0;
        const label = EDITOR_STEP_LABELS[index];
        const active = index === activeIndex;
        const reachable = index <= farthestIndex;
          const labelClass =
            "absolute w-[4.25rem] text-center text-[0.55rem] font-medium leading-tight text-page-ink sm:w-28 sm:text-xs";

        return (
          <li
            key={label}
            className={`absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center overflow-visible ${
              reachable ? "" : "opacity-40"
            }`}
            style={{
              left: `${(node.x / 400) * 100}%`,
              top: `${(node.y / 120) * 100}%`,
            }}
          >
            {labelAbove ? (
              <p className={`${labelClass} bottom-[calc(100%+0.25rem)] sm:bottom-[calc(100%+0.4rem)]`}>
                {label}
              </p>
            ) : null}
            {onSelect ? (
              <button
                type="button"
                disabled={!reachable}
                aria-current={active ? "step" : undefined}
                aria-label={label}
                onClick={() => onSelect(index)}
                className="rounded-full disabled:cursor-not-allowed"
              >
                <StepGlyph
                  Icon={step.Icon}
                  shape={step.shape}
                  chip={step.chip}
                  active={active}
                />
              </button>
            ) : (
              <StepGlyph
                Icon={step.Icon}
                shape={step.shape}
                chip={step.chip}
                active={active}
              />
            )}
            {!labelAbove ? (
              <p className={`${labelClass} top-[calc(100%+0.25rem)] sm:top-[calc(100%+0.4rem)]`}>
                {label}
              </p>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

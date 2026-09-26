"use client";

import { useId } from "react";

/** A question that has to be answered before something is bought or destroyed. */
export function ConfirmDialog({
  title,
  body,
  confirm,
  danger,
  onCancel,
  onConfirm,
}: {
  title: string;
  body: string;
  confirm: string;
  danger?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const titleId = useId();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-5">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lift"
      >
        <h3 id={titleId} className="font-display text-xl text-ink">
          {title}
        </h3>
        <p className="mt-3 text-sm leading-6 text-ink-soft">{body}</p>
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="text-sm font-medium text-periwinkle underline decoration-line underline-offset-4 hover:text-periwinkle-deep"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={
              danger
                ? "rounded-xl bg-periwinkle-deep px-4 py-2 text-sm font-semibold text-white"
                : "rounded-xl bg-periwinkle px-4 py-2 text-sm font-semibold text-white"
            }
          >
            {confirm}
          </button>
        </div>
      </div>
    </div>
  );
}

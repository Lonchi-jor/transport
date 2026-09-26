"use client";

import { useState } from "react";
import { createPortal } from "react-dom";

export default function DispatchNote({
  notes,
  tone = "light",
}: {
  notes?: string | null;
  tone?: "light" | "dark";
}) {
  const text = notes?.trim();
  if (!text) return null;
  const dark = tone === "dark";
  return (
    <div
      className={
        dark
          ? "rounded-xl border border-[#00a4e8]/45 bg-[#00a4e8]/15 px-3 py-2"
          : "rounded-xl border border-[#00a4e8]/35 bg-[#e7f6fd] px-3 py-2"
      }
    >
      <div
        className={
          dark
            ? "text-[10px] font-semibold uppercase tracking-wide text-[#7dd8f7]"
            : "text-[10px] font-semibold uppercase tracking-wide text-[#00a4e8]"
        }
      >
        Note du dispatch — lisez-la
      </div>
      <p
        className={
          dark
            ? "mt-1 whitespace-pre-wrap text-sm leading-5 text-white"
            : "mt-1 whitespace-pre-wrap text-sm leading-5 text-[#1c2268]"
        }
      >
        {text}
      </p>
    </div>
  );
}

export function DispatchNoteHint({ notes }: { notes?: string | null }) {
  const text = notes?.trim();
  const [box, setBox] = useState<{ left: number; top: number } | null>(null);
  if (!text) return null;

  return (
    <>
      <span
        className="inline-flex cursor-default rounded-full bg-[#e7f6fd] px-2 py-0.5 text-[11px] font-medium text-[#00a4e8]"
        onMouseEnter={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const width = 288;
          const left = Math.min(rect.left, Math.max(8, window.innerWidth - width - 8));
          setBox({ left, top: rect.bottom + 8 });
        }}
        onMouseLeave={() => setBox(null)}
        onClick={(event) => event.stopPropagation()}
      >
        Note envoyée
      </span>
      {box
        ? createPortal(
            <div
              role="tooltip"
              className="pointer-events-none fixed z-[400] w-72 max-w-[calc(100vw-1rem)] rounded-xl border border-[#00a4e8]/35 bg-white px-3 py-2 text-sm leading-5 text-[#1c2268] shadow-lg"
              style={{ left: box.left, top: box.top }}
            >
              <div className="text-[10px] font-semibold uppercase tracking-wide text-[#00a4e8]">
                Note du dispatch
              </div>
              <p className="mt-1 whitespace-pre-wrap">{text}</p>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
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
  const triggerRef = useRef<HTMLSpanElement>(null);
  const hideTimer = useRef<number | null>(null);
  const [box, setBox] = useState<{ left: number; top: number } | null>(null);

  function clearHide() {
    if (hideTimer.current != null) {
      window.clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  }

  function show() {
    const el = triggerRef.current;
    if (!el) return;
    clearHide();
    const rect = el.getBoundingClientRect();
    const width = 288;
    const left = Math.min(Math.max(8, rect.left), Math.max(8, window.innerWidth - width - 8));
    const estimatedHeight = 160;
    const below = rect.bottom + 8;
    const top =
      below + estimatedHeight > window.innerHeight - 8
        ? Math.max(8, rect.top - estimatedHeight - 8)
        : below;
    setBox({ left, top });
  }

  function hide() {
    clearHide();
    hideTimer.current = window.setTimeout(() => setBox(null), 60);
  }

  useEffect(() => {
    if (!box) return;
    const dismiss = () => setBox(null);
    window.addEventListener("scroll", dismiss, true);
    window.addEventListener("resize", dismiss);
    return () => {
      window.removeEventListener("scroll", dismiss, true);
      window.removeEventListener("resize", dismiss);
    };
  }, [box]);

  useEffect(() => () => clearHide(), []);

  if (!text) return null;

  return (
    <>
      <span
        ref={triggerRef}
        className="inline-flex cursor-default items-center rounded-full bg-[#e7f6fd] px-2 py-0.5 text-[11px] font-medium text-[#00a4e8]"
        aria-label="Note envoyée au chauffeur"
        onPointerEnter={show}
        onPointerLeave={hide}
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

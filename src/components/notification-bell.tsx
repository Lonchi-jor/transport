"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Bell, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AppNotification } from "@/lib/types";
import { formatWhen } from "@/lib/format";

type Props = {
  items: AppNotification[];
  empty: string;
  hint?: ReactNode;
  tone?: "light" | "dark";
  mode?: "menu" | "sheet";
  label: string;
  onMarkRead: (ids: string[]) => void;
  onOpenItem?: (item: AppNotification) => void;
};

function compactBody(text: string) {
  return text
    .replace(/, Douala [IVX]+, Région du Littoral, Cameroun/gi, "")
    .replace(/, Région du [^,]+, Cameroun/gi, "")
    .replace(/, Cameroun/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

export default function NotificationBell({
  items,
  empty,
  hint,
  tone = "light",
  mode = "menu",
  label,
  onMarkRead,
  onOpenItem,
}: Props) {
  const [open, setOpen] = useState(false);
  const [menuBox, setMenuBox] = useState<{ top: number; right: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const announced = useRef<Set<string>>(new Set());
  const unread = items.filter((item) => !item.readAt);
  const unreadCount = unread.length;
  const dark = tone === "dark";
  const sheet = mode === "sheet";

  const close = useCallback(() => {
    setOpen(false);
    setMenuBox(null);
  }, []);

  useEffect(() => {
    function onDoc(event: MouseEvent) {
      if (sheet) return;
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      close();
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [close, sheet]);

  useEffect(() => {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    const now = Date.now();
    for (const item of items) {
      if (item.readAt) continue;
      if (now - item.createdAt > 20_000) {
        announced.current.add(item.id);
        continue;
      }
      if (announced.current.has(item.id)) continue;
      announced.current.add(item.id);
      try {
        new Notification(item.title, { body: compactBody(item.body), icon: "/icon-192.png" });
      } catch {
        /* ignore */
      }
    }
  }, [items]);

  const openPanel = useCallback(() => {
    if (!open) {
      if (unreadCount) onMarkRead(unread.map((item) => item.id));
      if (typeof Notification !== "undefined" && Notification.permission === "default") {
        void Notification.requestPermission();
      }
      if (!sheet) {
        const rect = triggerRef.current?.getBoundingClientRect();
        if (rect) {
          setMenuBox({
            top: rect.bottom + 8,
            right: Math.max(8, window.innerWidth - rect.right),
          });
        }
      }
    }
    setOpen((current) => !current);
  }, [onMarkRead, open, sheet, unread, unreadCount]);

  const ordered = useMemo(() => items.slice(0, 20), [items]);

  const list = (
    <>
      <div className={cn("flex items-start justify-between gap-3 border-b px-4 py-3", dark ? "border-white/10" : "border-[#d5dcf0]")}>
        <div className="min-w-0">
          <div className="text-sm font-semibold">{label}</div>
          {hint ? (
            <div className={cn("mt-1 text-[11px] leading-4", dark ? "text-blue-100" : "text-[#5b6294]")}>
              {hint}
            </div>
          ) : null}
        </div>
        <button
          type="button"
          onClick={close}
          className={cn(
            "inline-flex size-8 shrink-0 items-center justify-center rounded-lg",
            dark ? "text-white hover:bg-white/10" : "text-[#2b308f] hover:bg-[#eef3fb]",
          )}
          aria-label="Fermer"
        >
          <X className="size-4" />
        </button>
      </div>
      {ordered.length === 0 ? (
        <p className={cn("px-4 py-8 text-sm", dark ? "text-blue-100" : "text-[#5b6294]")}>{empty}</p>
      ) : (
        <ul className="max-h-[min(24rem,60dvh)] overflow-y-auto">
          {ordered.map((item) => (
            <li key={item.id} className={cn("border-b last:border-b-0", dark ? "border-white/10" : "border-[#eef3fb]")}>
              <button
                type="button"
                onClick={() => {
                  if (!item.readAt) onMarkRead([item.id]);
                  onOpenItem?.(item);
                  close();
                }}
                className={cn(
                  "block w-full px-4 py-3 text-left hover:bg-[#00a4e8]/10",
                  !item.readAt ? (dark ? "bg-white/5" : "bg-[#e7f6fd]/70") : "",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="font-medium leading-5">{item.title}</div>
                  {!item.readAt ? <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[#00a4e8]" /> : null}
                </div>
                <p className={cn("mt-1 text-xs leading-5 break-words", dark ? "text-blue-100" : "text-[#5b6294]")}>
                  {compactBody(item.body)}
                </p>
                <div className={cn("mt-1 text-[11px]", dark ? "text-blue-200/80" : "text-[#8a91b8]")}>
                  {formatWhen(item.createdAt)}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );

  const panel =
    typeof document === "undefined" || !open
      ? null
      : sheet
        ? createPortal(
            <div className="fixed inset-0 z-[220] flex flex-col justify-end">
              <button type="button" className="absolute inset-0 bg-black/50" aria-label="Fermer" onClick={close} />
              <div
                ref={panelRef}
                className={cn(
                  "relative z-10 max-h-[78dvh] overflow-hidden rounded-t-3xl border-t shadow-2xl",
                  dark ? "border-white/15 bg-[#151a45] text-white" : "border-[#d5dcf0] bg-white text-[#1c2268]",
                )}
              >
                <div className="flex justify-center pt-2">
                  <span className={cn("h-1 w-10 rounded-full", dark ? "bg-white/30" : "bg-[#d5dcf0]")} />
                </div>
                {list}
              </div>
            </div>,
            document.body,
          )
        : menuBox
          ? createPortal(
              <div
                ref={panelRef}
                className={cn(
                  "fixed z-[220] w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border shadow-xl",
                  dark ? "border-white/15 bg-[#151a45] text-white" : "border-[#d5dcf0] bg-white text-[#1c2268]",
                )}
                style={{ top: menuBox.top, right: menuBox.right }}
              >
                {list}
              </div>,
              document.body,
            )
          : null;

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={openPanel}
        aria-label={unreadCount ? `${label}, ${unreadCount} non lue${unreadCount > 1 ? "s" : ""}` : label}
        aria-expanded={open}
        className={cn(
          "relative inline-flex size-9 items-center justify-center rounded-xl border transition",
          dark
            ? "border-white/20 bg-[#151a45] text-white hover:border-[#00a4e8]"
            : "border-[#d5dcf0] bg-white text-[#2b308f] hover:border-[#00a4e8] hover:bg-[#e7f6fd]",
          unreadCount ? "bell-ring" : "",
        )}
      >
        <Bell className="size-4" />
        {unreadCount ? (
          <span className="absolute -top-1 -right-1 min-w-4 rounded-full bg-[#00a4e8] px-1 text-[10px] font-semibold leading-4 text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </button>
      {panel}
    </div>
  );
}

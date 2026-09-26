"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AppNotification } from "@/lib/types";
import { formatWhen } from "@/lib/format";

type Props = {
  items: AppNotification[];
  empty: string;
  hint?: ReactNode;
  tone?: "light" | "dark";
  label: string;
  onMarkRead: (ids: string[]) => void;
  onOpenItem?: (item: AppNotification) => void;
};

export default function NotificationBell({
  items,
  empty,
  hint,
  tone = "light",
  label,
  onMarkRead,
  onOpenItem,
}: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const announced = useRef<Set<string>>(new Set());
  const unread = items.filter((item) => !item.readAt);
  const unreadCount = unread.length;
  const dark = tone === "dark";

  useEffect(() => {
    function onDoc(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

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
        new Notification(item.title, { body: item.body, icon: "/icon-192.png" });
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
    }
    setOpen((current) => !current);
  }, [onMarkRead, open, unread, unreadCount]);

  const ordered = useMemo(() => items.slice(0, 20), [items]);

  return (
    <div ref={rootRef} className="relative">
      <button
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
      {open ? (
        <div
          className={cn(
            "absolute right-0 z-[80] mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border shadow-xl",
            dark ? "border-white/15 bg-[#151a45] text-white" : "border-[#d5dcf0] bg-white text-[#1c2268]",
          )}
        >
          <div className={cn("border-b px-3 py-2", dark ? "border-white/10" : "border-[#d5dcf0]")}>
            <div className="text-sm font-semibold">{label}</div>
            {hint ? (
              <div className={cn("mt-0.5 text-[11px] leading-4", dark ? "text-blue-100" : "text-[#5b6294]")}>
                {hint}
              </div>
            ) : null}
          </div>
          {ordered.length === 0 ? (
            <p className={cn("px-3 py-6 text-sm", dark ? "text-blue-100" : "text-[#5b6294]")}>{empty}</p>
          ) : (
            <ul className="max-h-80 overflow-y-auto">
              {ordered.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => {
                      if (!item.readAt) onMarkRead([item.id]);
                      onOpenItem?.(item);
                      setOpen(false);
                    }}
                    className={cn(
                      "block w-full px-3 py-2.5 text-left text-sm hover:bg-[#00a4e8]/10",
                      !item.readAt ? (dark ? "bg-white/5" : "bg-[#e7f6fd]/70") : "",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-medium">{item.title}</div>
                      {!item.readAt ? <span className="mt-1 size-1.5 shrink-0 rounded-full bg-[#00a4e8]" /> : null}
                    </div>
                    <p className={cn("mt-0.5 text-xs leading-4", dark ? "text-blue-100" : "text-[#5b6294]")}>
                      {item.body}
                    </p>
                    <div className={cn("mt-1 text-[11px]", dark ? "text-blue-200/80" : "text-[#8a91b8]")}>
                      {formatWhen(item.createdAt)}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}

import { mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import type { AppNotification, NotificationKind } from "./types";
import { DISPATCH_INBOX, NOTIFICATION_KINDS } from "./types";

const FILE = path.join(process.cwd(), ".data", "notifications.json");
const MAX = 120;
const items: AppNotification[] = [];

function isKind(value: unknown): value is NotificationKind {
  return typeof value === "string" && (NOTIFICATION_KINDS as readonly string[]).includes(value);
}

function load() {
  try {
    const raw = readFileSync(FILE, "utf8");
    const parsed = JSON.parse(raw) as Partial<AppNotification>[];
    items.length = 0;
    if (!Array.isArray(parsed)) return;
    let remapped = false;
    for (const row of parsed) {
      if (!row?.id || !isKind(row.kind) || !row.targetId || !row.courseId) continue;
      const targetId = row.kind === "course_done" ? DISPATCH_INBOX : row.targetId;
      if (row.kind === "course_done" && row.targetId !== DISPATCH_INBOX) remapped = true;
      items.push({
        id: row.id,
        kind: row.kind,
        courseId: row.courseId,
        reference: row.reference ?? "",
        title: row.title ?? "",
        body: row.body ?? "",
        targetRole: row.targetRole === "driver" ? "driver" : "dispatcher",
        targetId,
        createdAt: row.createdAt ?? Date.now(),
        readAt: row.readAt ?? null,
      });
    }
    if (remapped) save();
  } catch {
    /* first run */
  }
}

function save() {
  mkdirSync(path.dirname(FILE), { recursive: true });
  writeFileSync(FILE, JSON.stringify(items, null, 2));
}

load();

export function listNotifications(): AppNotification[] {
  return [...items].sort((a, b) => b.createdAt - a.createdAt);
}

export function listNotificationsFor(targetId: string): AppNotification[] {
  const key = targetId.trim();
  if (!key) return [];
  return listNotifications().filter((item) => item.targetId === key && item.readAt == null);
}

export function addNotification(input: {
  kind: NotificationKind;
  courseId: string;
  reference: string;
  title: string;
  body: string;
  targetRole: "driver" | "dispatcher";
  targetId: string;
  unique?: "always" | "unread";
}): AppNotification | null {
  const targetId = input.targetId.trim();
  if (!targetId) return null;
  const duplicate = items.find(
    (item) =>
      item.kind === input.kind &&
      item.courseId === input.courseId &&
      item.targetId === targetId &&
      (input.unique === "unread" ? item.readAt == null : true),
  );
  if (duplicate) return duplicate;
  const next: AppNotification = {
    id: crypto.randomUUID(),
    kind: input.kind,
    courseId: input.courseId,
    reference: input.reference,
    title: input.title,
    body: input.body,
    targetRole: input.targetRole,
    targetId,
    createdAt: Date.now(),
    readAt: null,
  };
  items.unshift(next);
  if (items.length > MAX) items.length = MAX;
  save();
  return next;
}

export function markNotificationsRead(targetId: string, ids?: string[]) {
  const key = targetId.trim();
  if (!key) return listNotifications();
  const allow = ids ? new Set(ids) : null;
  const now = Date.now();
  let changed = false;
  for (const item of items) {
    if (item.targetId !== key || item.readAt) continue;
    if (allow && !allow.has(item.id)) continue;
    item.readAt = now;
    changed = true;
  }
  if (changed) save();
  return listNotifications();
}

export function dismissNotifications(filter: {
  targetId?: string;
  ids?: string[];
  courseId?: string;
  kind?: NotificationKind;
}) {
  const targetId = filter.targetId?.trim() ?? "";
  const idSet = filter.ids?.length ? new Set(filter.ids) : null;
  if (!targetId && !idSet && !filter.courseId) return listNotifications();
  const next = items.filter((item) => {
    if (targetId && item.targetId !== targetId) return true;
    if (idSet && !idSet.has(item.id)) return true;
    if (filter.courseId && item.courseId !== filter.courseId) return true;
    if (filter.kind && item.kind !== filter.kind) return true;
    return false;
  });
  if (next.length === items.length) return listNotifications();
  items.length = 0;
  items.push(...next);
  save();
  return listNotifications();
}

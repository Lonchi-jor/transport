import { mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import type { AppNotification, NotificationKind } from "./types";
import { NOTIFICATION_KINDS } from "./types";

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
    for (const row of parsed) {
      if (!row?.id || !isKind(row.kind) || !row.targetId || !row.courseId) continue;
      items.push({
        id: row.id,
        kind: row.kind,
        courseId: row.courseId,
        reference: row.reference ?? "",
        title: row.title ?? "",
        body: row.body ?? "",
        targetRole: row.targetRole === "driver" ? "driver" : "dispatcher",
        targetId: row.targetId,
        createdAt: row.createdAt ?? Date.now(),
        readAt: row.readAt ?? null,
      });
    }
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
  return listNotifications().filter((item) => item.targetId === key);
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

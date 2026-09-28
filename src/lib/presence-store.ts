import { mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";

export type DriverPresence = {
  driverId: string;
  lastSeenAt: number;
  lastLat: number | null;
  lastLng: number | null;
  lastHeading: number | null;
  lastAccuracy: number | null;
  lastFixAt: number | null;
};

const FILE = path.join(process.cwd(), ".data", "presence.json");
const records = new Map<string, DriverPresence>();
let saveTimer: ReturnType<typeof setTimeout> | null = null;

function load() {
  try {
    const raw = readFileSync(FILE, "utf8");
    const list = JSON.parse(raw) as Partial<DriverPresence>[];
    records.clear();
    for (const item of list) {
      if (!item?.driverId || !item.lastSeenAt) continue;
      records.set(item.driverId, {
        driverId: item.driverId,
        lastSeenAt: item.lastSeenAt,
        lastLat: finiteOrNull(item.lastLat),
        lastLng: finiteOrNull(item.lastLng),
        lastHeading: finiteOrNull(item.lastHeading),
        lastAccuracy: finiteOrNull(item.lastAccuracy),
        lastFixAt: typeof item.lastFixAt === "number" ? item.lastFixAt : null,
      });
    }
  } catch {
    /* first run */
  }
}

function finiteOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function persist() {
  mkdirSync(path.dirname(FILE), { recursive: true });
  writeFileSync(FILE, JSON.stringify([...records.values()], null, 2));
}

function scheduleSave(immediate = false) {
  if (immediate) {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    persist();
    return;
  }
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    persist();
  }, 2500);
}

load();

export function getPresence(driverId: string): DriverPresence | null {
  return records.get(driverId) ?? null;
}

export function listPresence(): DriverPresence[] {
  return [...records.values()];
}

export function recordDriverPresence(
  driverId: string,
  fix?: {
    lat?: number | null;
    lng?: number | null;
    heading?: number | null;
    accuracy?: number | null;
  },
) {
  const id = driverId.trim();
  if (!id || id.startsWith("demo-")) return;
  const existing = records.get(id);
  const now = Date.now();
  const lat = finiteOrNull(fix?.lat);
  const lng = finiteOrNull(fix?.lng);
  const hasFix = lat != null && lng != null;
  const next: DriverPresence = {
    driverId: id,
    lastSeenAt: now,
    lastLat: hasFix ? lat : (existing?.lastLat ?? null),
    lastLng: hasFix ? lng : (existing?.lastLng ?? null),
    lastHeading: hasFix ? finiteOrNull(fix?.heading) : (existing?.lastHeading ?? null),
    lastAccuracy: hasFix ? finiteOrNull(fix?.accuracy) : (existing?.lastAccuracy ?? null),
    lastFixAt: hasFix ? now : (existing?.lastFixAt ?? null),
  };
  records.set(id, next);
  scheduleSave(false);
}

export function deletePresence(driverId: string) {
  if (records.delete(driverId)) scheduleSave(true);
}

export function flushPresence() {
  scheduleSave(true);
}

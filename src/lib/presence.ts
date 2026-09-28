import { formatWhen } from "@/lib/format";

/** A chauffeur is “hors ligne” (red) after this long without a heartbeat. */
export const PRESENCE_OFFLINE_AFTER_MS = 30 * 60 * 1000;

export type PresenceKind = "online" | "recent" | "stale" | "unknown";

export const PRESENCE_COLOR: Record<PresenceKind, string> = {
  online: "#16a34a",
  recent: "#ca8a04",
  stale: "#dc2626",
  unknown: "#94a3b8",
};

export const PRESENCE_BADGE_CLASS: Record<PresenceKind, string> = {
  online: "bg-green-100 text-green-800",
  recent: "bg-amber-100 text-amber-800",
  stale: "bg-red-100 text-red-700",
  unknown: "bg-[#eef3fb] text-[#5b6294]",
};

export function presenceKind(
  input: { connected?: boolean | null; lastSeen?: number | null },
  now: number,
): PresenceKind {
  const lastSeen = input.lastSeen;
  if (lastSeen == null || !Number.isFinite(lastSeen) || lastSeen <= 0) return "unknown";
  if (input.connected) return "online";
  const age = now - lastSeen;
  if (age <= PRESENCE_OFFLINE_AFTER_MS) return "recent";
  return "stale";
}

export function presenceLabel(
  kind: PresenceKind,
  lastSeen: number | null | undefined,
  now: number,
): string {
  if (kind === "online") return "En ligne";
  if (kind === "unknown") return "Jamais connecté";
  if (kind === "recent" && lastSeen != null) {
    const age = Math.max(0, now - lastSeen);
    if (age < 60_000) return "En ligne il y a moins d’une minute";
    const minutes = Math.max(1, Math.round(age / 60_000));
    return minutes === 1 ? "En ligne il y a 1 minute" : `En ligne il y a ${minutes} minutes`;
  }
  return "Hors ligne";
}

export function presenceHoverText(
  kind: PresenceKind,
  lastSeen: number | null | undefined,
  now: number,
): string {
  const label = presenceLabel(kind, lastSeen, now);
  const when = formatWhen(lastSeen);
  if (!when) return label;
  if (kind === "online") return `${label} · ${when}`;
  return `${label} · dernière vue ${when}`;
}

import type { FleetDevice } from "@/lib/types";

export const DEFAULT_CENTER = { lat: -1.286389, lng: 36.817223 };

export function kph(speedMps: number | null) {
  if (speedMps == null) return null;
  return Math.round(speedMps * 3.6);
}

export function statusLabel(device: FleetDevice, now: number) {
  if (device.role === "dispatcher") return "Dispatch desk";
  if (!device.sharing || device.lat == null) return "No GPS";
  const age = now - device.lastSeen;
  if (age > 12_000) return "Signal weak";
  if ((device.speedMps ?? 0) < 1.2) return "Idle";
  return "En route";
}

export function formatAge(lastSeen: number, now: number) {
  const sec = Math.max(0, Math.round((now - lastSeen) / 1000));
  if (sec < 3) return "just now";
  if (sec < 60) return `${sec}s ago`;
  return `${Math.round(sec / 60)}m ago`;
}

export function devicesWithPosition(devices: FleetDevice[]) {
  return devices.filter((d) => d.lat != null && d.lng != null);
}

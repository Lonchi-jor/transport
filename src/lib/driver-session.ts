import type { VehicleType } from "./types";

const SESSION_KEY = "ccmm-driver-session";
const LEGACY_SESSION_KEY = "transitlive-session";
const CREDENTIALS_KEY = "ccmm-driver-credentials";
const SKIP_AUTO_KEY = "ccmm-skip-auto-login";

export type DriverSession = {
  id: string;
  callSign: string;
  driverName: string;
  vehicleType: VehicleType;
  vehiclePlate: string;
  role: "driver";
};

export type SavedCredentials = {
  callSign: string;
  pin: string;
};

function readJson<T>(storage: Storage, key: string): T | null {
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function parseSession(value: unknown): DriverSession | null {
  if (!value || typeof value !== "object") return null;
  const parsed = value as Partial<DriverSession>;
  if (!parsed.id || !parsed.callSign || parsed.role !== "driver") return null;
  return {
    id: parsed.id,
    callSign: parsed.callSign,
    driverName: parsed.driverName ?? "",
    vehicleType: parsed.vehicleType ?? "van",
    vehiclePlate: parsed.vehiclePlate ?? "",
    role: "driver",
  };
}

export function loadSession(): DriverSession | null {
  if (typeof window === "undefined") return null;
  const current = parseSession(readJson(localStorage, SESSION_KEY));
  if (current) return current;
  const legacy =
    parseSession(readJson(localStorage, LEGACY_SESSION_KEY)) ??
    parseSession(readJson(sessionStorage, LEGACY_SESSION_KEY));
  if (!legacy) return null;
  saveSession(legacy);
  sessionStorage.removeItem(LEGACY_SESSION_KEY);
  localStorage.removeItem(LEGACY_SESSION_KEY);
  return legacy;
}

export function saveSession(session: DriverSession) {
  if (typeof window === "undefined") return;
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  sessionStorage.removeItem(LEGACY_SESSION_KEY);
  localStorage.removeItem(LEGACY_SESSION_KEY);
}

export function clearSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(LEGACY_SESSION_KEY);
  localStorage.removeItem(LEGACY_SESSION_KEY);
}

export function loadCredentials(): SavedCredentials | null {
  if (typeof window === "undefined") return null;
  const saved = readJson<Partial<SavedCredentials>>(localStorage, CREDENTIALS_KEY);
  const callSign = saved?.callSign?.trim() ?? "";
  const pin = (saved?.pin ?? "").replace(/\D/g, "");
  if (!callSign || pin.length < 4) return null;
  return { callSign, pin };
}

export function saveCredentials(callSign: string, pin: string) {
  if (typeof window === "undefined") return;
  const next: SavedCredentials = {
    callSign: callSign.trim(),
    pin: pin.replace(/\D/g, ""),
  };
  if (!next.callSign || next.pin.length < 4) return;
  localStorage.setItem(CREDENTIALS_KEY, JSON.stringify(next));
  sessionStorage.removeItem(SKIP_AUTO_KEY);
}

export function clearCredentials() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(CREDENTIALS_KEY);
}

export function skipNextAutoLogin() {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(SKIP_AUTO_KEY, "1");
}

export function shouldAutoLogin() {
  if (typeof window === "undefined") return false;
  if (sessionStorage.getItem(SKIP_AUTO_KEY)) return false;
  return loadCredentials() != null;
}

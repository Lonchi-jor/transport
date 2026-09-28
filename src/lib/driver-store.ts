import { mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import type { VehicleType } from "./types";
import { MAX_TRAILERS, VEHICLE_TYPES } from "./types";

export type DriverAccount = {
  id: string;
  callSign: string;
  driverName: string;
  phone: string;
  vehicleType: VehicleType;
  vehiclePlate: string;
  trailerPlates: string[];
  pin: string;
  createdAt: number;
  updatedAt: number;
};

export type DriverPublic = Omit<DriverAccount, "pin"> & {
  lastLat?: number | null;
  lastLng?: number | null;
  lastFixAt?: number | null;
  lastSeenAt?: number | null;
};

const FILE = path.join(process.cwd(), ".data", "drivers.json");
const drivers = new Map<string, DriverAccount>();

function load() {
  try {
    const raw = readFileSync(FILE, "utf8");
    const list = JSON.parse(raw) as Partial<DriverAccount>[];
    drivers.clear();
    for (const item of list) {
      if (!item?.id || !item.callSign) continue;
      drivers.set(item.id, {
        id: item.id,
        callSign: item.callSign,
        driverName: item.driverName ?? "",
        phone: normalizePhone(item.phone ?? ""),
        vehicleType: isVehicleType(item.vehicleType) ? item.vehicleType : "van",
        vehiclePlate: normalizePlate(item.vehiclePlate ?? ""),
        trailerPlates: normalizeTrailerPlates(item.trailerPlates),
        pin: String(item.pin ?? ""),
        createdAt: item.createdAt ?? Date.now(),
        updatedAt: item.updatedAt ?? item.createdAt ?? Date.now(),
      });
    }
  } catch {
    /* first run */
  }
}

function save() {
  mkdirSync(path.dirname(FILE), { recursive: true });
  writeFileSync(FILE, JSON.stringify([...drivers.values()], null, 2));
}

load();

export function normalizeCallSign(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, "-");
}

export function normalizePlate(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, " ");
}

export function normalizeTrailerPlates(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const plates: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const plate = normalizePlate(item);
    if (plate.length < 3 || seen.has(plate)) continue;
    seen.add(plate);
    plates.push(plate);
    if (plates.length >= MAX_TRAILERS) break;
  }
  return plates;
}

export function driverPlates(driver: Pick<DriverAccount, "vehiclePlate" | "trailerPlates">) {
  return [driver.vehiclePlate, ...driver.trailerPlates].map(normalizePlate).filter(Boolean);
}

export function normalizePhone(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function phoneKey(value: string) {
  return value.replace(/\D/g, "");
}

function normalizePin(value: string) {
  return value.replace(/\D/g, "").slice(0, 6);
}

export function isVehicleType(value: unknown): value is VehicleType {
  return typeof value === "string" && (VEHICLE_TYPES as readonly string[]).includes(value);
}

function toPublic(account: DriverAccount): DriverPublic {
  return {
    id: account.id,
    callSign: account.callSign,
    driverName: account.driverName,
    phone: account.phone,
    vehicleType: account.vehicleType,
    vehiclePlate: account.vehiclePlate,
    trailerPlates: account.trailerPlates,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
  };
}

export function listDrivers(): DriverAccount[] {
  return [...drivers.values()].sort((a, b) => a.callSign.localeCompare(b.callSign));
}

export function listDriversPublic(): DriverPublic[] {
  return listDrivers().map(toPublic);
}

export function getDriver(id: string) {
  return drivers.get(id) ?? null;
}

export function getDriverPublic(id: string): DriverPublic | null {
  const account = drivers.get(id);
  return account ? toPublic(account) : null;
}

export function findDriverByCallSign(callSign: string) {
  const key = normalizeCallSign(callSign);
  return listDrivers().find((d) => d.callSign === key) ?? null;
}

export function findDriverByPlate(plate: string) {
  const key = normalizePlate(plate);
  if (!key) return null;
  return listDrivers().find((driver) => driverPlates(driver).includes(key)) ?? null;
}

export function findDriverByPhone(phone: string) {
  const key = phoneKey(phone);
  if (key.length < 8) return null;
  return listDrivers().find((d) => phoneKey(d.phone) === key) ?? null;
}

type DriverInput = {
  callSign: string;
  driverName: string;
  phone: string;
  vehicleType: VehicleType;
  vehiclePlate: string;
  trailerPlates?: string[];
  pin?: string;
};

function validateDriver(input: DriverInput, ignoreId?: string): { error: string } | {
  callSign: string;
  driverName: string;
  phone: string;
  vehicleType: VehicleType;
  vehiclePlate: string;
  trailerPlates: string[];
  pin?: string;
} {
  const callSign = normalizeCallSign(input.callSign);
  const driverName = input.driverName.trim();
  const phone = normalizePhone(input.phone);
  const digits = phoneKey(phone);
  const vehiclePlate = normalizePlate(input.vehiclePlate);
  const trailerPlates = normalizeTrailerPlates(input.trailerPlates);
  if (callSign.length < 2) return { error: "Indiquez un indicatif (ex. ME-01)." };
  if (driverName.length < 2) return { error: "Indiquez le nom du chauffeur." };
  if (digits.length < 8 || digits.length > 15) {
    return { error: "Indiquez le numéro de téléphone du chauffeur." };
  }
  if (vehiclePlate.length < 3) return { error: "Indiquez l’immatriculation du tracteur." };
  if (trailerPlates.includes(vehiclePlate)) {
    return { error: "Une remorque ne peut pas avoir la même plaque que le tracteur." };
  }
  const sameCall = findDriverByCallSign(callSign);
  if (sameCall && sameCall.id !== ignoreId) return { error: "Cet indicatif existe déjà." };
  const samePhone = findDriverByPhone(phone);
  if (samePhone && samePhone.id !== ignoreId) {
    return { error: "Ce numéro est déjà attribué à un autre chauffeur." };
  }
  for (const plate of [vehiclePlate, ...trailerPlates]) {
    const samePlate = findDriverByPlate(plate);
    if (samePlate && samePlate.id !== ignoreId) {
      return { error: `La plaque ${plate} est déjà attribuée à ${samePlate.callSign}.` };
    }
  }
  return { callSign, driverName, phone, vehicleType: input.vehicleType, vehiclePlate, trailerPlates };
}

export function createDriver(input: DriverInput): DriverAccount | { error: string } {
  const parsed = validateDriver(input);
  if ("error" in parsed) return parsed;
  const pin = normalizePin(input.pin || String(1000 + Math.floor(Math.random() * 9000)));
  if (pin.length < 4) return { error: "Le code PIN doit avoir au moins 4 chiffres." };
  const now = Date.now();
  const account: DriverAccount = {
    id: crypto.randomUUID(),
    callSign: parsed.callSign,
    driverName: parsed.driverName,
    phone: parsed.phone,
    vehicleType: parsed.vehicleType,
    vehiclePlate: parsed.vehiclePlate,
    trailerPlates: parsed.trailerPlates,
    pin,
    createdAt: now,
    updatedAt: now,
  };
  drivers.set(account.id, account);
  save();
  return account;
}

export function updateDriver(id: string, input: DriverInput): DriverAccount | { error: string } {
  const existing = drivers.get(id);
  if (!existing) return { error: "Chauffeur introuvable." };
  const parsed = validateDriver(input, id);
  if ("error" in parsed) return parsed;
  let pin = existing.pin;
  if (input.pin !== undefined && input.pin.trim() !== "") {
    const nextPin = normalizePin(input.pin);
    if (nextPin.length < 4) return { error: "Le code PIN doit avoir au moins 4 chiffres." };
    pin = nextPin;
  }
  const account: DriverAccount = {
    ...existing,
    callSign: parsed.callSign,
    driverName: parsed.driverName,
    phone: parsed.phone,
    vehicleType: parsed.vehicleType,
    vehiclePlate: parsed.vehiclePlate,
    trailerPlates: parsed.trailerPlates,
    pin,
    updatedAt: Date.now(),
  };
  drivers.set(id, account);
  save();
  return account;
}

export function deleteDriver(id: string) {
  const ok = drivers.delete(id);
  if (ok) save();
  return ok;
}

export function loginDriver(callSign: string, pin: string): DriverPublic | null {
  const account = findDriverByCallSign(callSign);
  if (!account) return null;
  if (normalizePin(pin) !== account.pin) return null;
  return toPublic(account);
}

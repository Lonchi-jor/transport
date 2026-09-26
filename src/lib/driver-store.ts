import { mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import type { VehicleType } from "./types";
import { VEHICLE_TYPES } from "./types";

export type DriverAccount = {
  id: string;
  callSign: string;
  driverName: string;
  vehicleType: VehicleType;
  vehiclePlate: string;
  vehicleLabel: string;
  pin: string;
  createdAt: number;
  updatedAt: number;
};

export type DriverPublic = Omit<DriverAccount, "pin">;

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
        vehicleType: isVehicleType(item.vehicleType) ? item.vehicleType : "van",
        vehiclePlate: normalizePlate(item.vehiclePlate ?? ""),
        vehicleLabel: (item.vehicleLabel ?? "").trim(),
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
    vehicleType: account.vehicleType,
    vehiclePlate: account.vehiclePlate,
    vehicleLabel: account.vehicleLabel,
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

export function findDriverByCallSign(callSign: string) {
  const key = normalizeCallSign(callSign);
  return listDrivers().find((d) => d.callSign === key) ?? null;
}

export function findDriverByPlate(plate: string) {
  const key = normalizePlate(plate);
  if (!key) return null;
  return listDrivers().find((d) => d.vehiclePlate === key) ?? null;
}

type DriverInput = {
  callSign: string;
  driverName: string;
  vehicleType: VehicleType;
  vehiclePlate: string;
  vehicleLabel?: string;
  pin?: string;
};

function validateDriver(input: DriverInput, ignoreId?: string): { error: string } | {
  callSign: string;
  driverName: string;
  vehicleType: VehicleType;
  vehiclePlate: string;
  vehicleLabel: string;
  pin?: string;
} {
  const callSign = normalizeCallSign(input.callSign);
  const driverName = input.driverName.trim();
  const vehiclePlate = normalizePlate(input.vehiclePlate);
  const vehicleLabel = (input.vehicleLabel ?? "").trim();
  if (callSign.length < 2) return { error: "Indiquez un indicatif (ex. ME-01)." };
  if (driverName.length < 2) return { error: "Indiquez le nom du chauffeur." };
  if (vehiclePlate.length < 3) return { error: "Indiquez l’immatriculation du véhicule." };
  const sameCall = findDriverByCallSign(callSign);
  if (sameCall && sameCall.id !== ignoreId) return { error: "Cet indicatif existe déjà." };
  const samePlate = findDriverByPlate(vehiclePlate);
  if (samePlate && samePlate.id !== ignoreId) {
    return { error: "Ce véhicule est déjà attribué à un autre chauffeur." };
  }
  return { callSign, driverName, vehicleType: input.vehicleType, vehiclePlate, vehicleLabel };
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
    vehicleType: parsed.vehicleType,
    vehiclePlate: parsed.vehiclePlate,
    vehicleLabel: parsed.vehicleLabel,
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
    vehicleType: parsed.vehicleType,
    vehiclePlate: parsed.vehiclePlate,
    vehicleLabel: parsed.vehicleLabel,
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

import { mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import type { VehicleType } from "./types";
import { VEHICLE_TYPES } from "./types";

export type DriverAccount = {
  id: string;
  callSign: string;
  driverName: string;
  vehicleType: VehicleType;
  pin: string;
  createdAt: number;
};

export type DriverPublic = Omit<DriverAccount, "pin">;

const FILE = path.join(process.cwd(), ".data", "drivers.json");
const drivers = new Map<string, DriverAccount>();

function load() {
  try {
    const raw = readFileSync(FILE, "utf8");
    const list = JSON.parse(raw) as DriverAccount[];
    drivers.clear();
    for (const item of list) {
      if (item?.id && item.callSign) drivers.set(item.id, item);
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

function normalizeCallSign(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, "-");
}

function normalizePin(value: string) {
  return value.replace(/\D/g, "").slice(0, 6);
}

export function isVehicleType(value: unknown): value is VehicleType {
  return typeof value === "string" && (VEHICLE_TYPES as readonly string[]).includes(value);
}

export function listDrivers(): DriverAccount[] {
  return [...drivers.values()].sort((a, b) => a.callSign.localeCompare(b.callSign));
}

export function listDriversPublic(): DriverPublic[] {
  return listDrivers().map((account) => ({
    id: account.id,
    callSign: account.callSign,
    driverName: account.driverName,
    vehicleType: account.vehicleType,
    createdAt: account.createdAt,
  }));
}

export function getDriver(id: string) {
  return drivers.get(id) ?? null;
}

export function findDriverByCallSign(callSign: string) {
  const key = normalizeCallSign(callSign);
  return listDrivers().find((d) => d.callSign === key) ?? null;
}

export function createDriver(input: {
  callSign: string;
  driverName: string;
  vehicleType: VehicleType;
  pin?: string;
}): DriverAccount | { error: string } {
  const callSign = normalizeCallSign(input.callSign);
  const driverName = input.driverName.trim();
  const pin = normalizePin(input.pin || String(1000 + Math.floor(Math.random() * 9000)));
  if (callSign.length < 2) return { error: "Indiquez un indicatif (ex. ME-01)." };
  if (driverName.length < 2) return { error: "Indiquez le nom du chauffeur." };
  if (pin.length < 4) return { error: "Le code PIN doit avoir au moins 4 chiffres." };
  if (findDriverByCallSign(callSign)) return { error: "Cet indicatif existe déjà." };
  const account: DriverAccount = {
    id: crypto.randomUUID(),
    callSign,
    driverName,
    vehicleType: input.vehicleType,
    pin,
    createdAt: Date.now(),
  };
  drivers.set(account.id, account);
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
  return {
    id: account.id,
    callSign: account.callSign,
    driverName: account.driverName,
    vehicleType: account.vehicleType,
    createdAt: account.createdAt,
  };
}

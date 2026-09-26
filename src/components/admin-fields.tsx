"use client";

import type { ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { VEHICLE_META, VEHICLE_TYPES, type VehicleType } from "@/lib/types";

export function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-1">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}

export function VehicleFields({
  idPrefix,
  vehicleType,
  vehiclePlate,
  plateRequired,
  onChange,
}: {
  idPrefix: string;
  vehicleType: VehicleType;
  vehiclePlate: string;
  plateRequired?: boolean;
  onChange: (patch: { vehicleType?: VehicleType; vehiclePlate?: string }) => void;
}) {
  return (
    <div className="grid gap-3 rounded-xl border border-[#e4e9f6] bg-[#f8faff] p-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-[#5b6294]">Véhicule</div>
      <Field label="Type" htmlFor={`${idPrefix}-vehicleType`}>
        <select
          id={`${idPrefix}-vehicleType`}
          value={vehicleType}
          onChange={(e) => onChange({ vehicleType: e.target.value as VehicleType })}
          className="h-9 w-full rounded-lg border border-input bg-white px-2.5 text-sm outline-none"
        >
          {VEHICLE_TYPES.map((type) => (
            <option key={type} value={type}>
              {VEHICLE_META[type].label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Immatriculation" htmlFor={`${idPrefix}-plate`}>
        <Input
          id={`${idPrefix}-plate`}
          required={plateRequired}
          value={vehiclePlate}
          onChange={(e) => onChange({ vehiclePlate: e.target.value.toUpperCase() })}
          placeholder="LT 1234 CE"
          autoCapitalize="characters"
        />
      </Field>
    </div>
  );
}

export function Stat({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return (
    <div className="rounded-2xl border border-[#d5dcf0] bg-white p-3 shadow-sm">
      <div className="text-[#00a4e8]">{icon}</div>
      <div className="mt-1 text-xl font-semibold text-[#2b308f]">{value}</div>
      <div className="text-[11px] text-[#5b6294]">{label}</div>
    </div>
  );
}

"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field, VehicleFields } from "@/components/admin-fields";
import type { Course, VehicleType } from "@/lib/types";
import type { RosterDriver } from "@/lib/roster";

export default function CourseEditor({
  course,
  roster,
  onSave,
}: {
  course: Course;
  roster: RosterDriver[];
  onSave: (
    id: string,
    body: {
      assignedDeviceId?: string | null;
      vehicleType?: VehicleType | null;
      vehiclePlate?: string | null;
      vehicleLabel?: string | null;
    },
  ) => Promise<void>;
}) {
  const [assignedDeviceId, setAssignedDeviceId] = useState(course.assignedDeviceId ?? "");
  const [vehicleType, setVehicleType] = useState<VehicleType>(course.vehicleType ?? "van");
  const [vehiclePlate, setVehiclePlate] = useState(course.vehiclePlate ?? "");
  const [vehicleLabel, setVehicleLabel] = useState(course.vehicleLabel ?? "");
  const [saving, setSaving] = useState(false);

  function pickDriver(id: string) {
    const driver = roster.find((item) => item.id === id);
    setAssignedDeviceId(id);
    if (!driver) {
      setVehiclePlate("");
      setVehicleLabel("");
      return;
    }
    setVehicleType(driver.vehicleType);
    setVehiclePlate(driver.vehiclePlate ?? "");
    setVehicleLabel(driver.vehicleLabel ?? "");
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    await onSave(course.id, {
      assignedDeviceId: assignedDeviceId || null,
      vehicleType: assignedDeviceId ? vehicleType : null,
      vehiclePlate: assignedDeviceId ? vehiclePlate : null,
      vehicleLabel: assignedDeviceId ? vehicleLabel : null,
    });
    setSaving(false);
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="rounded-2xl border border-[#d5dcf0] bg-white p-4 shadow-sm">
      <h3 className="text-base font-semibold text-[#2b308f]">Modifier {course.reference}</h3>
      <p className="mb-3 text-xs text-[#5b6294]">
        Changez le chauffeur : son véhicule se remet tout seul. Vous pouvez encore corriger l’immatriculation pour cette course.
      </p>
      <div className="grid gap-3">
        <Field label="Chauffeur" htmlFor={`edit-driver-${course.id}`}>
          <select
            id={`edit-driver-${course.id}`}
            value={assignedDeviceId}
            onChange={(e) => pickDriver(e.target.value)}
            className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none"
          >
            <option value="">Non attribué</option>
            {roster.map((driver) => (
              <option key={driver.id} value={driver.id}>
                {driver.callSign} — {driver.driverName}
              </option>
            ))}
          </select>
        </Field>
        {assignedDeviceId ? (
          <VehicleFields
            idPrefix={`edit-${course.id}`}
            vehicleType={vehicleType}
            vehiclePlate={vehiclePlate}
            vehicleLabel={vehicleLabel}
            onChange={(patch) => {
              if (patch.vehicleType) setVehicleType(patch.vehicleType);
              if (patch.vehiclePlate !== undefined) setVehiclePlate(patch.vehiclePlate);
              if (patch.vehicleLabel !== undefined) setVehicleLabel(patch.vehicleLabel);
            }}
          />
        ) : (
          <p className="text-xs text-[#5b6294]">Attribuez un chauffeur pour coller son véhicule.</p>
        )}
      </div>
      <Button type="submit" className="mt-3 h-9" disabled={saving}>
        {saving ? "Enregistrement…" : "Enregistrer la course"}
      </Button>
    </form>
  );
}

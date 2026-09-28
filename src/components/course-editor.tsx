"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { DriverAssignSelect, Field, VehicleFields } from "@/components/admin-fields";
import type { Course, VehicleType } from "@/lib/types";
import type { RosterDriver } from "@/lib/roster";
import { assignmentBlockedMessage, isDriverAtCapacity, liveJobsForDriver } from "@/lib/assignment";

export default function CourseEditor({
  course,
  roster,
  courses,
  onSave,
}: {
  course: Course;
  roster: RosterDriver[];
  courses: Course[];
  onSave: (
    id: string,
    body: {
      assignedDeviceId?: string | null;
      vehicleType?: VehicleType | null;
      vehiclePlate?: string | null;
    },
  ) => Promise<string | null>;
}) {
  const [assignedDeviceId, setAssignedDeviceId] = useState(course.assignedDeviceId ?? "");
  const [vehicleType, setVehicleType] = useState<VehicleType>(course.vehicleType ?? "van");
  const [vehiclePlate, setVehiclePlate] = useState(course.vehiclePlate ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function pickDriver(id: string) {
    if (id) {
      const held = liveJobsForDriver(courses, id, course.id);
      if (isDriverAtCapacity(courses, id, course.id)) {
        setError(assignmentBlockedMessage(held, roster.find((item) => item.id === id)?.callSign));
        return;
      }
    }
    setError("");
    const driver = roster.find((item) => item.id === id);
    setAssignedDeviceId(id);
    if (!driver) {
      setVehiclePlate("");
      return;
    }
    setVehicleType(driver.vehicleType);
    setVehiclePlate(driver.vehiclePlate ?? "");
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (assignedDeviceId) {
      const held = liveJobsForDriver(courses, assignedDeviceId, course.id);
      if (isDriverAtCapacity(courses, assignedDeviceId, course.id)) {
        setError(assignmentBlockedMessage(held, roster.find((item) => item.id === assignedDeviceId)?.callSign));
        return;
      }
    }
    setSaving(true);
    setError("");
    const message = await onSave(course.id, {
      assignedDeviceId: assignedDeviceId || null,
      vehicleType: assignedDeviceId ? vehicleType : null,
      vehiclePlate: assignedDeviceId ? vehiclePlate : null,
    });
    if (message) setError(message);
    setSaving(false);
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="rounded-2xl border border-[#d5dcf0] bg-white p-4 shadow-sm">
      <h3 className="text-base font-semibold text-[#2b308f]">Modifier {course.reference}</h3>
      <p className="mb-3 text-xs text-[#5b6294]">
        Recherchez un chauffeur : ceux sans course en cours apparaissent en premier. Un chauffeur peut avoir
        jusqu’à deux courses ; la seconde est visible sur le téléphone, mais il doit terminer la première avant
        de la démarrer.
      </p>
      <div className="grid gap-3">
        <Field label="Chauffeur" htmlFor={`edit-driver-${course.id}`}>
          <DriverAssignSelect
            id={`edit-driver-${course.id}`}
            value={assignedDeviceId}
            roster={roster}
            courses={courses}
            exceptCourseId={course.id}
            emptyLabel="Non attribué"
            onChange={pickDriver}
          />
        </Field>
        {assignedDeviceId ? (
          <VehicleFields
            idPrefix={`edit-${course.id}`}
            vehicleType={vehicleType}
            vehiclePlate={vehiclePlate}
            onChange={(patch) => {
              if (patch.vehicleType) setVehicleType(patch.vehicleType);
              if (patch.vehiclePlate !== undefined) setVehiclePlate(patch.vehiclePlate);
            }}
          />
        ) : (
          <p className="text-xs text-[#5b6294]">Attribuez un chauffeur pour coller son véhicule.</p>
        )}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </div>
      <Button type="submit" className="mt-3 h-9" disabled={saving}>
        {saving ? "Enregistrement…" : "Enregistrer la course"}
      </Button>
    </form>
  );
}

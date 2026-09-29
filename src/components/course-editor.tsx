"use client";

import { useState, type FormEvent } from "react";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DriverAssignSelect, Field, VehicleFields } from "@/components/admin-fields";
import PlaceSuggest from "@/components/place-suggest";
import { DispatchNoteHint } from "@/components/dispatch-note";
import type { Course, CourseStop, VehicleType } from "@/lib/types";
import { MAX_TOUR_STOPS } from "@/lib/types";
import type { RosterDriver } from "@/lib/roster";
import { assignmentBlockedMessage, isDriverAtCapacity, liveJobsForDriver } from "@/lib/assignment";
import { COURSE_STATUS_LABEL, courseStops } from "@/lib/format";
import { CourseItinerary } from "@/components/course-itinerary";

export type CourseEditorSaveBody = {
  assignedDeviceId?: string | null;
  vehicleType?: VehicleType | null;
  vehiclePlate?: string | null;
  notes?: string;
  stops?: CourseStop[];
};

function copyStops(course: Course): CourseStop[] {
  const stops = courseStops(course).map((stop) => ({
    id: stop.id || crypto.randomUUID(),
    address: stop.address,
    lat: stop.lat,
    lng: stop.lng,
  }));
  return stops.length
    ? stops
    : [{ id: crypto.randomUUID(), address: "", lat: null, lng: null }];
}

export default function CourseEditor({
  course,
  roster,
  courses,
  onSave,
}: {
  course: Course;
  roster: RosterDriver[];
  courses: Course[];
  onSave: (id: string, body: CourseEditorSaveBody) => Promise<string | null>;
}) {
  const locked = course.status === "done" || course.status === "cancelled";
  const [editing, setEditing] = useState(false);
  const [assignedDeviceId, setAssignedDeviceId] = useState(course.assignedDeviceId ?? "");
  const [vehicleType, setVehicleType] = useState<VehicleType>(course.vehicleType ?? "van");
  const [vehiclePlate, setVehiclePlate] = useState(course.vehiclePlate ?? "");
  const [notes, setNotes] = useState(course.notes);
  const [stops, setStops] = useState<CourseStop[]>(() => copyStops(course));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function resetFromCourse() {
    setAssignedDeviceId(course.assignedDeviceId ?? "");
    setVehicleType(course.vehicleType ?? "van");
    setVehiclePlate(course.vehiclePlate ?? "");
    setNotes(course.notes);
    setStops(copyStops(course));
    setError("");
  }

  function closeEditor() {
    resetFromCourse();
    setEditing(false);
  }

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

  function patchStop(id: string, patch: Partial<CourseStop>) {
    setStops((current) => current.map((stop) => (stop.id === id ? { ...stop, ...patch } : stop)));
  }

  function addStop() {
    if (stops.length >= MAX_TOUR_STOPS) return;
    setStops((current) => [
      ...current,
      { id: crypto.randomUUID(), address: "", lat: null, lng: null },
    ]);
  }

  function removeStop(id: string) {
    if (stops.length <= 1) {
      setError("Gardez au moins une destination.");
      return;
    }
    setError("");
    setStops((current) => current.filter((stop) => stop.id !== id));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const nextStops = stops.filter((stop) => stop.address.trim());
    if (!nextStops.length) {
      setError("Gardez au moins une destination.");
      return;
    }
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
      notes,
      stops: nextStops,
    });
    if (message) {
      setError(message);
      setSaving(false);
      return;
    }
    setSaving(false);
    setEditing(false);
  }

  return (
    <div className="rounded-2xl border border-[#d5dcf0] bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-[#2b308f]">
            {course.reference}
            <span className="ml-2 text-sm font-normal text-[#5b6294]">
              {COURSE_STATUS_LABEL[course.status]}
            </span>
          </h3>
          <p className="mt-0.5 text-xs text-[#5b6294]">{course.clientName}</p>
        </div>
        {course.notes ? <DispatchNoteHint notes={course.notes} /> : null}
      </div>
      <div className="mt-3 mb-3">
        <CourseItinerary course={course} />
      </div>

      {locked ? (
        <p className="text-xs text-[#5b6294]">Cette course n’est plus modifiable.</p>
      ) : !editing ? (
        <Button type="button" className="h-9" onClick={() => setEditing(true)}>
          <Pencil className="size-4" />
          Modifier la course
        </Button>
      ) : (
        <form onSubmit={(event) => void submit(event)} className="border-t border-[#e8eefc] pt-3">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-[#2b308f]">Modifications</p>
            <Button type="button" variant="ghost" size="sm" className="h-8" onClick={closeEditor}>
              <X className="size-4" />
              Fermer
            </Button>
          </div>
          <p className="mb-3 text-xs text-[#5b6294]">
            Même après le départ, vous pouvez retirer ou ajouter une destination, et changer la note. Le
            chauffeur reçoit une alerte.
          </p>
          <div className="grid gap-3">
            <div className="grid gap-2">
              <div className="text-sm font-medium">Destinations</div>
              {stops.map((stop, index) => (
                <div key={stop.id} className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <Field label={`Destination ${index + 1}`} htmlFor={`edit-stop-${course.id}-${stop.id}`}>
                      <PlaceSuggest
                        id={`edit-stop-${course.id}-${stop.id}`}
                        required={index === 0}
                        value={stop.address}
                        placeholder={index === 0 ? "Première destination" : "Destination suivante"}
                        onChange={(address) => patchStop(stop.id, { address, lat: null, lng: null })}
                        onSelect={(place) =>
                          patchStop(stop.id, { address: place.label, lat: place.lat, lng: place.lng })
                        }
                      />
                    </Field>
                  </div>
                  {stops.length > 1 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="mt-6 size-8 shrink-0 text-[#5b6294]"
                      onClick={() => removeStop(stop.id)}
                      aria-label={`Retirer la destination ${index + 1}`}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  ) : null}
                </div>
              ))}
              <Button
                type="button"
                variant="secondary"
                className="h-9 rounded-xl"
                disabled={stops.length >= MAX_TOUR_STOPS}
                onClick={addStop}
              >
                <Plus className="size-4" />
                Ajouter une destination
              </Button>
            </div>

            <Field label="Note au chauffeur" htmlFor={`edit-notes-${course.id}`}>
              <textarea
                id={`edit-notes-${course.id}`}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                placeholder="Accès, colis, consignes — videz le champ pour retirer la note."
              />
            </Field>

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
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="submit" className="h-9" disabled={saving}>
              {saving ? "Enregistrement…" : "Enregistrer la course"}
            </Button>
            <Button type="button" variant="secondary" className="h-9" disabled={saving} onClick={closeEditor}>
              Annuler
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

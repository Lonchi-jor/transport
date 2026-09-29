"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DriverAssignSelect, VehicleFields } from "@/components/admin-fields";
import PlaceSuggest from "@/components/place-suggest";
import type { Course, CourseStop, VehicleType } from "@/lib/types";
import { MAX_TOUR_STOPS } from "@/lib/types";
import type { RosterDriver } from "@/lib/roster";
import { assignmentBlockedMessage, isDriverAtCapacity, liveJobsForDriver } from "@/lib/assignment";
import { COURSE_STATUS_LABEL, courseStops, destinationMark, destinationTitle } from "@/lib/format";
import { cn } from "@/lib/utils";

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

function TourBadge({
  tone,
  children,
}: {
  tone: "depart" | "stop";
  children?: string;
}) {
  return (
    <span
      className={cn(
        "mt-1.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white",
        tone === "depart" ? "bg-[#00a4e8]" : "bg-[#2b308f]",
      )}
    >
      {children || null}
    </span>
  );
}

export default function CourseEditor({
  course,
  roster,
  courses,
  open,
  onClose,
  onSave,
}: {
  course: Course;
  roster: RosterDriver[];
  courses: Course[];
  open: boolean;
  onClose: () => void;
  onSave: (id: string, body: CourseEditorSaveBody) => Promise<string | null>;
}) {
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

  const closeEditor = useCallback(() => {
    if (saving) return;
    resetFromCourse();
    onClose();
  }, [saving, course, onClose]);

  useEffect(() => {
    if (!open) return;
    resetFromCourse();
    // Fresh fields each time the panel opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, course.id, course.updatedAt]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") closeEditor();
    }
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, closeEditor]);

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
    const id = crypto.randomUUID();
    setStops((current) => [...current, { id, address: "", lat: null, lng: null }]);
    window.setTimeout(() => {
      document.getElementById(`edit-stop-${course.id}-${id}`)?.focus();
    }, 50);
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
    onClose();
  }

  const overlay =
    open && typeof document !== "undefined" ? (
      <div className="fixed inset-0 z-[85] flex items-end justify-center sm:items-center sm:p-4">
        <button
          type="button"
          aria-label="Fermer"
          className="absolute inset-0 bg-[#10143a]/45"
          onClick={closeEditor}
        />
        <form
          onSubmit={(event) => void submit(event)}
          className="relative z-10 flex max-h-[92dvh] w-full max-w-4xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"
        >
          <header className="flex items-start justify-between gap-3 border-b border-[#e8eefc] px-5 py-4">
            <div className="min-w-0">
              <div className="text-base font-semibold text-[#2b308f]">
                Modifier {course.reference}
              </div>
              <p className="mt-0.5 truncate text-sm text-[#5b6294]">
                {course.clientName} · {COURSE_STATUS_LABEL[course.status]}
              </p>
              <p className="mt-1 text-xs text-[#00a4e8]">
                Enregistrez : le chauffeur est prévenu tout de suite.
              </p>
            </div>
            <Button type="button" variant="ghost" size="icon" className="size-9 shrink-0" onClick={closeEditor}>
              <X className="size-4" />
            </Button>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
            <div className="grid gap-5 lg:grid-cols-5">
              <section className="rounded-2xl bg-[#f4f7fc] p-4 lg:col-span-3">
                <h4 className="text-sm font-semibold text-[#2b308f]">Trajet</h4>
                <p className="mt-0.5 text-xs text-[#5b6294]">Le départ reste en place. Changez seulement les destinations.</p>
                <ol className="relative mt-4 space-y-3">
                  <li className="flex items-start gap-3">
                    <TourBadge tone="depart">D</TourBadge>
                    <div className="min-w-0 flex-1 rounded-2xl border border-[#d5dcf0] bg-white px-3 py-2.5">
                      <div className="text-[11px] font-medium uppercase tracking-wide text-[#5b6294]">Départ</div>
                      <div className="mt-0.5 text-sm leading-snug text-[#1c2268]">{course.pickupAddress}</div>
                    </div>
                  </li>
                  {stops.map((stop, index) => (
                    <li key={stop.id} className="flex items-start gap-3">
                      <TourBadge tone="stop">{destinationMark(index, stops.length)}</TourBadge>
                      <div className="min-w-0 flex-1 rounded-2xl border border-[#d5dcf0] bg-white p-2.5 shadow-sm">
                        <div className="mb-1.5 flex items-center justify-between gap-2">
                          <div className="text-[11px] font-medium uppercase tracking-wide text-[#00a4e8]">
                            {destinationTitle(index, stops.length)}
                          </div>
                          {stops.length > 1 ? (
                            <button
                              type="button"
                              className="inline-flex size-7 items-center justify-center rounded-lg text-[#5b6294] hover:bg-[#f4f7fc] hover:text-red-600"
                              onClick={() => removeStop(stop.id)}
                              aria-label={`Retirer ${destinationTitle(index, stops.length)}`}
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          ) : null}
                        </div>
                        <PlaceSuggest
                          id={`edit-stop-${course.id}-${stop.id}`}
                          required={index === 0}
                          value={stop.address}
                          placeholder="Adresse de la destination"
                          onChange={(address) => patchStop(stop.id, { address, lat: null, lng: null })}
                          onSelect={(place) =>
                            patchStop(stop.id, { address: place.label, lat: place.lat, lng: place.lng })
                          }
                        />
                      </div>
                    </li>
                  ))}
                </ol>
                <Button
                  type="button"
                  variant="secondary"
                  className="mt-3 h-10 w-full rounded-xl border border-dashed border-[#2b308f]/25 bg-white"
                  disabled={stops.length >= MAX_TOUR_STOPS}
                  onClick={addStop}
                >
                  <Plus className="size-4" />
                  Ajouter une destination
                </Button>
              </section>

              <div className="grid content-start gap-4 lg:col-span-2">
                <section className="rounded-2xl bg-[#f4f7fc] p-4">
                  <h4 className="text-sm font-semibold text-[#2b308f]">Note au chauffeur</h4>
                  <p className="mt-0.5 text-xs text-[#5b6294]">Laissez vide s’il n’y a plus de consigne.</p>
                  <textarea
                    id={`edit-notes-${course.id}`}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={5}
                    className="mt-3 w-full rounded-2xl border border-[#d5dcf0] bg-white px-3 py-2.5 text-sm leading-5 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                    placeholder="Accès, colis, appel au client…"
                  />
                </section>
                <section className="rounded-2xl bg-[#f4f7fc] p-4">
                  <h4 className="text-sm font-semibold text-[#2b308f]">Chauffeur</h4>
                  <div className="mt-3 grid gap-3">
                    <DriverAssignSelect
                      id={`edit-driver-${course.id}`}
                      value={assignedDeviceId}
                      roster={roster}
                      courses={courses}
                      exceptCourseId={course.id}
                      emptyLabel="Non attribué"
                      onChange={pickDriver}
                    />
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
                      <p className="text-xs text-[#5b6294]">Choisissez un chauffeur pour coller son véhicule.</p>
                    )}
                  </div>
                </section>
              </div>
            </div>
            {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
          </div>

          <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-[#e8eefc] bg-white px-5 py-3">
            <Button type="button" variant="secondary" className="h-10 rounded-xl" disabled={saving} onClick={closeEditor}>
              Annuler
            </Button>
            <Button type="submit" className="h-10 rounded-xl px-5" disabled={saving}>
              {saving ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </footer>
        </form>
      </div>
    ) : null;

  if (!open) return null;
  return overlay ? createPortal(overlay, document.body) : null;
}

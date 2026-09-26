"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { MapPinned, Truck } from "lucide-react";
import "leaflet/dist/leaflet.css";
import AdminChrome from "@/components/admin-chrome";
import DispatchMap from "@/components/dispatch-map";
import { Field, VehicleFields } from "@/components/admin-fields";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import PlaceSuggest from "@/components/place-suggest";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Course, FleetSnapshot, VehicleType } from "@/lib/types";
import type { RosterDriver } from "@/lib/roster";
import { useAdminFleet } from "@/lib/use-admin-fleet";
import {
  COURSE_STATUS_LABEL,
  courseElapsedLabel,
  formatAge,
  formatKm,
  vehicleLine,
} from "@/lib/format";

type Props = {
  googleMapsApiKey: string;
};

const emptyForm = {
  clientName: "",
  clientPhone: "",
  pickupAddress: "",
  dropoffAddress: "",
  pickupLat: null as number | null,
  pickupLng: null as number | null,
  dropoffLat: null as number | null,
  dropoffLng: null as number | null,
  notes: "",
  scheduledAt: "",
  assignedDeviceId: "",
  vehicleType: "van" as VehicleType,
  vehiclePlate: "",
  vehicleLabel: "",
};

export default function AdminDashboard({ googleMapsApiKey }: Props) {
  const { devices, courses, roster, now, online, liveById, applySnapshot } = useAdminFleet();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [mapOpen, setMapOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const selectedCourse = courses.find((course) => course.id === selectedCourseId) ?? null;

  function fillVehicleFromDriver(driverId: string, current = form) {
    const driver = roster.find((item) => item.id === driverId);
    if (!driver) {
      return {
        ...current,
        assignedDeviceId: "",
        vehicleType: "van" as VehicleType,
        vehiclePlate: "",
        vehicleLabel: "",
      };
    }
    return {
      ...current,
      assignedDeviceId: driver.id,
      vehicleType: driver.vehicleType,
      vehiclePlate: driver.vehiclePlate ?? "",
      vehicleLabel: driver.vehicleLabel ?? "",
    };
  }

  async function createJob(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          scheduledAt: form.scheduledAt || null,
          assignedDeviceId: form.assignedDeviceId || null,
          vehicleType: form.assignedDeviceId ? form.vehicleType : null,
          vehiclePlate: form.assignedDeviceId ? form.vehiclePlate : null,
          vehicleLabel: form.assignedDeviceId ? form.vehicleLabel : null,
        }),
      });
      const data = (await res.json()) as FleetSnapshot & { error?: string };
      if (!res.ok) {
        setError(data.error || "Impossible de créer la course.");
        return;
      }
      applySnapshot(data);
      setSelectedCourseId(data.courses?.[0]?.id ?? null);
      setForm(emptyForm);
    } catch {
      setError("Réseau indisponible.");
    } finally {
      setSaving(false);
    }
  }

  async function patchCourse(
    id: string,
    body: {
      assignedDeviceId?: string | null;
      status?: string;
      vehicleType?: VehicleType | null;
      vehiclePlate?: string | null;
      vehicleLabel?: string | null;
    },
  ) {
    const res = await fetch(`/api/courses/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    applySnapshot((await res.json()) as Parameters<typeof applySnapshot>[0]);
  }

  return (
    <div className="min-h-dvh bg-[#f4f7fc] text-[#1c2268]">
      <AdminChrome
        active="dispatch"
        online={online}
        title="Tableau de bord dispatch"
        subtitle="Courses, carte et attribution"
        extra={
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="rounded-xl"
            onClick={() => {
              setSelectedId(null);
              setMapOpen(true);
            }}
          >
            <MapPinned className="size-4" />
            Carte
          </Button>
        }
      />

      <main className="mx-auto grid max-w-[1400px] gap-5 px-4 py-5 sm:px-6 xl:grid-cols-[340px_minmax(0,1fr)]">
        <section className="space-y-5">
          <Link
            href="/admin/chauffeurs"
            className="flex items-center justify-between rounded-2xl border border-[#00a4e8]/30 bg-[#e7f6fd] px-4 py-3 shadow-sm transition hover:border-[#00a4e8]"
          >
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl bg-white text-[#00a4e8]">
                <Truck className="size-5" />
              </span>
              <div>
                <div className="text-sm font-semibold text-[#2b308f]">Chauffeurs</div>
                <div className="text-xs text-[#5b6294]">
                  {roster.length} enregistré{roster.length > 1 ? "s" : ""} · fiches, véhicules, PIN, historique
                </div>
              </div>
            </div>
            <span className="text-xs font-medium text-[#00a4e8]">Ouvrir →</span>
          </Link>

          <form onSubmit={createJob} className="rounded-2xl border border-[#d5dcf0] bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-base font-semibold text-[#2b308f]">Nouvelle course</h2>
            <div className="grid gap-3">
              <Field label="Client" htmlFor="client">
                <Input
                  id="client"
                  required
                  value={form.clientName}
                  onChange={(e) => setForm({ ...form, clientName: e.target.value })}
                  placeholder="Nom du client"
                />
              </Field>
              <Field label="Téléphone" htmlFor="phone">
                <Input
                  id="phone"
                  value={form.clientPhone}
                  onChange={(e) => setForm({ ...form, clientPhone: e.target.value })}
                  placeholder="+237 6…"
                />
              </Field>
              <Field label="Enlèvement" htmlFor="pickup">
                <PlaceSuggest
                  id="pickup"
                  required
                  value={form.pickupAddress}
                  placeholder="Tapez une adresse, puis choisissez une suggestion"
                  onChange={(pickupAddress) =>
                    setForm({ ...form, pickupAddress, pickupLat: null, pickupLng: null })
                  }
                  onSelect={(place) =>
                    setForm({
                      ...form,
                      pickupAddress: place.label,
                      pickupLat: place.lat,
                      pickupLng: place.lng,
                    })
                  }
                />
              </Field>
              <Field label="Livraison" htmlFor="dropoff">
                <PlaceSuggest
                  id="dropoff"
                  required
                  value={form.dropoffAddress}
                  placeholder="Adresse d’arrivée"
                  onChange={(dropoffAddress) =>
                    setForm({ ...form, dropoffAddress, dropoffLat: null, dropoffLng: null })
                  }
                  onSelect={(place) =>
                    setForm({
                      ...form,
                      dropoffAddress: place.label,
                      dropoffLat: place.lat,
                      dropoffLng: place.lng,
                    })
                  }
                />
              </Field>
              <Field label="Heure prévue" htmlFor="when">
                <Input
                  id="when"
                  type="datetime-local"
                  value={form.scheduledAt}
                  onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })}
                />
              </Field>
              <Field label="Notes" htmlFor="notes">
                <textarea
                  id="notes"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={2}
                  className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  placeholder="Colis, accès, consignes…"
                />
              </Field>
              <Field label="Chauffeur" htmlFor="driver">
                <select
                  id="driver"
                  value={form.assignedDeviceId}
                  onChange={(e) => setForm(fillVehicleFromDriver(e.target.value))}
                  className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none"
                >
                  <option value="">Attribuer plus tard</option>
                  {roster.map((driver) => (
                    <option key={driver.id} value={driver.id}>
                      {driver.callSign} — {driver.driverName}
                      {liveById.has(driver.id) ? " (en ligne)" : ""}
                    </option>
                  ))}
                </select>
              </Field>
              {form.assignedDeviceId ? (
                <div className="space-y-2">
                  <VehicleFields
                    idPrefix="job"
                    vehicleType={form.vehicleType}
                    vehiclePlate={form.vehiclePlate}
                    vehicleLabel={form.vehicleLabel}
                    onChange={(patch) => setForm({ ...form, ...patch })}
                  />
                  <Link
                    href={`/admin/chauffeurs?id=${encodeURIComponent(form.assignedDeviceId)}`}
                    className="text-xs font-medium text-[#00a4e8] hover:underline"
                  >
                    Voir la fiche de ce chauffeur
                  </Link>
                </div>
              ) : (
                <p className="text-xs text-[#5b6294]">
                  Choisissez le chauffeur : son véhicule se remplit tout seul.{" "}
                  <Link href="/admin/chauffeurs" className="text-[#00a4e8] hover:underline">
                    Gérer les chauffeurs
                  </Link>
                </p>
              )}
              {error ? <p className="text-sm text-red-600">{error}</p> : null}
              <Button type="submit" disabled={saving} className="h-10">
                {saving ? "Envoi…" : "Donner la course"}
              </Button>
            </div>
          </form>
        </section>

        <section className="space-y-5">
          <DispatchMap
            googleMapsApiKey={googleMapsApiKey}
            devices={devices}
            courses={courses}
            now={now}
            selectedId={selectedId}
            onSelect={setSelectedId}
            open={mapOpen}
            onOpenChange={setMapOpen}
          />

          {selectedCourse ? (
            <CourseEditor
              key={`${selectedCourse.id}-${selectedCourse.updatedAt}`}
              course={selectedCourse}
              roster={roster}
              onSave={(id, body) => patchCourse(id, body)}
            />
          ) : null}

          <div className="overflow-hidden rounded-2xl border border-[#d5dcf0] bg-white shadow-sm">
            <div className="border-b border-[#d5dcf0] px-4 py-3">
              <h2 className="text-base font-semibold text-[#2b308f]">Toutes les courses</h2>
              <p className="text-xs text-[#5b6294]">
                Chaque course garde chauffeur, véhicule, trajet et durées.
              </p>
            </div>
            {courses.length === 0 ? (
              <p className="px-4 py-10 text-sm text-[#5b6294]">Aucune course. Créez-en une à gauche.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="bg-[#f4f7fc] text-xs uppercase tracking-wide text-[#5b6294]">
                    <tr>
                      <th className="px-4 py-2 font-medium">Réf.</th>
                      <th className="px-4 py-2 font-medium">Trajet</th>
                      <th className="px-4 py-2 font-medium">Chauffeur / véhicule</th>
                      <th className="px-4 py-2 font-medium">Statut</th>
                      <th className="px-4 py-2 font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {courses.map((course) => {
                      const elapsed = courseElapsedLabel(course, now);
                      return (
                        <tr
                          key={course.id}
                          className={`cursor-pointer border-t border-[#d5dcf0] align-top hover:bg-[#f4f7fc] ${
                            course.id === selectedCourseId ? "bg-[#eef3fb]" : ""
                          }`}
                          onClick={() => setSelectedCourseId(course.id)}
                        >
                          <td className="w-[200px] px-4 py-3">
                            <div className="font-semibold text-[#2b308f]">{course.reference}</div>
                            <div className="mt-1 text-sm leading-snug">{course.clientName}</div>
                            {course.clientPhone ? (
                              <div className="mt-0.5 text-xs text-[#5b6294]">{course.clientPhone}</div>
                            ) : null}
                            <div className="mt-2 flex flex-wrap gap-1">
                              {course.bnNumber ? (
                                <span className="rounded-full bg-[#eef3fb] px-2 py-0.5 text-[11px] font-medium text-[#2b308f]">
                                  BN {course.bnNumber}
                                </span>
                              ) : null}
                              {course.hasDeliveryScan ? (
                                <span className="rounded-full bg-[#e7f6fd] px-2 py-0.5 text-[11px] font-medium text-[#00a4e8]">
                                  BL scanné
                                </span>
                              ) : null}
                            </div>
                          </td>
                          <td className="max-w-[340px] px-4 py-3">
                            <div className="text-[11px] font-medium uppercase tracking-wide text-[#5b6294]">Départ</div>
                            <div className="text-sm leading-snug">{course.pickupAddress}</div>
                            <div className="mt-2 text-[11px] font-medium uppercase tracking-wide text-[#00a4e8]">Arrivée</div>
                            <div className="text-sm leading-snug">{course.dropoffAddress}</div>
                            <div className="mt-2 flex flex-col gap-0.5 text-xs text-[#5b6294]">
                              {formatKm(course.distanceMeters) ? <span>{formatKm(course.distanceMeters)}</span> : null}
                              {elapsed ? (
                                <span className="font-medium text-[#2b308f]">{elapsed}</span>
                              ) : (
                                <span>Pas encore démarrée</span>
                              )}
                            </div>
                            {course.notes ? <div className="mt-1 text-xs text-[#5b6294]">{course.notes}</div> : null}
                          </td>
                          <td className="px-4 py-3">
                            <select
                              value={course.assignedDeviceId ?? ""}
                              onChange={(e) =>
                                void patchCourse(course.id, {
                                  assignedDeviceId: e.target.value || null,
                                })
                              }
                              className="h-8 max-w-52 rounded-lg border border-input bg-transparent px-2 text-xs"
                              onClick={(event) => event.stopPropagation()}
                            >
                              <option value="">Non attribué</option>
                              {roster.map((driver) => (
                                <option key={driver.id} value={driver.id}>
                                  {driver.callSign} — {driver.driverName}
                                </option>
                              ))}
                            </select>
                            <div className="mt-1 text-xs text-[#2b308f]">{vehicleLine(course)}</div>
                            {course.assignedDeviceId ? (
                              <Link
                                href={`/admin/chauffeurs?id=${encodeURIComponent(course.assignedDeviceId)}`}
                                className="mt-1 inline-block text-xs text-[#00a4e8] hover:underline"
                                onClick={(event) => event.stopPropagation()}
                              >
                                Fiche chauffeur
                              </Link>
                            ) : null}
                            {course.assignedCallSign ? (
                              <div className="mt-1 text-xs text-[#5b6294]">
                                {course.assignedCallSign} · {formatAge(course.updatedAt, now)}
                              </div>
                            ) : null}
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant={course.status === "open" ? "outline" : "secondary"}>
                              {COURSE_STATUS_LABEL[course.status]}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col items-start gap-1">
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setSelectedCourseId(course.id);
                                }}
                              >
                                Modifier
                              </Button>
                              {course.hasDeliveryScan ? (
                                <a
                                  href={`/api/courses/${course.id}/delivery`}
                                  download={`${course.reference}-bon-livraison.jpg`}
                                  className={cn(
                                    buttonVariants({ size: "sm" }),
                                    "h-8 rounded-lg",
                                  )}
                                  onClick={(event) => event.stopPropagation()}
                                >
                                  Télécharger le BL
                                </a>
                              ) : course.status === "done" ? (
                                <span className="text-xs text-[#5b6294]">BL manquant</span>
                              ) : null}
                              {course.status !== "cancelled" && course.status !== "done" ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    void patchCourse(course.id, { status: "cancelled" });
                                  }}
                                >
                                  Annuler
                                </Button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

function CourseEditor({
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
        <Field label="Chauffeur" htmlFor="edit-driver">
          <select
            id="edit-driver"
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
            idPrefix="edit"
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

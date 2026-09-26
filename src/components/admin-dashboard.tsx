"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { ClipboardList, MapPinned, Truck } from "lucide-react";
import "leaflet/dist/leaflet.css";
import AdminChrome from "@/components/admin-chrome";
import DispatchMap from "@/components/dispatch-map";
import CourseEditor from "@/components/course-editor";
import { DispatchNoteHint } from "@/components/dispatch-note";
import { Field, PhoneLink, VehicleFields } from "@/components/admin-fields";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import PlaceSuggest from "@/components/place-suggest";
import type { FleetSnapshot, VehicleType } from "@/lib/types";
import { useAdminFleet } from "@/lib/use-admin-fleet";
import { ensureDispatcherId } from "@/lib/dispatcher";
import { COURSE_STATUS_LABEL, vehicleLine } from "@/lib/format";

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
};

export default function AdminDashboard({ googleMapsApiKey }: Props) {
  const { devices, courses, roster, now, online, liveById, liveJobs, alerts, applySnapshot, markAlertsRead } =
    useAdminFleet();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [mapOpen, setMapOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const selectedCourse = courses.find((course) => course.id === selectedCourseId) ?? null;
  const assignedDriver = roster.find((item) => item.id === form.assignedDeviceId) ?? null;

  function fillVehicleFromDriver(driverId: string, current = form) {
    const driver = roster.find((item) => item.id === driverId);
    if (!driver) {
      return {
        ...current,
        assignedDeviceId: "",
        vehicleType: "van" as VehicleType,
        vehiclePlate: "",
      };
    }
    return {
      ...current,
      assignedDeviceId: driver.id,
      vehicleType: driver.vehicleType,
      vehiclePlate: driver.vehiclePlate ?? "",
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
          createdByAdminId: ensureDispatcherId(),
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
        alerts={alerts}
        onMarkAlertsRead={(ids) => void markAlertsRead(ids)}
        onOpenAlert={(item) => setSelectedCourseId(item.courseId)}
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
            href="/admin/courses"
            className="flex items-center justify-between rounded-2xl border border-[#2b308f]/20 bg-white px-4 py-3 shadow-sm transition hover:border-[#2b308f]"
          >
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl bg-[#eef3fb] text-[#2b308f]">
                <ClipboardList className="size-5" />
              </span>
              <div>
                <div className="text-sm font-semibold text-[#2b308f]">Courses</div>
                <div className="text-xs text-[#5b6294]">
                  {courses.length} enregistrée{courses.length > 1 ? "s" : ""} · filtre par chauffeur, statut, dates
                </div>
              </div>
            </div>
            <span className="text-xs font-medium text-[#00a4e8]">Ouvrir →</span>
          </Link>
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
                    onChange={(patch) => setForm({ ...form, ...patch })}
                  />
                  {assignedDriver?.phone ? (
                    <p className="text-xs text-[#5b6294]">
                      Téléphone :{" "}
                      <PhoneLink phone={assignedDriver.phone} className="font-medium text-[#00a4e8] hover:underline" />
                    </p>
                  ) : null}
                  <div className="flex flex-wrap gap-3">
                    <Link
                      href={`/admin/chauffeurs?id=${encodeURIComponent(form.assignedDeviceId)}`}
                      className="text-xs font-medium text-[#00a4e8] hover:underline"
                    >
                      Fiche chauffeur
                    </Link>
                    <Link
                      href={`/admin/courses?chauffeur=${encodeURIComponent(form.assignedDeviceId)}`}
                      className="text-xs font-medium text-[#00a4e8] hover:underline"
                    >
                      Ses courses
                    </Link>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-[#5b6294]">
                  Choisissez le chauffeur : son véhicule se remplit tout seul.{" "}
                  <Link href="/admin/chauffeurs" className="text-[#00a4e8] hover:underline">
                    Gérer les chauffeurs
                  </Link>
                </p>
              )}
              <Field label="Note au chauffeur" htmlFor="notes">
                <textarea
                  id="notes"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={3}
                  className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  placeholder="Accès, colis, consignes — le chauffeur lira ceci sur son téléphone."
                />
                <p className="text-xs text-[#5b6294]">
                  Cette note lui est adressée. Elle s’affiche en grand sur le portable ; il doit la lire avant de démarrer.
                </p>
              </Field>
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
            <div className="flex items-start justify-between gap-3 border-b border-[#d5dcf0] px-4 py-3">
              <div>
                <h2 className="text-base font-semibold text-[#2b308f]">Courses en cours</h2>
                <p className="text-xs text-[#5b6294]">L’historique complet est dans Courses.</p>
              </div>
              <Link href="/admin/courses" className="text-xs font-medium text-[#00a4e8] hover:underline">
                Toutes les courses
              </Link>
            </div>
            {liveJobs.length === 0 ? (
              <p className="px-4 py-8 text-sm text-[#5b6294]">Aucune course active. Créez-en une à gauche.</p>
            ) : (
              <ul className="divide-y divide-[#d5dcf0]">
                {liveJobs.map((course) => (
                  <li key={course.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedCourseId(course.id)}
                      className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left hover:bg-[#f4f7fc]"
                    >
                      <div>
                        <div className="font-semibold text-[#2b308f]">{course.reference}</div>
                        <div className="text-sm">{course.clientName}</div>
                        <div className="mt-1 text-xs text-[#5b6294]">
                          {course.pickupAddress} → {course.dropoffAddress}
                        </div>
                        <div className="mt-1 text-xs text-[#2b308f]">
                          {course.assignedCallSign
                            ? `${course.assignedCallSign} · ${vehicleLine(course)}`
                            : "Non attribué"}
                        </div>
                        {course.assignedDriverPhone ? (
                          <div className="mt-1 text-xs text-[#00a4e8]">{course.assignedDriverPhone}</div>
                        ) : null}
                        {course.notes ? (
                          <div className="mt-2 text-left">
                            <DispatchNoteHint notes={course.notes} />
                          </div>
                        ) : null}
                      </div>
                      <Badge variant={course.status === "open" ? "outline" : "secondary"}>
                        {COURSE_STATUS_LABEL[course.status]}
                      </Badge>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

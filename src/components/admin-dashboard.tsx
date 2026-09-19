"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { ClipboardList, Radio, Truck } from "lucide-react";
import "leaflet/dist/leaflet.css";
import BrandLogo from "@/components/brand-logo";
import FleetMap from "@/components/fleet-map";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import PlaceSuggest from "@/components/place-suggest";
import type { Course, FleetDevice, FleetSnapshot } from "@/lib/types";
import { COURSE_STATUS_LABEL, activeCourses, courseToMapRoute, formatAge, formatKm, formatMinutes, kph, statusLabel } from "@/lib/format";

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
};

export default function AdminDashboard({ googleMapsApiKey }: Props) {
  const [devices, setDevices] = useState<FleetDevice[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [now, setNow] = useState(0);
  const [online, setOnline] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const applySnapshot = useCallback((snapshot: FleetSnapshot) => {
    setDevices(snapshot.devices);
    setCourses(snapshot.courses ?? []);
    setNow(snapshot.now);
    setOnline(true);
  }, []);

  useEffect(() => {
    const source = new EventSource("/api/fleet/stream");
    source.onmessage = (event) => {
      try {
        applySnapshot(JSON.parse(event.data) as FleetSnapshot);
      } catch {
        /* ignore */
      }
    };
    source.onerror = () => setOnline(false);
    return () => source.close();
  }, [applySnapshot]);

  const drivers = useMemo(
    () => devices.filter((d) => d.role === "driver"),
    [devices],
  );
  const liveJobs = useMemo(() => activeCourses(courses), [courses]);
  const mapRoute = courseToMapRoute(
    courses.find((course) => course.id === selectedCourseId) ??
      liveJobs.find((course) => course.routePath.length > 0) ??
      null,
  );

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

  async function patchCourse(id: string, body: { assignedDeviceId?: string | null; status?: string }) {
    const res = await fetch(`/api/courses/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as FleetSnapshot;
    applySnapshot(data);
  }

  async function startDemo() {
    const res = await fetch("/api/fleet/demo", { method: "POST" });
    applySnapshot((await res.json()) as FleetSnapshot);
  }

  return (
    <div className="min-h-dvh bg-[#f4f7fc] text-[#1c2268]">
      <header className="border-b border-[#d5dcf0] bg-white">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-6 py-3">
          <div className="flex items-center gap-4">
            <BrandLogo className="h-12 w-auto max-w-[220px] object-contain" />
            <div className="hidden border-l border-[#d5dcf0] pl-4 lg:block">
              <div className="text-sm font-semibold text-[#2b308f]">Tableau de bord dispatch</div>
              <div className="text-xs text-[#5b6294]">Attribuez les courses aux chauffeurs CCMM</div>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="inline-flex items-center gap-2 rounded-full bg-[#eef3fb] px-3 py-1 font-medium">
              <span className={`size-2 rounded-full ${online ? "bg-[#00a4e8]" : "bg-red-500"}`} />
              {online ? "Radio live" : "Hors ligne"}
            </span>
            <Link href="/" className="text-[#00a4e8] underline-offset-2 hover:underline">
              App chauffeur
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1400px] gap-5 px-6 py-5 xl:grid-cols-[340px_minmax(0,1fr)]">
        <section className="space-y-5">
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Chauffeurs" value={String(drivers.length)} icon={<Truck className="size-4" />} />
            <Stat label="Courses actives" value={String(liveJobs.length)} icon={<ClipboardList className="size-4" />} />
            <Stat label="En ligne" value={online ? "OK" : "—"} icon={<Radio className="size-4" />} />
          </div>

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
                  onChange={(e) => setForm({ ...form, assignedDeviceId: e.target.value })}
                  className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none"
                >
                  <option value="">Attribuer plus tard</option>
                  {drivers.map((driver) => (
                    <option key={driver.id} value={driver.id}>
                      {driver.callSign} — {driver.driverName}
                    </option>
                  ))}
                </select>
              </Field>
              {error ? <p className="text-sm text-red-600">{error}</p> : null}
              <Button type="submit" disabled={saving} className="h-10">
                {saving ? "Envoi…" : "Donner la course"}
              </Button>
              {drivers.length === 0 ? (
                <p className="text-xs text-[#5b6294]">
                  Aucun chauffeur connecté. Ouvrez l’app téléphone ou{" "}
                  <button type="button" className="text-[#00a4e8] underline" onClick={() => void startDemo()}>
                    lancez la flotte démo
                  </button>
                  .
                </p>
              ) : null}
            </div>
          </form>

          <div className="rounded-2xl border border-[#d5dcf0] bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-base font-semibold text-[#2b308f]">Chauffeurs</h2>
            {drivers.length === 0 ? (
              <p className="text-sm text-[#5b6294]">Personne sur la radio pour le moment.</p>
            ) : (
              <ul className="space-y-2">
                {drivers.map((driver) => {
                  const jobs = liveJobs.filter((c) => c.assignedDeviceId === driver.id);
                  return (
                    <li key={driver.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(driver.id)}
                        className="flex w-full items-start justify-between rounded-xl border border-[#d5dcf0] px-3 py-2 text-left hover:bg-[#f4f7fc]"
                      >
                        <div>
                          <div className="font-semibold">{driver.callSign}</div>
                          <div className="text-xs text-[#5b6294]">{driver.driverName}</div>
                        </div>
                        <div className="text-right text-xs">
                          <div>{statusLabel(driver, now)}</div>
                          <div className="text-[#5b6294]">
                            {jobs.length} course{jobs.length > 1 ? "s" : ""}
                            {kph(driver.speedMps) != null ? ` · ${kph(driver.speedMps)} km/h` : ""}
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        <section className="space-y-5">
          <div className="h-[360px] overflow-hidden rounded-2xl border border-[#d5dcf0] bg-white shadow-sm">
            <FleetMap
              googleMapsApiKey={googleMapsApiKey}
              devices={devices}
              now={now}
              selectedId={selectedId}
              onSelect={setSelectedId}
              follow={null}
              stickToMe={false}
              recenterKey={0}
              onUserPan={() => undefined}
              selfId={null}
              route={mapRoute}
            />
          </div>

          <div className="overflow-hidden rounded-2xl border border-[#d5dcf0] bg-white shadow-sm">
            <div className="border-b border-[#d5dcf0] px-4 py-3">
              <h2 className="text-base font-semibold text-[#2b308f]">Courses</h2>
              <p className="text-xs text-[#5b6294]">Le chauffeur voit la course tout de suite sur son téléphone.</p>
            </div>
            {courses.length === 0 ? (
              <p className="px-4 py-10 text-sm text-[#5b6294]">Aucune course. Créez-en une à gauche.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="bg-[#f4f7fc] text-xs uppercase tracking-wide text-[#5b6294]">
                    <tr>
                      <th className="px-4 py-2 font-medium">Réf.</th>
                      <th className="px-4 py-2 font-medium">Trajet</th>
                      <th className="px-4 py-2 font-medium">Chauffeur</th>
                      <th className="px-4 py-2 font-medium">Statut</th>
                      <th className="px-4 py-2 font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {courses.map((course) => (
                      <tr
                        key={course.id}
                        className="cursor-pointer border-t border-[#d5dcf0] align-top hover:bg-[#f4f7fc]"
                        onClick={() => setSelectedCourseId(course.id)}
                      >
                        <td className="px-4 py-3">
                          <div className="font-semibold">{course.reference}</div>
                          <div className="text-xs text-[#5b6294]">{course.clientName}</div>
                          {course.clientPhone ? (
                            <div className="text-xs text-[#5b6294]">{course.clientPhone}</div>
                          ) : null}
                          {course.bnNumber ? (
                            <div className="mt-1 text-xs font-medium text-[#2b308f]">BN {course.bnNumber}</div>
                          ) : null}
                        </td>
                        <td className="px-4 py-3">
                          <div>{course.pickupAddress}</div>
                          <div className="text-[#00a4e8]">→ {course.dropoffAddress}</div>
                          {formatKm(course.distanceMeters) ? (
                            <div className="mt-1 text-xs text-[#5b6294]">
                              {formatKm(course.distanceMeters)} · {formatMinutes(course.durationSeconds)}
                            </div>
                          ) : null}
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
                            className="h-8 max-w-48 rounded-lg border border-input bg-transparent px-2 text-xs"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <option value="">Non attribué</option>
                            {drivers.map((driver) => (
                              <option key={driver.id} value={driver.id}>
                                {driver.callSign} — {driver.driverName}
                              </option>
                            ))}
                          </select>
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
                        </td>
                      </tr>
                    ))}
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

function Stat({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return (
    <div className="rounded-2xl border border-[#d5dcf0] bg-white p-3 shadow-sm">
      <div className="text-[#00a4e8]">{icon}</div>
      <div className="mt-1 text-xl font-semibold text-[#2b308f]">{value}</div>
      <div className="text-[11px] text-[#5b6294]">{label}</div>
    </div>
  );
}

function Field({
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

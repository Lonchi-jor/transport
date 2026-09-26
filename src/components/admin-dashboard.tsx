"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { ClipboardList, MapPinned, Radio, Trash2, Truck, UserPlus } from "lucide-react";
import "leaflet/dist/leaflet.css";
import BrandLogo from "@/components/brand-logo";
import DispatchMap from "@/components/dispatch-map";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import PlaceSuggest from "@/components/place-suggest";
import type { Course, FleetDevice, FleetSnapshot } from "@/lib/types";
import { VEHICLE_META, VEHICLE_TYPES, type VehicleType } from "@/lib/types";
import { COURSE_STATUS_LABEL, activeCourses, courseElapsedLabel, formatAge, formatKm, kph, statusLabel } from "@/lib/format";

type RosterDriver = {
  id: string;
  callSign: string;
  driverName: string;
  vehicleType: VehicleType;
  pin?: string;
};

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

const emptyDriver = {
  callSign: "",
  driverName: "",
  vehicleType: "van" as VehicleType,
  pin: "",
};

export default function AdminDashboard({ googleMapsApiKey }: Props) {
  const [devices, setDevices] = useState<FleetDevice[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [roster, setRoster] = useState<RosterDriver[]>([]);
  const [createdNotice, setCreatedNotice] = useState("");
  const [now, setNow] = useState(0);
  const [online, setOnline] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [mapOpen, setMapOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [driverForm, setDriverForm] = useState(emptyDriver);
  const [error, setError] = useState("");
  const [driverError, setDriverError] = useState("");
  const [saving, setSaving] = useState(false);
  const [savingDriver, setSavingDriver] = useState(false);

  const applySnapshot = useCallback((snapshot: FleetSnapshot) => {
    setDevices(snapshot.devices);
    setCourses(snapshot.courses ?? []);
    setNow(snapshot.now);
    setOnline(true);
    if (snapshot.drivers) {
      setRoster((prev) =>
        snapshot.drivers!.map((driver) => ({
          ...driver,
          pin: driver.pin ?? prev.find((item) => item.id === driver.id)?.pin,
        })),
      );
    }
  }, []);

  useEffect(() => {
    void fetch("/api/drivers")
      .then((res) => res.json())
      .then((data: FleetSnapshot & { drivers?: typeof roster }) => {
        applySnapshot(data);
        if (data.drivers) setRoster(data.drivers);
      })
      .catch(() => undefined);
  }, [applySnapshot]);

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

  const liveJobs = useMemo(() => activeCourses(courses), [courses]);
  const liveById = useMemo(() => {
    const map = new Map<string, FleetDevice>();
    for (const device of devices) {
      if (device.role === "driver") map.set(device.id, device);
    }
    return map;
  }, [devices]);
  const onlineCount = useMemo(
    () => roster.filter((driver) => liveById.has(driver.id)).length,
    [roster, liveById],
  );

  async function createDriver(event: FormEvent) {
    event.preventDefault();
    setSavingDriver(true);
    setDriverError("");
    try {
      const res = await fetch("/api/drivers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(driverForm),
      });
      const data = (await res.json()) as FleetSnapshot & {
        drivers?: RosterDriver[];
        driver?: RosterDriver;
        error?: string;
      };
      if (!res.ok) {
        setDriverError(data.error || "Impossible de créer le chauffeur.");
        return;
      }
      applySnapshot(data);
      if (data.drivers) setRoster(data.drivers);
      const created = data.driver;
      if (created) {
        setCreatedNotice(
          `${created.callSign} · PIN ${created.pin} — donnez ces infos au chauffeur pour le téléphone.`,
        );
      }
      setDriverForm(emptyDriver);
    } catch {
      setDriverError("Réseau indisponible.");
    } finally {
      setSavingDriver(false);
    }
  }

  async function removeDriver(id: string) {
    const res = await fetch(`/api/drivers/${id}`, { method: "DELETE" });
    const data = (await res.json()) as FleetSnapshot & { drivers?: typeof roster };
    applySnapshot(data);
    if (data.drivers) setRoster(data.drivers);
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

  return (
    <div className="min-h-dvh bg-[#f4f7fc] text-[#1c2268]">
      <header className="border-b border-[#d5dcf0] bg-white">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-6 py-3">
          <div className="flex items-center gap-4">
            <BrandLogo className="h-12 w-auto max-w-[220px] object-contain" />
            <div className="hidden border-l border-[#d5dcf0] pl-4 lg:block">
              <div className="text-sm font-semibold text-[#2b308f]">Tableau de bord dispatch</div>
              <div className="text-xs text-[#5b6294]">Créez les chauffeurs, puis donnez les courses</div>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="inline-flex items-center gap-2 rounded-full bg-[#eef3fb] px-3 py-1 font-medium">
              <span className={`size-2 rounded-full ${online ? "bg-[#00a4e8]" : "bg-red-500"}`} />
              {online ? "Radio live" : "Hors ligne"}
            </span>
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
            <Link href="/" className="text-[#00a4e8] underline-offset-2 hover:underline">
              App chauffeur
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1400px] gap-5 px-6 py-5 xl:grid-cols-[340px_minmax(0,1fr)]">
        <section className="space-y-5">
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Chauffeurs" value={String(roster.length)} icon={<Truck className="size-4" />} />
            <Stat label="Courses actives" value={String(liveJobs.length)} icon={<ClipboardList className="size-4" />} />
            <Stat label="En ligne" value={String(onlineCount)} icon={<Radio className="size-4" />} />
          </div>

          <form onSubmit={createDriver} className="rounded-2xl border border-[#d5dcf0] bg-white p-4 shadow-sm">
            <h2 className="mb-1 flex items-center gap-2 text-base font-semibold text-[#2b308f]">
              <UserPlus className="size-4 text-[#00a4e8]" />
              Nouveau chauffeur
            </h2>
            <p className="mb-3 text-xs leading-5 text-[#5b6294]">
              Créez la fiche ici. Le chauffeur se connecte ensuite sur le téléphone uniquement avec l’indicatif et le PIN.
            </p>
            <div className="grid gap-3">
              <Field label="Indicatif radio" htmlFor="callSign">
                <Input
                  id="callSign"
                  required
                  value={driverForm.callSign}
                  onChange={(e) => setDriverForm({ ...driverForm, callSign: e.target.value.toUpperCase() })}
                  placeholder="ME-01"
                  autoCapitalize="characters"
                />
              </Field>
              <Field label="Nom du chauffeur" htmlFor="driverName">
                <Input
                  id="driverName"
                  required
                  value={driverForm.driverName}
                  onChange={(e) => setDriverForm({ ...driverForm, driverName: e.target.value })}
                  placeholder="Jean Mbarga"
                />
              </Field>
              <Field label="Véhicule" htmlFor="vehicleType">
                <select
                  id="vehicleType"
                  value={driverForm.vehicleType}
                  onChange={(e) =>
                    setDriverForm({ ...driverForm, vehicleType: e.target.value as VehicleType })
                  }
                  className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none"
                >
                  {VEHICLE_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {VEHICLE_META[type].label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Code PIN (4 à 6 chiffres)" htmlFor="pin">
                <Input
                  id="pin"
                  value={driverForm.pin}
                  onChange={(e) =>
                    setDriverForm({ ...driverForm, pin: e.target.value.replace(/\D/g, "").slice(0, 6) })
                  }
                  placeholder="Laissez vide pour le générer"
                  inputMode="numeric"
                  autoComplete="off"
                />
              </Field>
              {driverError ? <p className="text-sm text-red-600">{driverError}</p> : null}
              {createdNotice ? (
                <p className="rounded-lg bg-[#e7f6fd] px-3 py-2 text-sm font-medium text-[#2b308f]">
                  {createdNotice}
                </p>
              ) : null}
              <Button type="submit" disabled={savingDriver} className="h-10">
                {savingDriver ? "Création…" : "Créer le chauffeur"}
              </Button>
            </div>
          </form>

          <div className="rounded-2xl border border-[#d5dcf0] bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-base font-semibold text-[#2b308f]">Chauffeurs</h2>
            {roster.length === 0 ? (
              <p className="text-sm text-[#5b6294]">
                Aucun chauffeur pour l’instant. Créez-en un ci-dessus, puis donnez l’indicatif et le PIN pour le téléphone.
              </p>
            ) : (
              <ul className="space-y-2">
                {roster.map((driver) => {
                  const live = liveById.get(driver.id);
                  const jobs = liveJobs.filter((c) => c.assignedDeviceId === driver.id);
                  const isOnline = Boolean(live);
                  return (
                    <li key={driver.id} className="rounded-xl border border-[#d5dcf0] px-3 py-2">
                      <div className="flex items-start justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (!live) return;
                            setSelectedId(driver.id);
                            setMapOpen(true);
                          }}
                          className="min-w-0 flex-1 text-left"
                        >
                          <div className="font-semibold">{driver.callSign}</div>
                          <div className="text-xs text-[#5b6294]">{driver.driverName}</div>
                          <div className="mt-1 text-xs text-[#5b6294]">
                            PIN {driver.pin ?? "••••"} · {VEHICLE_META[driver.vehicleType].label}
                          </div>
                        </button>
                        <div className="flex flex-col items-end gap-1">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                              isOnline ? "bg-[#e7f6fd] text-[#00a4e8]" : "bg-[#eef3fb] text-[#5b6294]"
                            }`}
                          >
                            {isOnline && live ? statusLabel(live, now) : "Hors ligne"}
                          </span>
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 text-[11px] text-red-600 hover:underline"
                            onClick={() => void removeDriver(driver.id)}
                          >
                            <Trash2 className="size-3" />
                            Retirer
                          </button>
                        </div>
                      </div>
                      <div className="mt-1 text-xs text-[#5b6294]">
                        {jobs.length} course{jobs.length > 1 ? "s" : ""}
                        {live && kph(live.speedMps) != null ? ` · ${kph(live.speedMps)} km/h` : ""}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
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
                  {roster.map((driver) => (
                    <option key={driver.id} value={driver.id}>
                      {driver.callSign} — {driver.driverName}
                      {liveById.has(driver.id) ? " (en ligne)" : ""}
                    </option>
                  ))}
                </select>
              </Field>
              {error ? <p className="text-sm text-red-600">{error}</p> : null}
              <Button type="submit" disabled={saving} className="h-10">
                {saving ? "Envoi…" : "Donner la course"}
              </Button>
              {roster.length === 0 ? (
                <p className="text-xs text-[#5b6294]">
                  Créez d’abord un chauffeur ci-dessus. Il n’a pas besoin d’être connecté pour recevoir la course.
                </p>
              ) : null}
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
                            className="h-8 max-w-48 rounded-lg border border-input bg-transparent px-2 text-xs"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <option value="">Non attribué</option>
                            {roster.map((driver) => (
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
                          <div className="flex flex-col items-start gap-1">
                            {course.hasDeliveryScan ? (
                              <a
                                href={`/api/courses/${course.id}/delivery`}
                                download={`${course.reference}-bon-livraison.jpg`}
                                className="inline-flex h-8 items-center rounded-lg bg-primary px-2.5 text-[0.8rem] font-medium text-primary-foreground"
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

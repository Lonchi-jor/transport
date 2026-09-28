"use client";

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ClipboardList, Pencil, Radio, Trash2, UserPlus, X } from "lucide-react";
import AdminChrome from "@/components/admin-chrome";
import { Field, PhoneLink, Stat, TrailerFields, type TrailerDraft } from "@/components/admin-fields";
import { PresenceBadge, PresenceLegend } from "@/components/presence-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAdminFleet } from "@/lib/use-admin-fleet";
import type { RosterDriver } from "@/lib/roster";
import type { FleetSnapshot, VehicleType } from "@/lib/types";
import {
  COURSE_STATUS_LABEL,
  courseElapsedLabel,
  formatCoords,
  formatKm,
  formatWhen,
  isLiveAssignedCourse,
  kph,
  matchesCourseView,
  parseCourseViewFilter,
  vehicleLine,
  type CourseViewFilter,
} from "@/lib/format";
import { presenceKind } from "@/lib/presence";
import { CourseItinerary } from "@/components/course-itinerary";

const emptyDriver = {
  callSign: "",
  driverName: "",
  phone: "",
  vehicleType: "van" as VehicleType,
  vehiclePlate: "",
  trailers: [{ type: "van" as VehicleType, plate: "" }] as TrailerDraft[],
  pin: "",
};

export default function ChauffeursDashboard() {
  const {
    courses,
    roster,
    setRoster,
    now,
    online,
    liveById,
    onlineCount,
    applySnapshot,
    alerts,
    markAlertsRead,
  } = useAdminFleet();
  const searchParams = useSearchParams();
  const router = useRouter();
  const selectedId = searchParams.get("id");
  const jobView = parseCourseViewFilter(searchParams.get("jobs"));
  const [query, setQuery] = useState("");
  const [editingDriverId, setEditingDriverId] = useState<string | null>(null);
  const [driverForm, setDriverForm] = useState(emptyDriver);
  const [driverError, setDriverError] = useState("");
  const [createdNotice, setCreatedNotice] = useState("");
  const [savingDriver, setSavingDriver] = useState(false);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return roster;
    return roster.filter((driver) =>
      [driver.callSign, driver.driverName, driver.phone, driver.vehiclePlate, ...(driver.trailerPlates ?? []), ...(driver.trailers ?? []).map((trailer) => trailer.plate)]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [roster, query]);

  const selected = roster.find((driver) => driver.id === selectedId) ?? null;

  function chauffeurUrl(id: string | null, jobs: CourseViewFilter = "all") {
    const params = new URLSearchParams();
    if (id) params.set("id", id);
    if (jobs !== "all") params.set("jobs", jobs);
    const qs = params.toString();
    return qs ? `/admin/chauffeurs?${qs}` : "/admin/chauffeurs";
  }

  function openDriver(id: string) {
    router.replace(chauffeurUrl(id));
  }

  function setJobView(view: CourseViewFilter) {
    if (!selectedId) return;
    router.replace(chauffeurUrl(selectedId, view));
    window.requestAnimationFrame(() => {
      document.getElementById("chauffeur-courses")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function startEditDriver(driver: RosterDriver) {
    setEditingDriverId(driver.id);
    setDriverError("");
    setCreatedNotice("");
    setDriverForm({
      callSign: driver.callSign,
      driverName: driver.driverName,
      phone: driver.phone ?? "",
      vehicleType: driver.vehicleType,
      vehiclePlate: driver.vehiclePlate ?? "",
      trailers:
        driver.trailers?.length
          ? driver.trailers.map((trailer) => ({ type: trailer.type, plate: trailer.plate }))
          : driver.trailerPlates?.length
            ? driver.trailerPlates.map((plate) => ({ type: driver.vehicleType, plate }))
            : [{ type: driver.vehicleType, plate: "" }],
      pin: "",
    });
    openDriver(driver.id);
  }

  function cancelEditDriver() {
    setEditingDriverId(null);
    setDriverForm(emptyDriver);
    setDriverError("");
  }

  async function saveDriver(event: FormEvent) {
    event.preventDefault();
    setSavingDriver(true);
    setDriverError("");
    try {
      const res = await fetch(editingDriverId ? `/api/drivers/${editingDriverId}` : "/api/drivers", {
        method: editingDriverId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...driverForm,
          vehicleType: driverForm.trailers[0]?.type ?? driverForm.vehicleType,
          trailerPlates: driverForm.trailers.map((trailer) => trailer.plate),
          trailers: driverForm.trailers,
        }),
      });
      const data = (await res.json()) as FleetSnapshot & {
        drivers?: RosterDriver[];
        driver?: RosterDriver;
        error?: string;
      };
      if (!res.ok) {
        setDriverError(data.error || "Impossible d’enregistrer le chauffeur.");
        return;
      }
      applySnapshot(data);
      if (data.drivers) setRoster(data.drivers);
      const saved = data.driver;
      if (saved) {
        setCreatedNotice(
          editingDriverId
            ? `${saved.callSign} mis à jour — ${vehicleLine(saved)}.`
            : `${saved.callSign} · PIN ${saved.pin} — donnez l’indicatif et le PIN pour le téléphone.`,
        );
        openDriver(saved.id);
      }
      setEditingDriverId(null);
      setDriverForm(emptyDriver);
    } catch {
      setDriverError("Réseau indisponible.");
    } finally {
      setSavingDriver(false);
    }
  }

  async function removeDriver(id: string) {
    const res = await fetch(`/api/drivers/${id}`, { method: "DELETE" });
    const data = (await res.json()) as FleetSnapshot & { drivers?: RosterDriver[] };
    applySnapshot(data);
    if (data.drivers) setRoster(data.drivers);
    if (editingDriverId === id) cancelEditDriver();
    if (selectedId === id) router.replace("/admin/chauffeurs");
  }

  const selectedJobs = useMemo(
    () => (selected ? courses.filter((course) => course.assignedDeviceId === selected.id) : []),
    [courses, selected],
  );
  const selectedLiveJobs = useMemo(
    () => selectedJobs.filter(isLiveAssignedCourse),
    [selectedJobs],
  );
  const selectedDoneJobs = useMemo(
    () => selectedJobs.filter((course) => course.status === "done"),
    [selectedJobs],
  );
  const visibleJobs = useMemo(() => {
    const next = selectedJobs.filter((course) => matchesCourseView(course, jobView));
    if (jobView !== "live") return next;
    return [...next].sort((a, b) => {
      if (a.status !== b.status) return a.status === "en_route" ? -1 : 1;
      return b.createdAt - a.createdAt;
    });
  }, [selectedJobs, jobView]);
  const selectedLive = selected ? liveById.get(selected.id) : undefined;
  const selectedLastSeen = selectedLive?.lastSeen ?? selected?.lastSeenAt ?? null;
  const selectedCoords = formatCoords(
    selectedLive?.lat ?? selected?.lastLat,
    selectedLive?.lng ?? selected?.lastLng,
  );
  const presenceStats = useMemo(() => {
    let recent = 0;
    let stale = 0;
    let unknown = 0;
    for (const driver of roster) {
      const kind = presenceKind(
        {
          connected: liveById.has(driver.id),
          lastSeen: liveById.get(driver.id)?.lastSeen ?? driver.lastSeenAt ?? null,
        },
        now,
      );
      if (kind === "recent") recent += 1;
      else if (kind === "stale") stale += 1;
      else if (kind === "unknown") unknown += 1;
    }
    return { recent, stale, unknown };
  }, [roster, liveById, now]);

  return (
    <div className="min-h-dvh bg-[#f4f7fc] text-[#1c2268]">
      <AdminChrome
        active="chauffeurs"
        online={online}
        alerts={alerts}
        onMarkAlertsRead={(ids) => void markAlertsRead(ids)}
        onOpenAlert={() => router.push("/admin/courses")}
      />

      <main className="mx-auto grid max-w-[1400px] gap-5 px-4 py-5 sm:px-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <section className="space-y-5">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Enregistrés" value={String(roster.length)} icon={<UserPlus className="size-4" />} />
            <Stat label="En ligne" value={String(onlineCount)} icon={<Radio className="size-4" />} />
            <Stat label="Vu < 30 min" value={String(presenceStats.recent)} icon={<Radio className="size-4" />} />
            <Stat label="Hors ligne" value={String(presenceStats.stale + presenceStats.unknown)} icon={<ClipboardList className="size-4" />} />
          </div>

          <form onSubmit={saveDriver} className="rounded-2xl border border-[#d5dcf0] bg-white p-4 shadow-sm">
            <h2 className="mb-1 flex items-center gap-2 text-base font-semibold text-[#2b308f]">
              {editingDriverId ? <Pencil className="size-4 text-[#00a4e8]" /> : <UserPlus className="size-4 text-[#00a4e8]" />}
              {editingDriverId ? "Modifier le chauffeur" : "Enregistrer un chauffeur"}
            </h2>
            <p className="mb-3 text-xs leading-5 text-[#5b6294]">
              Tout ce qui concerne le chauffeur se gère ici. Le téléphone ne sert qu’à se connecter avec l’indicatif et le PIN.
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
              <Field label="Téléphone" htmlFor="driverPhone">
                <Input
                  id="driverPhone"
                  required
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={driverForm.phone}
                  onChange={(e) => setDriverForm({ ...driverForm, phone: e.target.value })}
                  placeholder="+237 6…"
                />
              </Field>
              <Field label="Immatriculation Tracteur" htmlFor="tractorPlate">
                <Input
                  id="tractorPlate"
                  required
                  value={driverForm.vehiclePlate}
                  onChange={(e) => setDriverForm({ ...driverForm, vehiclePlate: e.target.value.toUpperCase() })}
                  placeholder="LT 1234 CE"
                  autoCapitalize="characters"
                />
              </Field>
              <TrailerFields
                idPrefix="driver"
                trailers={driverForm.trailers}
                onChange={(trailers) =>
                  setDriverForm({
                    ...driverForm,
                    trailers,
                    vehicleType: trailers[0]?.type ?? "van",
                  })
                }
              />
              <Field
                label={editingDriverId ? "Nouveau PIN (optionnel)" : "Code PIN (4 à 6 chiffres)"}
                htmlFor="pin"
              >
                <Input
                  id="pin"
                  value={driverForm.pin}
                  onChange={(e) =>
                    setDriverForm({ ...driverForm, pin: e.target.value.replace(/\D/g, "").slice(0, 6) })
                  }
                  placeholder={editingDriverId ? "Laisser vide pour garder le code" : "Laissez vide pour le générer"}
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
              <div className="flex gap-2">
                <Button type="submit" disabled={savingDriver} className="h-10 flex-1">
                  {savingDriver
                    ? "Enregistrement…"
                    : editingDriverId
                      ? "Enregistrer les modifications"
                      : "Enregistrer le chauffeur"}
                </Button>
                {editingDriverId ? (
                  <Button type="button" variant="secondary" className="h-10" onClick={cancelEditDriver}>
                    <X className="size-4" />
                    Annuler
                  </Button>
                ) : null}
              </div>
            </div>
          </form>

          <div className="rounded-2xl border border-[#d5dcf0] bg-white p-4 shadow-sm">
            <h2 className="mb-1 text-base font-semibold text-[#2b308f]">Tous les chauffeurs</h2>
            <PresenceLegend className="mb-3" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher un nom, un indicatif, un téléphone, une plaque…"
              className="mb-3"
            />
            {filtered.length === 0 ? (
              <p className="text-sm text-[#5b6294]">
                {roster.length === 0
                  ? "Aucun chauffeur enregistré. Créez-en un ci-dessus."
                  : "Aucun résultat pour cette recherche."}
              </p>
            ) : (
              <ul className="space-y-2">
                {filtered.map((driver) => {
                  const live = liveById.get(driver.id);
                  const jobs = courses.filter((c) => c.assignedDeviceId === driver.id);
                  const active = jobs.filter(isLiveAssignedCourse);
                  const lastSeen = live?.lastSeen ?? driver.lastSeenAt ?? null;
                  const coords = formatCoords(live?.lat ?? driver.lastLat, live?.lng ?? driver.lastLng);
                  const focused = selected?.id === driver.id;
                  return (
                    <li key={driver.id}>
                      <button
                        type="button"
                        onClick={() => openDriver(driver.id)}
                        className={`w-full rounded-xl border px-3 py-2 text-left ${
                          focused ? "border-[#00a4e8] bg-[#e7f6fd]" : "border-[#d5dcf0] hover:bg-[#f4f7fc]"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-semibold">{driver.callSign}</div>
                            <div className="text-xs text-[#5b6294]">{driver.driverName}</div>
                            {driver.phone ? (
                              <div className="mt-0.5 text-xs text-[#00a4e8]">{driver.phone}</div>
                            ) : (
                              <div className="mt-0.5 text-xs text-red-600">Téléphone manquant</div>
                            )}
                            <div className="mt-1 text-xs text-[#2b308f]">{vehicleLine(driver)}</div>
                          </div>
                          <PresenceBadge connected={Boolean(live)} lastSeen={lastSeen} now={now} />
                        </div>
                        <div className="mt-1 text-xs text-[#5b6294]">
                          {formatWhen(lastSeen) ? `Dernière connexion ${formatWhen(lastSeen)}` : "Aucune connexion enregistrée"}
                          {coords ? ` · GPS ${coords}` : " · pas encore de GPS"}
                        </div>
                        <div className="mt-1 text-xs text-[#5b6294]">
                          {jobs.length} course{jobs.length > 1 ? "s" : ""}
                          {active.length ? ` · ${active.length} en cours` : ""}
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
          {!selected ? (
            <div className="rounded-2xl border border-dashed border-[#d5dcf0] bg-white px-6 py-16 text-center shadow-sm">
              <h2 className="text-lg font-semibold text-[#2b308f]">Fiche chauffeur</h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-[#5b6294]">
                Choisissez un chauffeur à gauche pour voir son téléphone, son tracteur, ses remorques, son PIN, son statut GPS et toutes ses courses.
              </p>
            </div>
          ) : (
            <>
              <div className="rounded-2xl border border-[#d5dcf0] bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-medium uppercase tracking-wide text-[#00a4e8]">Fiche</div>
                    <h2 className="text-2xl font-semibold text-[#2b308f]">
                      {selected.callSign} · {selected.driverName}
                    </h2>
                    <p className="mt-1 text-sm text-[#2b308f]">{vehicleLine(selected)}</p>
                    {selected.phone ? (
                      <p className="mt-2 text-sm">
                        <PhoneLink phone={selected.phone} className="font-medium text-[#00a4e8] hover:underline" />
                      </p>
                    ) : (
                      <p className="mt-2 text-sm text-red-600">Téléphone manquant — complétez la fiche.</p>
                    )}
                    <p className="mt-2 text-sm text-[#5b6294]">
                      PIN téléphone :{" "}
                      <span className="font-mono font-semibold text-[#2b308f]">{selected.pin ?? "••••"}</span>
                    </p>
                    <div className="mt-3 rounded-xl border border-[#d5dcf0] bg-[#f8faff] px-3 py-2">
                      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[#5b6294]">
                        Connexion
                      </div>
                      <PresenceBadge
                        connected={Boolean(selectedLive)}
                        lastSeen={selectedLastSeen}
                        now={now}
                      />
                      <p className="mt-1 text-sm text-[#5b6294]">
                        {formatWhen(selectedLastSeen)
                          ? `Dernière connexion : ${formatWhen(selectedLastSeen)}`
                          : "Ce chauffeur ne s’est jamais connecté sur le téléphone."}
                      </p>
                      <p className="mt-0.5 text-sm text-[#5b6294]">
                        {selectedCoords
                          ? `Dernière position : ${selectedCoords}`
                          : "Aucune position GPS enregistrée pour le moment."}
                        {selectedLive && kph(selectedLive.speedMps) != null
                          ? ` · ${kph(selectedLive.speedMps)} km/h`
                          : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" variant="secondary" className="rounded-xl" onClick={() => startEditDriver(selected)}>
                      <Pencil className="size-4" />
                      Modifier
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="rounded-xl text-red-600"
                      onClick={() => void removeDriver(selected.id)}
                    >
                      <Trash2 className="size-4" />
                      Retirer
                    </Button>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  {(
                    [
                      { id: "all" as const, label: "Courses", value: selectedJobs.length },
                      { id: "live" as const, label: "En cours", value: selectedLiveJobs.length },
                      { id: "done" as const, label: "Terminées", value: selectedDoneJobs.length },
                    ] as const
                  ).map((item) => {
                    const active = jobView === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        aria-pressed={active}
                        aria-controls="chauffeur-courses"
                        onClick={() => setJobView(item.id)}
                        className={`rounded-xl px-3 py-2 text-center transition ${
                          active
                            ? "bg-[#e7f6fd] ring-2 ring-[#00a4e8]"
                            : "bg-[#f4f7fc] hover:bg-[#eef3fb]"
                        }`}
                      >
                        <div className="text-lg font-semibold text-[#2b308f]">{item.value}</div>
                        <div className="text-[11px] text-[#5b6294]">{item.label}</div>
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 text-[11px] text-[#5b6294]">
                  Touchez un compteur pour afficher toutes ses courses, celles en cours, ou celles terminées.
                </p>
              </div>

              <div id="chauffeur-courses" className="overflow-hidden rounded-2xl border border-[#d5dcf0] bg-white shadow-sm">
                <div className="flex items-start justify-between gap-3 border-b border-[#d5dcf0] px-4 py-3">
                  <div>
                    <h3 className="text-base font-semibold text-[#2b308f]">
                      {jobView === "live"
                        ? "Courses en cours"
                        : jobView === "done"
                          ? "Courses terminées"
                          : "Toutes les courses"}
                    </h3>
                    <p className="text-xs text-[#5b6294]">
                      {jobView === "live"
                        ? "Reçues ou déjà démarrées, pas encore livrées."
                        : jobView === "done"
                          ? "Courses livrées, avec le BL scanné."
                          : "Client, trajet, véhicule utilisé, BN, BL — tout reste enregistré."}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Link href="/admin" className="text-xs font-medium text-[#00a4e8] hover:underline">
                      Donner une course
                    </Link>
                    <Link
                      href={`/admin/courses?chauffeur=${encodeURIComponent(selected.id)}${
                        jobView === "all" ? "" : `&filtre=${jobView}`
                      }`}
                      className="text-xs font-medium text-[#00a4e8] hover:underline"
                    >
                      {jobView === "live"
                        ? "Tableau — en cours"
                        : jobView === "done"
                          ? "Tableau — terminées"
                          : "Toutes ses courses"}
                    </Link>
                  </div>
                </div>
                {visibleJobs.length === 0 ? (
                  <p className="px-4 py-10 text-sm text-[#5b6294]">
                    {selectedJobs.length === 0
                      ? "Aucune course pour ce chauffeur. Attribuez-en une depuis le tableau de bord."
                      : jobView === "live"
                        ? "Aucune course en cours pour ce chauffeur."
                        : jobView === "done"
                          ? "Aucune course terminée pour ce chauffeur."
                          : "Aucune course pour ce chauffeur. Attribuez-en une depuis le tableau de bord."}
                  </p>
                ) : (
                  <ul className="divide-y divide-[#d5dcf0]">
                    {visibleJobs.map((course) => {
                      const elapsed = courseElapsedLabel(course, now);
                      return (
                        <li key={course.id} className="px-4 py-3">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <div className="font-semibold text-[#2b308f]">{course.reference}</div>
                              <div className="text-sm">{course.clientName}</div>
                              {course.clientPhone ? (
                                <div className="text-xs text-[#5b6294]">{course.clientPhone}</div>
                              ) : null}
                            </div>
                            <Badge variant={course.status === "open" ? "outline" : "secondary"}>
                              {COURSE_STATUS_LABEL[course.status]}
                            </Badge>
                          </div>
                          <div className="mt-2">
                            <CourseItinerary course={course} />
                          </div>
                          <div className="mt-2 text-xs text-[#2b308f]">{vehicleLine(course)}</div>
                          <div className="mt-1 flex flex-wrap gap-2 text-xs text-[#5b6294]">
                            {formatKm(course.distanceMeters) ? <span>{formatKm(course.distanceMeters)}</span> : null}
                            {elapsed ? <span className="font-medium text-[#2b308f]">{elapsed}</span> : null}
                            {course.bnNumber ? <span>BN {course.bnNumber}</span> : null}
                            {course.hasDeliveryScan ? (
                              <a
                                href={`/api/courses/${course.id}/delivery`}
                                download={`${course.reference}-bon-livraison.jpg`}
                                className="font-medium text-[#00a4e8] hover:underline"
                              >
                                Télécharger le BL
                              </a>
                            ) : null}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  );
}

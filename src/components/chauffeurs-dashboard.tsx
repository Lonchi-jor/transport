"use client";

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ClipboardList, Pencil, Radio, Trash2, UserPlus, X } from "lucide-react";
import AdminChrome from "@/components/admin-chrome";
import { Field, PhoneLink, Stat, VehicleFields } from "@/components/admin-fields";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAdminFleet } from "@/lib/use-admin-fleet";
import type { RosterDriver } from "@/lib/roster";
import type { FleetSnapshot, VehicleType } from "@/lib/types";
import {
  COURSE_STATUS_LABEL,
  courseElapsedLabel,
  formatKm,
  kph,
  statusLabel,
  vehicleLine,
} from "@/lib/format";

const emptyDriver = {
  callSign: "",
  driverName: "",
  phone: "",
  vehicleType: "van" as VehicleType,
  vehiclePlate: "",
  pin: "",
};

export default function ChauffeursDashboard() {
  const { courses, roster, setRoster, now, online, liveJobs, liveById, onlineCount, applySnapshot } =
    useAdminFleet();
  const searchParams = useSearchParams();
  const router = useRouter();
  const selectedId = searchParams.get("id");
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
      [driver.callSign, driver.driverName, driver.phone, driver.vehiclePlate]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [roster, query]);

  const selected = roster.find((driver) => driver.id === selectedId) ?? null;

  function openDriver(id: string) {
    router.replace(`/admin/chauffeurs?id=${encodeURIComponent(id)}`);
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
        body: JSON.stringify(driverForm),
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

  const selectedJobs = selected
    ? courses.filter((course) => course.assignedDeviceId === selected.id)
    : [];
  const selectedLive = selected ? liveById.get(selected.id) : undefined;
  const selectedActive = selected
    ? liveJobs.filter((course) => course.assignedDeviceId === selected.id)
    : [];

  return (
    <div className="min-h-dvh bg-[#f4f7fc] text-[#1c2268]">
      <AdminChrome
        active="chauffeurs"
        online={online}
      />

      <main className="mx-auto grid max-w-[1400px] gap-5 px-4 py-5 sm:px-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <section className="space-y-5">
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Enregistrés" value={String(roster.length)} icon={<UserPlus className="size-4" />} />
            <Stat label="En ligne" value={String(onlineCount)} icon={<Radio className="size-4" />} />
            <Stat label="Courses actives" value={String(liveJobs.length)} icon={<ClipboardList className="size-4" />} />
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
              <VehicleFields
                idPrefix="driver"
                vehicleType={driverForm.vehicleType}
                vehiclePlate={driverForm.vehiclePlate}
                plateRequired
                onChange={(patch) => setDriverForm({ ...driverForm, ...patch })}
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
            <h2 className="mb-3 text-base font-semibold text-[#2b308f]">Tous les chauffeurs</h2>
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
                  const active = liveJobs.filter((c) => c.assignedDeviceId === driver.id);
                  const isOnline = Boolean(live);
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
                          <span
                            className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                              isOnline ? "bg-[#e7f6fd] text-[#00a4e8]" : "bg-[#eef3fb] text-[#5b6294]"
                            }`}
                          >
                            {isOnline && live ? statusLabel(live, now) : "Hors ligne"}
                          </span>
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
                Choisissez un chauffeur à gauche pour voir son téléphone, son véhicule, son PIN, son statut GPS et toutes ses courses.
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
                    <p className="mt-1 text-sm text-[#5b6294]">
                      {selectedLive
                        ? `${statusLabel(selectedLive, now)}${
                            kph(selectedLive.speedMps) != null ? ` · ${kph(selectedLive.speedMps)} km/h` : ""
                          }`
                        : "Pas connecté sur le téléphone pour le moment."}
                    </p>
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
                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl bg-[#f4f7fc] px-3 py-2">
                    <div className="text-lg font-semibold text-[#2b308f]">{selectedJobs.length}</div>
                    <div className="text-[11px] text-[#5b6294]">Courses</div>
                  </div>
                  <div className="rounded-xl bg-[#f4f7fc] px-3 py-2">
                    <div className="text-lg font-semibold text-[#2b308f]">{selectedActive.length}</div>
                    <div className="text-[11px] text-[#5b6294]">En cours</div>
                  </div>
                  <div className="rounded-xl bg-[#f4f7fc] px-3 py-2">
                    <div className="text-lg font-semibold text-[#2b308f]">
                      {selectedJobs.filter((job) => job.status === "done").length}
                    </div>
                    <div className="text-[11px] text-[#5b6294]">Terminées</div>
                  </div>
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl border border-[#d5dcf0] bg-white shadow-sm">
                <div className="flex items-start justify-between gap-3 border-b border-[#d5dcf0] px-4 py-3">
                  <div>
                    <h3 className="text-base font-semibold text-[#2b308f]">Historique des courses</h3>
                    <p className="text-xs text-[#5b6294]">
                      Client, trajet, véhicule utilisé, BN, BL — tout reste enregistré.
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Link href="/admin" className="text-xs font-medium text-[#00a4e8] hover:underline">
                      Donner une course
                    </Link>
                    <Link
                      href={`/admin/courses?chauffeur=${encodeURIComponent(selected.id)}`}
                      className="text-xs font-medium text-[#00a4e8] hover:underline"
                    >
                      Toutes ses courses
                    </Link>
                  </div>
                </div>
                {selectedJobs.length === 0 ? (
                  <p className="px-4 py-10 text-sm text-[#5b6294]">
                    Aucune course pour ce chauffeur. Attribuez-en une depuis le tableau de bord.
                  </p>
                ) : (
                  <ul className="divide-y divide-[#d5dcf0]">
                    {selectedJobs.map((course) => {
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
                          <div className="mt-2 text-sm">
                            <span className="text-[11px] font-medium uppercase tracking-wide text-[#5b6294]">
                              Départ
                            </span>{" "}
                            {course.pickupAddress}
                          </div>
                          <div className="text-sm">
                            <span className="text-[11px] font-medium uppercase tracking-wide text-[#00a4e8]">
                              Arrivée
                            </span>{" "}
                            {course.dropoffAddress}
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
                          {course.notes ? <div className="mt-1 text-xs text-[#5b6294]">{course.notes}</div> : null}
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

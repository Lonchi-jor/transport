"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import AdminChrome from "@/components/admin-chrome";
import CourseEditor from "@/components/course-editor";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhoneLink } from "@/components/admin-fields";
import DispatchNote from "@/components/dispatch-note";
import { cn } from "@/lib/utils";
import { useAdminFleet } from "@/lib/use-admin-fleet";
import type { CourseStatus, FleetSnapshot, VehicleType } from "@/lib/types";
import { COURSE_STATUSES, VEHICLE_META, VEHICLE_TYPES } from "@/lib/types";
import {
  COURSE_STATUS_LABEL,
  courseElapsedLabel,
  formatKm,
  formatWhen,
  vehicleLine,
} from "@/lib/format";

const PERIODS = [
  { id: "all", label: "Toutes dates" },
  { id: "today", label: "Aujourd’hui" },
  { id: "7d", label: "7 derniers jours" },
  { id: "30d", label: "30 derniers jours" },
] as const;

export default function CoursesBoard() {
  const { courses, roster, now, online, applySnapshot } = useAdminFleet();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<CourseStatus | "all">("all");
  const [period, setPeriod] = useState<(typeof PERIODS)[number]["id"]>("all");
  const [bl, setBl] = useState<"all" | "yes" | "no">("all");
  const [vehicleType, setVehicleType] = useState<VehicleType | "all">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const chauffeurId = searchParams.get("chauffeur") ?? "";

  function setChauffeur(id: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (id) params.set("chauffeur", id);
    else params.delete("chauffeur");
    const qs = params.toString();
    router.replace(qs ? `/admin/courses?${qs}` : "/admin/courses");
  }

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const cutoff =
      period === "today"
        ? new Date(now).setHours(0, 0, 0, 0)
        : period === "7d"
          ? now - 7 * 24 * 60 * 60 * 1000
          : period === "30d"
            ? now - 30 * 24 * 60 * 60 * 1000
            : 0;
    return courses.filter((course) => {
      if (chauffeurId === "__none__" && course.assignedDeviceId) return false;
      if (chauffeurId && chauffeurId !== "__none__" && course.assignedDeviceId !== chauffeurId) return false;
      if (status !== "all" && course.status !== status) return false;
      if (vehicleType !== "all" && course.vehicleType !== vehicleType) return false;
      if (cutoff && course.createdAt < cutoff) return false;
      if (bl === "yes" && !course.hasDeliveryScan) return false;
      if (bl === "no" && course.hasDeliveryScan) return false;
      if (!needle) return true;
      const hay = [
        course.reference,
        course.clientName,
        course.clientPhone,
        course.pickupAddress,
        course.dropoffAddress,
        course.bnNumber,
        course.assignedCallSign,
        course.assignedDriverName,
        course.assignedDriverPhone,
        course.vehiclePlate,
        course.notes,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [courses, chauffeurId, status, period, bl, query, vehicleType, now]);

  const stats = useMemo(() => {
    const done = filtered.filter((c) => c.status === "done");
    const live = filtered.filter((c) => c.status === "assigned" || c.status === "en_route");
    const km = filtered.reduce((sum, c) => sum + (c.distanceMeters ?? 0), 0);
    return {
      total: filtered.length,
      live: live.length,
      done: done.length,
      km,
    };
  }, [filtered]);

  const selected = courses.find((course) => course.id === selectedId) ?? null;
  const selectedDriver = roster.find((driver) => driver.id === chauffeurId) ?? null;

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
    applySnapshot((await res.json()) as FleetSnapshot);
  }

  return (
    <div className="min-h-dvh bg-[#f4f7fc] text-[#1c2268]">
      <AdminChrome active="courses" online={online} />

      <main className="mx-auto max-w-[1400px] space-y-5 px-4 py-5 sm:px-6">
        <div>
          <h1 className="text-xl font-semibold text-[#2b308f]">Toutes les courses</h1>
          <p className="mt-1 text-sm text-[#5b6294]">
            Historique de tous les chauffeurs. Filtrez par chauffeur, statut, date, BN/BL ou recherche.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatCard label="Résultats" value={String(stats.total)} />
          <StatCard label="En cours" value={String(stats.live)} />
          <StatCard label="Terminées" value={String(stats.done)} />
          <StatCard label="Distance" value={formatKm(stats.km) ?? "—"} />
        </div>

        <div className="rounded-2xl border border-[#d5dcf0] bg-white p-4 shadow-sm">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
            <label className="grid gap-1 text-xs font-medium text-[#5b6294]">
              Recherche
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Client, réf., BN, plaque, adresse…"
              />
            </label>
            <label className="grid gap-1 text-xs font-medium text-[#5b6294]">
              Chauffeur
              <select
                value={chauffeurId}
                onChange={(e) => setChauffeur(e.target.value)}
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
              >
                <option value="">Tous les chauffeurs</option>
                <option value="__none__">Sans chauffeur</option>
                {roster.map((driver) => (
                  <option key={driver.id} value={driver.id}>
                    {driver.callSign} — {driver.driverName}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-xs font-medium text-[#5b6294]">
              Statut
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as CourseStatus | "all")}
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
              >
                <option value="all">Tous</option>
                {COURSE_STATUSES.map((item) => (
                  <option key={item} value={item}>
                    {COURSE_STATUS_LABEL[item]}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-xs font-medium text-[#5b6294]">
              Période
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value as (typeof PERIODS)[number]["id"])}
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
              >
                {PERIODS.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-xs font-medium text-[#5b6294]">
              Véhicule
              <select
                value={vehicleType}
                onChange={(e) => setVehicleType(e.target.value as VehicleType | "all")}
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
              >
                <option value="all">Tous les types</option>
                {VEHICLE_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {VEHICLE_META[type].label}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-xs font-medium text-[#5b6294]">
              Bon de livraison
              <select
                value={bl}
                onChange={(e) => setBl(e.target.value as "all" | "yes" | "no")}
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
              >
                <option value="all">Tous</option>
                <option value="yes">BL scanné</option>
                <option value="no">BL manquant</option>
              </select>
            </label>
          </div>
          {chauffeurId === "__none__" ? (
            <p className="mt-3 text-xs text-[#2b308f]">
              Filtre : courses sans chauffeur{" "}
              <button type="button" className="text-[#00a4e8] underline" onClick={() => setChauffeur("")}>
                Retirer
              </button>
            </p>
          ) : selectedDriver ? (
            <p className="mt-3 text-xs text-[#2b308f]">
              Filtre chauffeur : {selectedDriver.callSign} · {selectedDriver.driverName} · {vehicleLine(selectedDriver)}{" "}
              <button type="button" className="text-[#00a4e8] underline" onClick={() => setChauffeur("")}>
                Retirer
              </button>
            </p>
          ) : null}
        </div>

        {selected ? (
          <CourseEditor
            key={`${selected.id}-${selected.updatedAt}`}
            course={selected}
            roster={roster}
            onSave={(id, body) => patchCourse(id, body)}
          />
        ) : null}

        <div className="overflow-hidden rounded-2xl border border-[#d5dcf0] bg-white shadow-sm">
          {filtered.length === 0 ? (
            <p className="px-4 py-12 text-center text-sm text-[#5b6294]">
              Aucune course pour ces filtres.{" "}
              <Link href="/admin" className="text-[#00a4e8] hover:underline">
                Créer une course
              </Link>
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px] text-left text-sm">
                <thead className="bg-[#f4f7fc] text-xs uppercase tracking-wide text-[#5b6294]">
                  <tr>
                    <th className="px-4 py-2 font-medium">Réf. / client</th>
                    <th className="px-4 py-2 font-medium">Trajet</th>
                    <th className="px-4 py-2 font-medium">Chauffeur</th>
                    <th className="px-4 py-2 font-medium">Dates</th>
                    <th className="px-4 py-2 font-medium">Statut</th>
                    <th className="px-4 py-2 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((course) => {
                    const elapsed = courseElapsedLabel(course, now);
                    return (
                      <tr
                        key={course.id}
                        className={`cursor-pointer border-t border-[#d5dcf0] align-top hover:bg-[#f4f7fc] ${
                          course.id === selectedId ? "bg-[#eef3fb]" : ""
                        }`}
                        onClick={() => setSelectedId(course.id)}
                      >
                        <td className="w-[210px] px-4 py-3">
                          <div className="font-semibold text-[#2b308f]">{course.reference}</div>
                          <div className="mt-1 text-sm leading-snug">{course.clientName}</div>
                          {course.clientPhone ? (
                            <div className="text-xs text-[#5b6294]">{course.clientPhone}</div>
                          ) : null}
                          {course.notes ? (
                            <div className="mt-2">
                              <DispatchNote notes={course.notes} />
                            </div>
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
                        <td className="max-w-[320px] px-4 py-3">
                          <div className="text-[11px] font-medium uppercase tracking-wide text-[#5b6294]">Départ</div>
                          <div className="text-sm leading-snug">{course.pickupAddress}</div>
                          <div className="mt-2 text-[11px] font-medium uppercase tracking-wide text-[#00a4e8]">Arrivée</div>
                          <div className="text-sm leading-snug">{course.dropoffAddress}</div>
                          <div className="mt-2 flex flex-col gap-0.5 text-xs text-[#5b6294]">
                            {formatKm(course.distanceMeters) ? <span>{formatKm(course.distanceMeters)}</span> : null}
                            {elapsed ? <span className="font-medium text-[#2b308f]">{elapsed}</span> : null}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium">
                            {course.assignedCallSign
                              ? `${course.assignedCallSign} — ${course.assignedDriverName ?? ""}`
                              : "Non attribué"}
                          </div>
                          {course.assignedDriverPhone ? (
                            <PhoneLink
                              phone={course.assignedDriverPhone}
                              className="mt-1 block text-xs text-[#00a4e8] hover:underline"
                              onClick={(event) => event.stopPropagation()}
                            />
                          ) : null}
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
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-[#5b6294]">
                          <div>Créée {formatWhen(course.createdAt)}</div>
                          {course.startedAt ? <div>Départ {formatWhen(course.startedAt)}</div> : null}
                          {course.finishedAt ? <div>Fin {formatWhen(course.finishedAt)}</div> : null}
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
                                setSelectedId(course.id);
                              }}
                            >
                              Modifier
                            </Button>
                            {course.hasDeliveryScan ? (
                              <a
                                href={`/api/courses/${course.id}/delivery`}
                                download={`${course.reference}-bon-livraison.jpg`}
                                className={cn(buttonVariants({ size: "sm" }), "h-8 rounded-lg")}
                                onClick={(event) => event.stopPropagation()}
                              >
                                Télécharger le BL
                              </a>
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
      </main>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#d5dcf0] bg-white p-3 shadow-sm">
      <div className="text-xl font-semibold text-[#2b308f]">{value}</div>
      <div className="text-[11px] text-[#5b6294]">{label}</div>
    </div>
  );
}

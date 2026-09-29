"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FileDown } from "lucide-react";
import AdminChrome from "@/components/admin-chrome";
import CourseEditor from "@/components/course-editor";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhoneLink } from "@/components/admin-fields";
import { DispatchNoteHint } from "@/components/dispatch-note";
import { CourseItinerary } from "@/components/course-itinerary";
import { cn } from "@/lib/utils";
import { useAdminFleet } from "@/lib/use-admin-fleet";
import type { Course, CourseStatus, FleetSnapshot, VehicleType } from "@/lib/types";
import { COURSE_STATUSES, VEHICLE_META, VEHICLE_TYPES } from "@/lib/types";
import {
  COURSE_STATUS_LABEL,
  courseElapsedLabel,
  courseStops,
  formatKm,
  formatWhen,
  isLiveAssignedCourse,
  matchesCourseView,
  parseCourseViewFilter,
  vehicleLine,
  type CourseViewFilter,
} from "@/lib/format";

const PERIODS = [
  { id: "all", label: "Toutes dates" },
  { id: "today", label: "Aujourd’hui" },
  { id: "7d", label: "7 derniers jours" },
  { id: "30d", label: "30 derniers jours" },
] as const;

export default function CoursesBoard() {
  const { courses, roster, now, online, applySnapshot, alerts, markAlertsRead, dismissAlerts } = useAdminFleet();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<CourseStatus | "all">("all");
  const [period, setPeriod] = useState<(typeof PERIODS)[number]["id"]>("all");
  const [bl, setBl] = useState<"all" | "yes" | "no">("all");
  const [vehicleType, setVehicleType] = useState<VehicleType | "all">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  function openCourse(courseId: string) {
    setSelectedId(courseId);
    void dismissAlerts({ courseId });
    if (focusId && courseId !== focusId) {
      replaceParams((params) => params.delete("focus"));
    }
  }

  const chauffeurId = searchParams.get("chauffeur") ?? "";
  const focusId = searchParams.get("focus") ?? "";
  const view = parseCourseViewFilter(searchParams.get("filtre"));

  useEffect(() => {
    if (!focusId) return;
    setQuery("");
    setStatus("all");
    setPeriod("all");
    setBl("all");
    setVehicleType("all");
    void dismissAlerts({ courseId: focusId });
  }, [focusId, dismissAlerts]);

  useEffect(() => {
    if (!focusId) return;
    const node =
      document.getElementById(`course-focus-${focusId}`) ?? document.getElementById(`course-row-${focusId}`);
    node?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [focusId, courses]);

  function replaceParams(mutate: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams.toString());
    mutate(params);
    const qs = params.toString();
    router.replace(qs ? `/admin/courses?${qs}` : "/admin/courses");
  }

  function setChauffeur(id: string) {
    replaceParams((params) => {
      if (id) params.set("chauffeur", id);
      else params.delete("chauffeur");
    });
  }

  function setView(next: CourseViewFilter) {
    setStatus("all");
    replaceParams((params) => {
      if (next === "all") params.delete("filtre");
      else params.set("filtre", next);
    });
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
    const list = courses.filter((course) => {
      if (focusId && course.id === focusId) return true;
      if (chauffeurId === "__none__" && course.assignedDeviceId) return false;
      if (chauffeurId && chauffeurId !== "__none__" && course.assignedDeviceId !== chauffeurId) return false;
      if (vehicleType !== "all" && course.vehicleType !== vehicleType) return false;
      if (cutoff && course.createdAt < cutoff) return false;
      if (bl === "yes" && !course.hasDeliveryScan) return false;
      if (bl === "no" && course.hasDeliveryScan) return false;
      if (view === "live" || view === "done") {
        if (!matchesCourseView(course, view)) return false;
      } else if (status !== "all" && course.status !== status) {
        return false;
      }
      if (!needle) return true;
      const hay = [
        course.reference,
        course.clientName,
        course.clientPhone,
        course.pickupAddress,
        course.dropoffAddress,
        ...courseStops(course).map((stop) => stop.address),
        course.bnNumber,
        course.assignedCallSign,
        course.assignedDriverName,
        course.assignedDriverPhone,
        course.vehiclePlate,
        ...(course.trailerPlates ?? []),
        course.notes,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    });
    if (focusId) {
      const index = list.findIndex((course) => course.id === focusId);
      if (index > 0) {
        const [hit] = list.splice(index, 1);
        list.unshift(hit);
      }
    }
    return list;
  }, [courses, chauffeurId, status, period, bl, query, vehicleType, now, view, focusId]);

  const stats = useMemo(() => {
    const scoped = courses.filter((course) => {
      if (chauffeurId === "__none__" && course.assignedDeviceId) return false;
      if (chauffeurId && chauffeurId !== "__none__" && course.assignedDeviceId !== chauffeurId) return false;
      return true;
    });
    const done = scoped.filter((c) => c.status === "done");
    const live = scoped.filter(isLiveAssignedCourse);
    const km = filtered.reduce((sum, c) => sum + (c.distanceMeters ?? 0), 0);
    return {
      total: scoped.length,
      live: live.length,
      done: done.length,
      km,
    };
  }, [courses, chauffeurId, filtered]);

  const selected = courses.find((course) => course.id === selectedId) ?? null;
  const focused = (focusId && courses.find((course) => course.id === focusId)) || null;
  const selectedDriver = roster.find((driver) => driver.id === chauffeurId) ?? null;

  function clearFocus() {
    replaceParams((params) => params.delete("focus"));
  }

  async function patchCourse(
    id: string,
    body: {
      assignedDeviceId?: string | null;
      status?: string;
      vehicleType?: VehicleType | null;
      vehiclePlate?: string | null;
      notes?: string;
      stops?: Course["stops"];
    },
  ) {
    const res = await fetch(`/api/courses/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as FleetSnapshot & { error?: string };
    if (!res.ok) return data.error || "Impossible d’enregistrer.";
    applySnapshot(data);
    return null;
  }

  return (
    <div className="min-h-dvh bg-[#f4f7fc] text-[#1c2268]">
      <AdminChrome
        active="courses"
        online={online}
        alerts={alerts}
        onMarkAlertsRead={(ids) => void markAlertsRead(ids)}
      />

      <main className="mx-auto max-w-[1400px] space-y-5 px-4 py-5 sm:px-6">
        <div>
          <h1 className="text-xl font-semibold text-[#2b308f]">Toutes les courses</h1>
          <p className="mt-1 text-sm text-[#5b6294]">
            Historique de tous les chauffeurs. Filtrez par chauffeur, statut, date, BN/BL ou recherche.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatCard
            label={selectedDriver ? "Ses courses" : "Courses"}
            value={String(stats.total)}
            active={view === "all"}
            onClick={() => setView("all")}
          />
          <StatCard
            label="En cours"
            value={String(stats.live)}
            active={view === "live"}
            onClick={() => setView("live")}
          />
          <StatCard
            label="Terminées"
            value={String(stats.done)}
            active={view === "done"}
            onClick={() => setView("done")}
          />
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
                onChange={(e) => {
                  replaceParams((params) => params.delete("filtre"));
                  setStatus(e.target.value as CourseStatus | "all");
                }}
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
                <option value="yes">BL joint</option>
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
              Filtre chauffeur : {selectedDriver.callSign} · {selectedDriver.driverName} · {vehicleLine(selectedDriver)}
              {view === "live" ? " · en cours" : view === "done" ? " · terminées" : ""}{" "}
              <button type="button" className="text-[#00a4e8] underline" onClick={() => setChauffeur("")}>
                Retirer
              </button>
            </p>
          ) : null}
        </div>

        {focused ? <FocusedFinishedCourse course={focused} onClear={clearFocus} /> : null}

        {selected && selected.id !== focused?.id ? (
          <CourseEditor
            key={`${selected.id}-${selected.updatedAt}`}
            course={selected}
            roster={roster}
            courses={courses}
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
                    const isFocus = course.id === focusId;
                    return (
                      <tr
                        key={course.id}
                        id={`course-row-${course.id}`}
                        className={cn(
                          "cursor-pointer border-t border-[#d5dcf0] align-top",
                          isFocus
                            ? "bg-emerald-50 hover:bg-emerald-100"
                            : course.id === selectedId
                              ? "bg-[#eef3fb] hover:bg-[#eef3fb]"
                              : "hover:bg-[#f4f7fc]",
                        )}
                        onClick={() => openCourse(course.id)}
                      >
                        <td
                          className={cn(
                            "w-[210px] px-4 py-3",
                            isFocus ? "border-l-4 border-l-emerald-500" : "border-l-4 border-l-transparent",
                          )}
                        >
                          <div className="font-semibold text-[#2b308f]">{course.reference}</div>
                          {isFocus ? (
                            <div className="mt-1 inline-flex rounded-full bg-emerald-600 px-2 py-0.5 text-[11px] font-semibold text-white">
                              Course de la notification
                            </div>
                          ) : null}
                          <div className="mt-1 text-sm leading-snug">{course.clientName}</div>
                          {course.clientPhone ? (
                            <div className="text-xs text-[#5b6294]">{course.clientPhone}</div>
                          ) : null}
                          <div className="mt-2 flex flex-wrap gap-1">
                            {course.notes ? <DispatchNoteHint notes={course.notes} /> : null}
                            {course.bnNumber ? (
                              <span className="rounded-full bg-[#eef3fb] px-2 py-0.5 text-[11px] font-medium text-[#2b308f]">
                                BN {course.bnNumber}
                              </span>
                            ) : null}
                            {course.hasDeliveryScan ? (
                              <span className="rounded-full bg-[#e7f6fd] px-2 py-0.5 text-[11px] font-medium text-[#00a4e8]">
                                BL joint
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="max-w-[320px] px-4 py-3">
                          <CourseItinerary course={course} />
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
                          {course.startedAt ? <div>Début {formatWhen(course.startedAt)}</div> : null}
                          {course.finishedAt ? <div>Fin {formatWhen(course.finishedAt)}</div> : null}
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant={course.status === "open" ? "outline" : "secondary"}
                            className={isFocus ? "border-emerald-600 bg-emerald-600 text-white" : undefined}
                          >
                            {COURSE_STATUS_LABEL[course.status]}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col items-start gap-1">
                            {course.hasDeliveryScan ? (
                              <a
                                href={`/api/courses/${course.id}/delivery`}
                                download={`${course.reference}-bon-livraison.pdf`}
                                className={cn(
                                  buttonVariants({ size: "sm" }),
                                  "h-8 rounded-lg",
                                  isFocus ? "border-emerald-700 bg-emerald-600 text-white hover:bg-emerald-700" : "",
                                )}
                                onClick={(event) => event.stopPropagation()}
                              >
                                <FileDown className="size-3.5" />
                                Télécharger le BL
                              </a>
                            ) : null}
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={(event) => {
                                event.stopPropagation();
                                setSelectedId(course.id);
                                void dismissAlerts({ courseId: course.id });
                              }}
                            >
                              Modifier
                            </Button>
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

function StatCard({
  label,
  value,
  active,
  onClick,
}: {
  label: string;
  value: string;
  active?: boolean;
  onClick?: () => void;
}) {
  const className = `rounded-2xl border p-3 text-left shadow-sm ${
    onClick
      ? active
        ? "border-[#00a4e8] bg-[#e7f6fd]"
        : "border-[#d5dcf0] bg-white hover:bg-[#f4f7fc]"
      : "border-[#d5dcf0] bg-white"
  }`;
  const inner = (
    <>
      <div className="text-xl font-semibold text-[#2b308f]">{value}</div>
      <div className="text-[11px] text-[#5b6294]">{label}</div>
    </>
  );
  if (!onClick) {
    return <div className={className}>{inner}</div>;
  }
  return (
    <button type="button" aria-pressed={Boolean(active)} onClick={onClick} className={className}>
      {inner}
    </button>
  );
}

function FocusedFinishedCourse({ course, onClear }: { course: Course; onClear: () => void }) {
  return (
    <section
      id={`course-focus-${course.id}`}
      className="scroll-mt-24 rounded-2xl border-2 border-emerald-500 bg-emerald-50 p-4 shadow-sm"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="inline-flex rounded-full bg-emerald-600 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white">
            Course terminée
          </div>
          <h2 className="mt-2 text-lg font-semibold text-emerald-950">{course.reference}</h2>
          <p className="text-sm text-emerald-900">{course.clientName}</p>
          {course.assignedCallSign ? (
            <p className="mt-1 text-xs text-emerald-800">
              {course.assignedCallSign}
              {course.assignedDriverName ? ` — ${course.assignedDriverName}` : ""}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {course.hasDeliveryScan ? (
            <a
              href={`/api/courses/${course.id}/delivery`}
              download={`${course.reference}-bon-livraison.pdf`}
              className={cn(buttonVariants({ size: "lg" }), "h-10 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700")}
            >
              <FileDown className="size-4" />
              Télécharger le BL
            </a>
          ) : (
            <p className="max-w-xs text-sm text-emerald-900">
              Le chauffeur n’a pas encore envoyé le bon de livraison.
            </p>
          )}
          <Button type="button" variant="ghost" size="sm" onClick={onClear}>
            Retirer le surlignage
          </Button>
        </div>
      </div>
      <div className="mt-3">
        <CourseItinerary course={course} />
      </div>
      {course.finishedAt ? (
        <p className="mt-2 text-xs text-emerald-800">Terminée {formatWhen(course.finishedAt)}</p>
      ) : null}
    </section>
  );
}

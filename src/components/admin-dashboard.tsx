"use client";

import { useState } from "react";
import Link from "next/link";
import { ClipboardList, MapPinned, Truck } from "lucide-react";
import "leaflet/dist/leaflet.css";
import AdminChrome from "@/components/admin-chrome";
import DispatchMap from "@/components/dispatch-map";
import CourseEditor from "@/components/course-editor";
import CourseComposer, { NewCourseButton } from "@/components/course-composer";
import { DispatchNoteHint } from "@/components/dispatch-note";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { CourseStop, FleetSnapshot, VehicleType } from "@/lib/types";
import { useAdminFleet } from "@/lib/use-admin-fleet";
import { COURSE_STATUS_LABEL, tourLine, vehicleLine } from "@/lib/format";
import { isDriverAtCapacity } from "@/lib/assignment";

type Props = {
  googleMapsApiKey: string;
};

export default function AdminDashboard({ googleMapsApiKey }: Props) {
  const { devices, courses, roster, now, online, liveById, alerts, applySnapshot, markAlertsRead, dismissAlerts } =
    useAdminFleet();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [mapOpen, setMapOpen] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [prefillDriverId, setPrefillDriverId] = useState<string | null>(null);

  function openComposer(driverId?: string | null) {
    if (driverId && isDriverAtCapacity(courses, driverId)) return;
    setPrefillDriverId(driverId ?? null);
    setMapOpen(false);
    setComposerOpen(true);
  }

  function closeComposer() {
    setComposerOpen(false);
    setPrefillDriverId(null);
  }

  const selectedCourse = courses.find((course) => course.id === selectedCourseId) ?? null;
  const runningJobs = courses
    .filter((course) => course.status === "en_route")
    .sort((a, b) => (b.startedAt ?? b.updatedAt) - (a.startedAt ?? a.updatedAt));

  async function patchCourse(
    id: string,
    body: {
      assignedDeviceId?: string | null;
      status?: string;
      vehicleType?: VehicleType | null;
      vehiclePlate?: string | null;
      notes?: string;
      stops?: CourseStop[];
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
        active="dispatch"
        online={online}
        alerts={alerts}
        onMarkAlertsRead={(ids) => void markAlertsRead(ids)}
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
          <NewCourseButton onClick={() => openComposer(null)} />
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
        </section>

        <section className="space-y-5">
          <DispatchMap
            googleMapsApiKey={googleMapsApiKey}
            devices={devices}
            courses={courses}
            roster={roster}
            now={now}
            selectedId={selectedId}
            onSelect={setSelectedId}
            open={mapOpen}
            onOpenChange={setMapOpen}
            onAssignCourse={(driverId) => openComposer(driverId)}
          />

          {selectedCourse ? (
            <CourseEditor
              key={`${selectedCourse.id}-${selectedCourse.updatedAt}`}
              course={selectedCourse}
              roster={roster}
              courses={courses}
              onSave={(id, body) => patchCourse(id, body)}
            />
          ) : null}

          <div className="overflow-hidden rounded-2xl border border-[#d5dcf0] bg-white shadow-sm">
            <div className="flex items-start justify-between gap-3 border-b border-[#d5dcf0] px-4 py-3">
              <div>
                <h2 className="text-base font-semibold text-[#2b308f]">Courses en cours</h2>
                <p className="text-xs text-[#5b6294]">Uniquement les courses actuellement en exécution.</p>
              </div>
              <Link href="/admin/courses" className="text-xs font-medium text-[#00a4e8] hover:underline">
                Toutes les courses
              </Link>
            </div>
            {runningJobs.length === 0 ? (
              <p className="px-4 py-8 text-sm text-[#5b6294]">
                Aucune course en cours. Les courses en attente de BN et l’historique sont dans Courses.
              </p>
            ) : (
              <ul className="divide-y divide-[#d5dcf0]">
                {runningJobs.map((course) => (
                  <li key={course.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCourseId(course.id);
                        void dismissAlerts({ courseId: course.id });
                      }}
                      className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left hover:bg-[#f4f7fc]"
                    >
                      <div>
                        <div className="font-semibold text-[#2b308f]">{course.reference}</div>
                        <div className="text-sm">{course.clientName}</div>
                        <div className="mt-1 text-xs text-[#5b6294]">
                          {tourLine(course)}
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

      {composerOpen ? (
        <CourseComposer
          key={prefillDriverId ?? "new"}
          open
          onClose={closeComposer}
          roster={roster}
          courses={courses}
          liveById={liveById}
          assignDriverId={prefillDriverId}
          onCreated={(data: FleetSnapshot) => {
            applySnapshot(data);
            setSelectedCourseId(data.courses?.[0]?.id ?? null);
          }}
        />
      ) : null}
    </div>
  );
}

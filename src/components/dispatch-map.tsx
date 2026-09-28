"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ClipboardPlus, MapPinned, Maximize2, X } from "lucide-react";
import FleetMap from "@/components/fleet-map";
import { PhoneLink } from "@/components/admin-fields";
import { PresenceBadge, PresenceLegend } from "@/components/presence-badge";
import { Button } from "@/components/ui/button";
import {
  assignmentBlockedMessage,
  isDriverAtCapacity,
  liveJobsForDriver,
  MAX_LIVE_JOBS,
} from "@/lib/assignment";
import type { Course, CourseStop, FleetDevice } from "@/lib/types";
import { COURSE_STATUS_LABEL, courseStops, formatKm, formatMinutes, tourLine, vehicleLine, type MapRoute } from "@/lib/format";
import type { RosterDriver } from "@/lib/roster";

type Props = {
  googleMapsApiKey: string;
  devices: FleetDevice[];
  courses: Course[];
  roster: RosterDriver[];
  now: number;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAssignCourse: (driverId: string) => void;
};

export default function DispatchMap({
  googleMapsApiKey,
  devices,
  courses,
  roster,
  now,
  selectedId,
  onSelect,
  open,
  onOpenChange,
  onAssignCourse,
}: Props) {
  const [route, setRoute] = useState<MapRoute | null>(null);
  const [hint, setHint] = useState("Cliquez un chauffeur pour lui attribuer une course.");
  const snapshotRef = useRef({ devices, courses });
  useEffect(() => {
    snapshotRef.current = { devices, courses };
  }, [devices, courses]);
  const drivers = devices.filter((d) => d.role === "driver");
  const selectedDevice = drivers.find((device) => device.id === selectedId) ?? null;
  const selectedRoster = roster.find((driver) => driver.id === selectedId) ?? null;
  const selectedHeld = selectedId ? liveJobsForDriver(courses, selectedId) : [];
  const selectedFull = selectedId ? isDriverAtCapacity(courses, selectedId) : false;
  const selectedCallSign = selectedDevice?.callSign ?? selectedRoster?.callSign ?? null;

  const traceDriver = useCallback(async (id: string) => {
    const { devices: liveDevices, courses: liveCourses } = snapshotRef.current;
      const driver = liveDevices.find((d) => d.id === id);
      const job = liveCourses.find((c) => c.assignedDeviceId === id && c.status === "en_route");
      if (!job) {
        setRoute(null);
        setHint(
          driver
            ? `${driver.callSign} n’a pas de course démarrée. Attribuez-lui une course depuis la fiche.`
            : "Cliquez un chauffeur pour lui attribuer une course.",
        );
        return;
      }
      const stops = courseStops(job).filter(
        (stop): stop is CourseStop & { lat: number; lng: number } =>
          stop.lat != null && stop.lng != null && Number.isFinite(stop.lat) && Number.isFinite(stop.lng),
      );
      if (!stops.length) {
        setRoute(null);
        setHint("Cette course n’a pas de destinations.");
        return;
      }
      const last = stops[stops.length - 1];
      const fromLat = driver?.lat ?? job.pickupLat;
      const fromLng = driver?.lng ?? job.pickupLng;
      if (fromLat == null || fromLng == null) {
        setRoute(null);
        setHint("Pas de position GPS pour tracer jusqu’aux destinations.");
        return;
      }
      setHint("Calcul de l’itinéraire depuis la position actuelle…");
      const points = [{ lat: fromLat, lng: fromLng }, ...stops.map((stop) => ({ lat: stop.lat, lng: stop.lng }))];
      const mappedStops = stops.map((stop) => ({ lat: stop.lat, lng: stop.lng, label: stop.address }));
      try {
        const res = await fetch(
          `/api/routes?points=${encodeURIComponent(points.map((point) => `${point.lat},${point.lng}`).join("|"))}`,
        );
        const data = (await res.json()) as {
          path?: [number, number][];
          distanceMeters?: number | null;
          durationSeconds?: number | null;
        };
        const path =
          data.path && data.path.length >= 2
            ? data.path
            : (points.map((point) => [point.lat, point.lng] as [number, number]));
        setRoute({
          path,
          pickup: { lat: fromLat, lng: fromLng, label: "Position actuelle" },
          dropoff: { lat: last.lat, lng: last.lng, label: last.address },
          stops: mappedStops,
        });
        const dist = formatKm(data.distanceMeters ?? null);
        const dur = formatMinutes(data.durationSeconds ?? null);
        setHint(
          `${driver?.callSign ?? "Chauffeur"} · ${job.reference} · ${COURSE_STATUS_LABEL[job.status]}` +
            (dist ? ` · ${dist}` : "") +
            (dur ? ` · ${dur}` : "") +
            ` · ${tourLine(job)}`,
        );
      } catch {
        setRoute({
          path: points.map((point) => [point.lat, point.lng] as [number, number]),
          pickup: { lat: fromLat, lng: fromLng, label: "Position actuelle" },
          dropoff: { lat: last.lat, lng: last.lng, label: last.address },
          stops: mappedStops,
        });
        setHint("Itinéraire approximatif (ligne directe).");
      }
  }, []);

  useEffect(() => {
    if (!open) return;
    if (!selectedId) {
      const clear = window.setTimeout(() => {
        setRoute(null);
        setHint("Cliquez un chauffeur pour lui attribuer une course.");
      }, 0);
      return () => window.clearTimeout(clear);
    }
    void traceDriver(selectedId);
  }, [open, selectedId, traceDriver]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onOpenChange]);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          onSelect(null);
          onOpenChange(true);
        }}
        className="group relative block h-[420px] w-full overflow-hidden rounded-2xl border border-[#d5dcf0] bg-white text-left shadow-sm"
      >
        <div className="pointer-events-none h-full">
          <FleetMap
            googleMapsApiKey={googleMapsApiKey}
            devices={drivers}
            now={now}
            selectedId={selectedId}
            onSelect={() => undefined}
            follow={null}
            stickToMe={false}
            recenterKey={0}
            onUserPan={() => undefined}
            selfId={null}
            route={null}
          />
        </div>
        <div className="absolute inset-0 z-20 flex items-end bg-gradient-to-t from-[#151a45]/85 via-transparent to-transparent p-4">
          <div className="flex w-full items-center justify-between gap-3 text-white">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold">
                <MapPinned className="size-4 text-[#7dd8f7]" />
                Carte de la flotte
              </div>
              <p className="mt-0.5 text-xs text-blue-100">
                Cliquez pour le plein écran · dernière position de chaque chauffeur, connecté ou non
              </p>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-xs font-medium group-hover:bg-white/25">
              <Maximize2 className="size-3.5" />
              Plein écran
            </span>
          </div>
        </div>
        <div className="pointer-events-none absolute left-3 top-3 z-20 rounded-xl bg-white/95 px-3 py-2 shadow-sm">
          <PresenceLegend />
        </div>
      </button>

      {open ? (
        <div className="fixed inset-0 z-[80] flex flex-col bg-[#0c1028]">
          <header className="flex items-center justify-between gap-3 px-4 py-3 text-white">
            <div>
              <div className="text-sm font-semibold">Carte — tous les chauffeurs</div>
              <p className="text-[11px] text-blue-200">{hint}</p>
              <PresenceLegend className="mt-1 text-blue-100" />
            </div>
            <Button variant="secondary" size="sm" className="rounded-xl" onClick={() => onOpenChange(false)}>
              <X className="size-4" />
              Fermer
            </Button>
          </header>
          <div className="relative min-h-0 flex-1">
            <FleetMap
              key="dispatch-full"
              googleMapsApiKey={googleMapsApiKey}
              devices={drivers}
              now={now}
              selectedId={selectedId}
              onSelect={(id) => onSelect(id)}
              follow={null}
              stickToMe={false}
              recenterKey={0}
              onUserPan={() => undefined}
              selfId={null}
              route={route}
              onAssignCourse={onAssignCourse}
            />
            {selectedDevice ? (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 p-4 md:inset-x-auto md:left-4 md:w-[380px]">
                <div className="pointer-events-auto rounded-2xl border border-[#d5dcf0] bg-white p-4 text-[#1c2268] shadow-2xl">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-[#2b308f]">
                        {selectedDevice.callSign} · {selectedDevice.driverName}
                      </div>
                      <p className="mt-1 text-xs text-[#5b6294]">
                        {vehicleLine(selectedRoster ?? selectedDevice)}
                      </p>
                    </div>
                    <button
                      type="button"
                      aria-label="Fermer la fiche"
                      className="rounded-lg p-1 text-[#5b6294] hover:bg-[#f4f7fc]"
                      onClick={() => onSelect(null)}
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <PresenceBadge
                      connected={selectedDevice.connected}
                      lastSeen={selectedDevice.lastSeen}
                      now={now}
                    />
                    <span className="text-[11px] text-[#5b6294]">
                      {selectedHeld.length === 0
                        ? "Aucune course en cours"
                        : `${selectedHeld.length} / ${MAX_LIVE_JOBS} course${selectedHeld.length > 1 ? "s" : ""}`}
                    </span>
                  </div>
                  {selectedDevice.phone ? (
                    <p className="mt-2 text-xs">
                      <PhoneLink phone={selectedDevice.phone} className="font-medium text-[#00a4e8] hover:underline" />
                    </p>
                  ) : null}
                  {selectedFull ? (
                    <p className="mt-3 text-xs text-red-600">
                      {assignmentBlockedMessage(selectedHeld, selectedCallSign)}
                    </p>
                  ) : (
                    <p className="mt-3 text-xs text-[#5b6294]">
                      La fiche chauffeur sera déjà remplie. Il restera le voyage et les destinations.
                    </p>
                  )}
                  <Button
                    type="button"
                    className="mt-3 h-10 w-full"
                    disabled={selectedFull}
                    onClick={() => onAssignCourse(selectedDevice.id)}
                  >
                    <ClipboardPlus className="size-4" />
                    Attribuer une course
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}

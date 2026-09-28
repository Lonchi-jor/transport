"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MapPinned, Maximize2, X } from "lucide-react";
import FleetMap from "@/components/fleet-map";
import { PresenceLegend } from "@/components/presence-badge";
import { Button } from "@/components/ui/button";
import type { Course, FleetDevice } from "@/lib/types";
import { COURSE_STATUS_LABEL, formatKm, formatMinutes, type MapRoute } from "@/lib/format";

type Props = {
  googleMapsApiKey: string;
  devices: FleetDevice[];
  courses: Course[];
  now: number;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export default function DispatchMap({
  googleMapsApiKey,
  devices,
  courses,
  now,
  selectedId,
  onSelect,
  open,
  onOpenChange,
}: Props) {
  const [route, setRoute] = useState<MapRoute | null>(null);
  const [hint, setHint] = useState("Cliquez un chauffeur pour voir sa course.");
  const snapshotRef = useRef({ devices, courses });
  useEffect(() => {
    snapshotRef.current = { devices, courses };
  }, [devices, courses]);
  const drivers = devices.filter((d) => d.role === "driver");

  const traceDriver = useCallback(async (id: string) => {
    const { devices: liveDevices, courses: liveCourses } = snapshotRef.current;
      const driver = liveDevices.find((d) => d.id === id);
      const job = liveCourses.find((c) => c.assignedDeviceId === id && c.status === "en_route");
      if (!job) {
        setRoute(null);
        setHint(
          driver
            ? `${driver.callSign} n’a pas de course démarrée (BN validé).`
            : "Cliquez un chauffeur pour voir sa course.",
        );
        return;
      }
      if (job.dropoffLat == null || job.dropoffLng == null) {
        setRoute(null);
        setHint("Cette course n’a pas de coordonnées d’arrivée.");
        return;
      }
      const fromLat = driver?.lat ?? job.pickupLat;
      const fromLng = driver?.lng ?? job.pickupLng;
      if (fromLat == null || fromLng == null) {
        setRoute(null);
        setHint("Pas de position GPS pour tracer jusqu’à la destination.");
        return;
      }
      setHint("Calcul de l’itinéraire depuis la position actuelle…");
      try {
        const res = await fetch(
          `/api/routes?fromLat=${fromLat}&fromLng=${fromLng}&toLat=${job.dropoffLat}&toLng=${job.dropoffLng}`,
        );
        const data = (await res.json()) as {
          path?: [number, number][];
          distanceMeters?: number | null;
          durationSeconds?: number | null;
        };
        const path =
          data.path && data.path.length >= 2
            ? data.path
            : ([[fromLat, fromLng], [job.dropoffLat, job.dropoffLng]] as [number, number][]);
        setRoute({
          path,
          pickup: { lat: fromLat, lng: fromLng, label: "Position actuelle" },
          dropoff: { lat: job.dropoffLat, lng: job.dropoffLng, label: job.dropoffAddress },
        });
        const dist = formatKm(data.distanceMeters ?? null);
        const dur = formatMinutes(data.durationSeconds ?? null);
        setHint(
          `${driver?.callSign ?? "Chauffeur"} · ${job.reference} · ${COURSE_STATUS_LABEL[job.status]}` +
            (dist ? ` · ${dist}` : "") +
            (dur ? ` · ${dur}` : "") +
            ` → ${job.dropoffAddress}`,
        );
      } catch {
        setRoute({
          path: [
            [fromLat, fromLng],
            [job.dropoffLat, job.dropoffLng],
          ],
          pickup: { lat: fromLat, lng: fromLng, label: "Position actuelle" },
          dropoff: { lat: job.dropoffLat, lng: job.dropoffLng, label: job.dropoffAddress },
        });
        setHint("Itinéraire approximatif (ligne directe).");
      }
  }, []);

  useEffect(() => {
    if (!open) return;
    if (!selectedId) {
      const clear = window.setTimeout(() => {
        setRoute(null);
        setHint("Cliquez un chauffeur pour voir sa course.");
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
        className="group relative block h-[220px] w-full overflow-hidden rounded-2xl border border-[#d5dcf0] bg-white text-left shadow-sm"
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
            />
          </div>
        </div>
      ) : null}
    </>
  );
}

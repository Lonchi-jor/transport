import type { Course, CourseStatus, CourseStop, FleetDevice, TrailerUnit, VehicleType } from "@/lib/types";
import { VEHICLE_META } from "@/lib/types";

export type MapFollow = {
  lat: number;
  lng: number;
};

export const DEFAULT_CENTER = { lat: 4.051056, lng: 9.767869 };

export function kph(speedMps: number | null) {
  if (speedMps == null) return null;
  return Math.round(speedMps * 3.6);
}

export function statusLabel(device: FleetDevice, now: number) {
  if (device.role === "dispatcher") return "Dispatch desk";
  if (!device.sharing || device.lat == null) return "No GPS";
  const age = now - device.lastSeen;
  if (age > 12_000) return "Signal weak";
  if ((device.speedMps ?? 0) < 1.2) return "Idle";
  return "En route";
}

export function formatAge(lastSeen: number, now: number) {
  const sec = Math.max(0, Math.round((now - lastSeen) / 1000));
  if (sec < 3) return "just now";
  if (sec < 60) return `${sec}s ago`;
  return `${Math.round(sec / 60)}m ago`;
}

export function devicesWithPosition(devices: FleetDevice[]) {
  return devices.filter((d) => d.lat != null && d.lng != null);
}

export const COURSE_STATUS_LABEL: Record<CourseStatus, string> = {
  open: "À attribuer",
  assigned: "Reçue — BN à saisir",
  en_route: "En course",
  done: "Terminée",
  cancelled: "Annulée",
};

export function activeCourses(courses: Course[]) {
  return courses.filter((c) => c.status === "open" || c.status === "assigned" || c.status === "en_route");
}

export type CourseViewFilter = "all" | "live" | "done";

export function parseCourseViewFilter(value: string | null | undefined): CourseViewFilter {
  return value === "live" || value === "done" ? value : "all";
}

/** Dispatch bell → finished job on the courses board, with BL download. */
export function finishedCourseHref(courseId: string) {
  const params = new URLSearchParams();
  params.set("filtre", "done");
  params.set("focus", courseId);
  return `/admin/courses?${params.toString()}`;
}

export function isLiveAssignedCourse(course: Course) {
  return course.status === "assigned" || course.status === "en_route";
}

export function matchesCourseView(course: Course, view: CourseViewFilter) {
  if (view === "live") return isLiveAssignedCourse(course);
  if (view === "done") return course.status === "done";
  return true;
}

export type MapRoute = {
  path: [number, number][];
  pickup: { lat: number; lng: number; label: string };
  dropoff: { lat: number; lng: number; label: string };
  stops?: { lat: number; lng: number; label: string }[];
};

export function stopsFingerprint(stops: CourseStop[]) {
  return stops
    .map((stop) => `${stop.address.trim()}|${stop.lat ?? ""}|${stop.lng ?? ""}`)
    .join(";;");
}

export function courseStops(
  course: Pick<Course, "stops" | "dropoffAddress" | "dropoffLat" | "dropoffLng">,
): CourseStop[] {
  if (Array.isArray(course.stops) && course.stops.length > 0) return course.stops;
  if (!course.dropoffAddress && course.dropoffLat == null) return [];
  return [
    {
      id: "dropoff",
      address: course.dropoffAddress,
      lat: course.dropoffLat,
      lng: course.dropoffLng,
    },
  ];
}

export function tourLine(course: Course) {
  const dests = courseStops(course).map((stop, index) => {
    const name = shortPlace(stop.address);
    return name ? `${index + 1}. ${name}` : "";
  });
  const parts = [shortPlace(course.pickupAddress), ...dests].filter(Boolean);
  return parts.join(" → ");
}

export function courseToMapRoute(course: Course | null | undefined): MapRoute | null {
  if (!course) return null;
  const stops = courseStops(course).filter(
    (stop): stop is CourseStop & { lat: number; lng: number } =>
      stop.lat != null && stop.lng != null && Number.isFinite(stop.lat) && Number.isFinite(stop.lng),
  );
  if (course.pickupLat == null || course.pickupLng == null || stops.length === 0) {
    return null;
  }
  const last = stops[stops.length - 1];
  const path: [number, number][] =
    course.routePath.length >= 2
      ? course.routePath
      : [[course.pickupLat, course.pickupLng], ...stops.map((stop) => [stop.lat, stop.lng] as [number, number])];
  return {
    path,
    pickup: { lat: course.pickupLat, lng: course.pickupLng, label: course.pickupAddress },
    dropoff: { lat: last.lat, lng: last.lng, label: last.address },
    stops: stops.map((stop) => ({ lat: stop.lat, lng: stop.lng, label: stop.address })),
  };
}

export function formatKm(meters: number | null) {
  if (meters == null) return null;
  return `${(meters / 1000).toFixed(1)} km`;
}

export function formatMinutes(seconds: number | null) {
  if (seconds == null) return null;
  return `${Math.max(1, Math.round(seconds / 60))} min`;
}

export function formatElapsed(ms: number | null) {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return null;
  const sec = Math.round(ms / 1000);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h} h ${m} min`;
  if (m > 0) return s > 0 && m < 10 ? `${m} min ${s} s` : `${m} min`;
  return `${s} s`;
}

export function vehicleLine(input: {
  vehicleType?: VehicleType | null;
  vehiclePlate?: string | null;
  trailerPlates?: string[] | null;
  trailers?: TrailerUnit[] | null;
}) {
  const tractor = input.vehiclePlate?.trim() || null;
  const trailerBits =
    input.trailers && input.trailers.length > 0
      ? input.trailers
          .map((trailer) => {
            const plate = trailer.plate.trim();
            if (!plate) return "";
            const type = VEHICLE_META[trailer.type]?.label;
            return [type, plate].filter(Boolean).join(" ");
          })
          .filter(Boolean)
      : (input.trailerPlates ?? []).map((plate) => plate.trim()).filter(Boolean);
  const plates = [tractor, ...trailerBits].filter(Boolean).join(" + ");
  const type =
    input.trailers && input.trailers.length > 0
      ? null
      : input.vehicleType
        ? VEHICLE_META[input.vehicleType].label
        : null;
  return [plates, type].filter(Boolean).join(" · ") || "Véhicule non renseigné";
}

export function telHref(phone: string) {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

export function shortPlace(value: string) {
  const first = value.split(",")[0]?.trim();
  return first || value.trim();
}

export function formatWhen(ts: number | null | undefined) {
  if (ts == null || !Number.isFinite(ts) || ts <= 0) return null;
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Africa/Douala",
  }).format(new Date(ts));
}

export function formatCoords(lat: number | null | undefined, lng: number | null | undefined) {
  if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

export function courseElapsedLabel(course: Course, now: number) {
  if (!course.startedAt) return null;
  if (course.status === "en_route") {
    const label = formatElapsed(now - course.startedAt);
    return label ? `En course depuis ${label}` : null;
  }
  if (course.finishedAt) {
    const label = formatElapsed(course.finishedAt - course.startedAt);
    return label ? `Durée ${label}` : null;
  }
  return null;
}

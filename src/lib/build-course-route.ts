import { drivingItinerary, resolvePlace } from "@/lib/geo";
import { MAX_TOUR_STOPS, type CourseStop } from "@/lib/types";

export type RawStopInput = {
  id?: string;
  address?: string;
  lat?: number | null;
  lng?: number | null;
};

export async function geocodeTourStops(rawStops: RawStopInput[]): Promise<CourseStop[]> {
  const stops: CourseStop[] = [];
  for (const stop of rawStops.slice(0, MAX_TOUR_STOPS)) {
    if (!stop.address?.trim() && (stop.lat == null || stop.lng == null)) continue;
    const place = await resolvePlace(stop.address || "", stop.lat, stop.lng);
    stops.push({
      id: stop.id?.trim() || crypto.randomUUID(),
      address: place.label || (stop.address ?? "").trim(),
      lat: Number.isFinite(place.lat) ? place.lat : null,
      lng: Number.isFinite(place.lng) ? place.lng : null,
    });
  }
  return stops;
}

export async function itineraryForTour(
  pickup: { lat: number | null; lng: number | null },
  stops: CourseStop[],
) {
  const waypoints = [
    { lat: pickup.lat, lng: pickup.lng },
    ...stops.map((stop) => ({ lat: stop.lat, lng: stop.lng })),
  ].filter(
    (point): point is { lat: number; lng: number } =>
      point.lat != null &&
      point.lng != null &&
      Number.isFinite(point.lat) &&
      Number.isFinite(point.lng),
  );
  if (waypoints.length < 2) return null;
  return drivingItinerary(waypoints);
}

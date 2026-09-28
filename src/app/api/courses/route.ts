import { NextResponse } from "next/server";
import { createCourse } from "@/lib/course-store";
import { getDriver, isVehicleType } from "@/lib/driver-store";
import { drivingItinerary, resolvePlace } from "@/lib/geo";
import { radioSnapshot } from "@/lib/snapshot";
import { isCourseRuleError } from "@/lib/assignment";
import type { CourseDraft, CourseStop, VehicleType } from "@/lib/types";
import { MAX_TOUR_STOPS } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(radioSnapshot());
}

export async function POST(request: Request) {
  let body: CourseDraft;
  try {
    body = (await request.json()) as CourseDraft;
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }
  if (!body?.clientName?.trim() || !body?.pickupAddress?.trim()) {
    return NextResponse.json(
      { error: "Le client et le point de voyage sont obligatoires." },
      { status: 400 },
    );
  }

  const rawStops = Array.isArray(body.stops) && body.stops.length
    ? body.stops
    : body.dropoffAddress
      ? [
          {
            id: "dropoff",
            address: body.dropoffAddress,
            lat: body.dropoffLat ?? null,
            lng: body.dropoffLng ?? null,
          },
        ]
      : [];
  if (!rawStops.some((stop) => stop.address?.trim())) {
    return NextResponse.json(
      { error: "Ajoutez au moins une destination pour le tour de ville." },
      { status: 400 },
    );
  }

  if (body.assignedDeviceId && !getDriver(body.assignedDeviceId)) {
    return NextResponse.json({ error: "Chauffeur inconnu. Créez-le d’abord dans le bureau." }, { status: 400 });
  }

  const createdByAdminId =
    typeof body.createdByAdminId === "string" ? body.createdByAdminId.trim().slice(0, 80) : "";

  const pickup = await resolvePlace(body.pickupAddress, body.pickupLat, body.pickupLng);
  const stops: CourseStop[] = [];
  for (const stop of rawStops.slice(0, MAX_TOUR_STOPS)) {
    if (!stop.address?.trim() && stop.lat == null) continue;
    const place = await resolvePlace(stop.address || "", stop.lat, stop.lng);
    stops.push({
      id: stop.id?.trim() || crypto.randomUUID(),
      address: place.label || stop.address.trim(),
      lat: Number.isFinite(place.lat) ? place.lat : null,
      lng: Number.isFinite(place.lng) ? place.lng : null,
    });
  }
  const last = stops[stops.length - 1];
  if (!last) {
    return NextResponse.json(
      { error: "Ajoutez au moins une destination pour le tour de ville." },
      { status: 400 },
    );
  }

  const waypoints = [
    { lat: pickup.lat, lng: pickup.lng },
    ...stops
      .filter((stop) => stop.lat != null && stop.lng != null)
      .map((stop) => ({ lat: stop.lat as number, lng: stop.lng as number })),
  ];
  const hasCoords = waypoints.length >= 2 && waypoints.every((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng));
  const route = hasCoords ? await drivingItinerary(waypoints) : null;

  const vehicleType: VehicleType | null = isVehicleType(body.vehicleType) ? body.vehicleType : null;

  try {
    const course = createCourse({
      ...body,
      pickupAddress: pickup.label || body.pickupAddress,
      dropoffAddress: last.address,
      pickupLat: Number.isFinite(pickup.lat) ? pickup.lat : null,
      pickupLng: Number.isFinite(pickup.lng) ? pickup.lng : null,
      dropoffLat: last.lat,
      dropoffLng: last.lng,
      stops,
      routePath: route?.path ?? [],
      distanceMeters: route?.distanceMeters ?? null,
      durationSeconds: route?.durationSeconds ?? null,
      vehicleType: vehicleType ?? undefined,
      vehiclePlate: body.vehiclePlate,
      createdByAdminId: createdByAdminId || null,
    });
    return NextResponse.json({ course, ...radioSnapshot() });
  } catch (error) {
    if (isCourseRuleError(error)) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }
}

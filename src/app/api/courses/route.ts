import { NextResponse } from "next/server";
import { createCourse } from "@/lib/course-store";
import { getDriver, isVehicleType } from "@/lib/driver-store";
import { resolvePlace } from "@/lib/geo";
import { geocodeTourStops, itineraryForTour } from "@/lib/build-course-route";
import { radioSnapshot } from "@/lib/snapshot";
import { isCourseRuleError } from "@/lib/assignment";
import type { CourseDraft, VehicleType } from "@/lib/types";

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
      { error: "Le client et le point de départ sont obligatoires." },
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
  const stops = await geocodeTourStops(rawStops);
  const last = stops[stops.length - 1];
  if (!last) {
    return NextResponse.json(
      { error: "Ajoutez au moins une destination pour le tour de ville." },
      { status: 400 },
    );
  }

  const route = await itineraryForTour(
    { lat: Number.isFinite(pickup.lat) ? pickup.lat : null, lng: Number.isFinite(pickup.lng) ? pickup.lng : null },
    stops,
  );

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

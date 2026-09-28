import { NextResponse } from "next/server";
import { createCourse } from "@/lib/course-store";
import { getDriver, isVehicleType } from "@/lib/driver-store";
import { drivingRoute, resolvePlace } from "@/lib/geo";
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
  if (!body?.clientName?.trim() || !body?.pickupAddress?.trim() || !body?.dropoffAddress?.trim()) {
    return NextResponse.json(
      { error: "Client, enlèvement et livraison sont obligatoires." },
      { status: 400 },
    );
  }

  if (body.assignedDeviceId && !getDriver(body.assignedDeviceId)) {
    return NextResponse.json({ error: "Chauffeur inconnu. Créez-le d’abord dans le bureau." }, { status: 400 });
  }

  const createdByAdminId =
    typeof body.createdByAdminId === "string" ? body.createdByAdminId.trim().slice(0, 80) : "";

  const pickup = await resolvePlace(body.pickupAddress, body.pickupLat, body.pickupLng);
  const dropoff = await resolvePlace(body.dropoffAddress, body.dropoffLat, body.dropoffLng);
  const hasCoords =
    Number.isFinite(pickup.lat) &&
    Number.isFinite(pickup.lng) &&
    Number.isFinite(dropoff.lat) &&
    Number.isFinite(dropoff.lng);
  const route = hasCoords
    ? await drivingRoute(
        { lat: pickup.lat, lng: pickup.lng },
        { lat: dropoff.lat, lng: dropoff.lng },
      )
    : null;

  const vehicleType: VehicleType | null = isVehicleType(body.vehicleType) ? body.vehicleType : null;

  try {
    const course = createCourse({
      ...body,
      pickupAddress: pickup.label || body.pickupAddress,
      dropoffAddress: dropoff.label || body.dropoffAddress,
      pickupLat: hasCoords ? pickup.lat : null,
      pickupLng: hasCoords ? pickup.lng : null,
      dropoffLat: hasCoords ? dropoff.lat : null,
      dropoffLng: hasCoords ? dropoff.lng : null,
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

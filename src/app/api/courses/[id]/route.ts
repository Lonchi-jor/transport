import { NextResponse } from "next/server";
import { getCourse, isCourseStatus, updateCourse } from "@/lib/course-store";
import { getDriver, isVehicleType } from "@/lib/driver-store";
import { snapshotFromRequest } from "@/lib/snapshot";
import { isCourseRuleError } from "@/lib/assignment";
import { geocodeTourStops, itineraryForTour } from "@/lib/build-course-route";
import type { CourseStop } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  let body: {
    assignedDeviceId?: string | null;
    status?: string;
    bnNumber?: string;
    notes?: string;
    vehicleType?: string | null;
    vehiclePlate?: string | null;
    stops?: CourseStop[];
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }
  if (body.status !== undefined && !isCourseStatus(body.status)) {
    return NextResponse.json({ error: "Statut inconnu" }, { status: 400 });
  }
  if (body.assignedDeviceId && !getDriver(body.assignedDeviceId)) {
    return NextResponse.json({ error: "Chauffeur inconnu. Créez-le d’abord dans le bureau." }, { status: 400 });
  }
  if (body.vehicleType != null && body.vehicleType !== "" && !isVehicleType(body.vehicleType)) {
    return NextResponse.json({ error: "Type de véhicule inconnu." }, { status: 400 });
  }
  if (body.stops !== undefined && !Array.isArray(body.stops)) {
    return NextResponse.json({ error: "Destinations invalides." }, { status: 400 });
  }
  const current = getCourse(id);
  if (!current) {
    return NextResponse.json({ error: "Course introuvable" }, { status: 404 });
  }
  if (body.status === "en_route") {
    const bn = (body.bnNumber ?? current.bnNumber ?? "").trim();
    if (!bn) {
      return NextResponse.json(
        { error: "Saisissez le numéro du BN avant de démarrer la course." },
        { status: 400 },
      );
    }
  }
  if (body.status === "done" && !current.hasDeliveryScan) {
    return NextResponse.json(
      { error: "Joignez la photo du bon de livraison avant de terminer la course." },
      { status: 400 },
    );
  }

  let stops: CourseStop[] | undefined;
  let routePath: [number, number][] | undefined;
  let distanceMeters: number | null | undefined;
  let durationSeconds: number | null | undefined;
  if (body.stops) {
    stops = await geocodeTourStops(body.stops);
    if (!stops.length) {
      return NextResponse.json({ error: "Gardez au moins une destination." }, { status: 400 });
    }
    const route = await itineraryForTour(
      { lat: current.pickupLat, lng: current.pickupLng },
      stops,
    );
    routePath = route?.path ?? [];
    distanceMeters = route?.distanceMeters ?? null;
    durationSeconds = route?.durationSeconds ?? null;
  }

  let course;
  try {
    course = updateCourse(id, {
      assignedDeviceId: body.assignedDeviceId,
      status: isCourseStatus(body.status) ? body.status : undefined,
      bnNumber: body.bnNumber,
      notes: body.notes,
      vehicleType: isVehicleType(body.vehicleType) ? body.vehicleType : body.vehicleType === null ? null : undefined,
      vehiclePlate: body.vehiclePlate,
      stops,
      routePath,
      distanceMeters,
      durationSeconds,
    });
  } catch (error) {
    if (isCourseRuleError(error)) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }
  if (!course) {
    return NextResponse.json({ error: "Course introuvable ou BN manquant" }, { status: 404 });
  }
  return NextResponse.json({ course, ...snapshotFromRequest(request) });
}

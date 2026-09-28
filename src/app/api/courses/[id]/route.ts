import { NextResponse } from "next/server";
import { getCourse, isCourseStatus, updateCourse } from "@/lib/course-store";
import { getDriver, isVehicleType } from "@/lib/driver-store";
import { snapshotFromRequest } from "@/lib/snapshot";
import { isCourseRuleError } from "@/lib/assignment";

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
  const current = getCourse(id);
  if (body.status === "en_route") {
    const bn = (body.bnNumber ?? current?.bnNumber ?? "").trim();
    if (!bn) {
      return NextResponse.json(
        { error: "Saisissez le numéro du BN avant de démarrer la course." },
        { status: 400 },
      );
    }
  }
  if (body.status === "done" && !current?.hasDeliveryScan) {
    return NextResponse.json(
      { error: "Joignez la photo du bon de livraison avant de terminer la course." },
      { status: 400 },
    );
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

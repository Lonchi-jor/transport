import { NextResponse } from "next/server";
import { getCourse, isCourseStatus, updateCourse } from "@/lib/course-store";
import { radioSnapshot } from "@/lib/snapshot";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  let body: { assignedDeviceId?: string | null; status?: string; bnNumber?: string };
  try {
    body = (await request.json()) as {
      assignedDeviceId?: string | null;
      status?: string;
      bnNumber?: string;
    };
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }
  if (body.status !== undefined && !isCourseStatus(body.status)) {
    return NextResponse.json({ error: "Statut inconnu" }, { status: 400 });
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
      { error: "Scannez le bon de livraison avant de terminer la course." },
      { status: 400 },
    );
  }
  const course = updateCourse(id, {
    assignedDeviceId: body.assignedDeviceId,
    status: isCourseStatus(body.status) ? body.status : undefined,
    bnNumber: body.bnNumber,
  });
  if (!course) {
    return NextResponse.json({ error: "Course introuvable ou BN manquant" }, { status: 404 });
  }
  return NextResponse.json({ course, ...radioSnapshot() });
}

import { NextResponse } from "next/server";
import { isCourseStatus, updateCourse } from "@/lib/course-store";
import { radioSnapshot } from "@/lib/snapshot";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  let body: { assignedDeviceId?: string | null; status?: string };
  try {
    body = (await request.json()) as { assignedDeviceId?: string | null; status?: string };
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }
  if (body.status !== undefined && !isCourseStatus(body.status)) {
    return NextResponse.json({ error: "Statut inconnu" }, { status: 400 });
  }
  const course = updateCourse(id, {
    assignedDeviceId: body.assignedDeviceId,
    status: isCourseStatus(body.status) ? body.status : undefined,
  });
  if (!course) {
    return NextResponse.json({ error: "Course introuvable" }, { status: 404 });
  }
  return NextResponse.json({ course, ...radioSnapshot() });
}

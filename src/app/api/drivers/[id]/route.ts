import { NextResponse } from "next/server";
import { deleteDriver, getDriver } from "@/lib/driver-store";
import { listCourses, updateCourse } from "@/lib/course-store";
import { removeDevice } from "@/lib/fleet-store";
import { adminSnapshot } from "@/lib/snapshot";

export const dynamic = "force-dynamic";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!getDriver(id)) {
    return NextResponse.json({ error: "Chauffeur introuvable" }, { status: 404 });
  }
  for (const course of listCourses()) {
    if (course.assignedDeviceId === id) {
      updateCourse(course.id, { assignedDeviceId: null });
    }
  }
  removeDevice(id);
  deleteDriver(id);
  return NextResponse.json({ ok: true, ...adminSnapshot() });
}

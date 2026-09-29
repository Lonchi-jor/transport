import { NextResponse } from "next/server";
import { dismissNotifications } from "@/lib/notification-store";
import { getDriver } from "@/lib/driver-store";
import { driverSnapshot, radioSnapshot } from "@/lib/snapshot";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  let body: { targetId?: string; ids?: string[]; courseId?: string; kind?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }
  const targetId = typeof body.targetId === "string" ? body.targetId.trim() : "";
  const ids = Array.isArray(body.ids)
    ? body.ids.filter((id): id is string => typeof id === "string")
    : undefined;
  const courseId = typeof body.courseId === "string" ? body.courseId.trim() : "";
  const kind =
    body.kind === "course_assigned" || body.kind === "course_done" || body.kind === "course_updated"
      ? body.kind
      : undefined;
  const driver = targetId ? getDriver(targetId) : null;
  if (driver) {
    dismissNotifications({
      targetId,
      ids,
      courseId: courseId || undefined,
      kind: kind === "course_assigned" || kind === "course_updated" ? kind : undefined,
    });
    return NextResponse.json(driverSnapshot(targetId));
  }
  if (!ids?.length && !courseId) {
    return NextResponse.json({ error: "Alerte manquante." }, { status: 400 });
  }
  dismissNotifications({
    ids,
    courseId: courseId || undefined,
    kind: kind ?? "course_done",
  });
  return NextResponse.json(radioSnapshot());
}

import { NextResponse } from "next/server";
import { markNotificationsRead } from "@/lib/notification-store";
import { getDriver } from "@/lib/driver-store";
import { driverSnapshot, radioSnapshot } from "@/lib/snapshot";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  let body: { targetId?: string; ids?: string[] };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }
  const targetId = typeof body.targetId === "string" ? body.targetId.trim() : "";
  if (!targetId) {
    return NextResponse.json({ error: "Destinataire manquant." }, { status: 400 });
  }
  const ids = Array.isArray(body.ids)
    ? body.ids.filter((id): id is string => typeof id === "string")
    : undefined;
  markNotificationsRead(targetId, ids);
  const snapshot = getDriver(targetId) ? driverSnapshot(targetId) : radioSnapshot();
  return NextResponse.json(snapshot);
}

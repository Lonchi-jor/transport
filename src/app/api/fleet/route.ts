import { NextResponse } from "next/server";
import { heartbeat, removeDevice } from "@/lib/fleet-store";
import { radioSnapshot } from "@/lib/snapshot";
import type { HeartbeatPayload, VehicleType, Role } from "@/lib/types";
import { ROLES, VEHICLE_TYPES } from "@/lib/types";

export const dynamic = "force-dynamic";

function isVehicleType(value: unknown): value is VehicleType {
  return typeof value === "string" && (VEHICLE_TYPES as readonly string[]).includes(value);
}

function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export async function GET() {
  return NextResponse.json(radioSnapshot());
}

export async function POST(request: Request) {
  let body: HeartbeatPayload;
  try {
    body = (await request.json()) as HeartbeatPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body?.id || !isVehicleType(body.vehicleType) || !isRole(body.role)) {
    return NextResponse.json({ error: "Missing device fields" }, { status: 400 });
  }

  const device = heartbeat(body);
  return NextResponse.json({ device, ...radioSnapshot() });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (id) removeDevice(id);
  return NextResponse.json({ ok: true, ...radioSnapshot() });
}

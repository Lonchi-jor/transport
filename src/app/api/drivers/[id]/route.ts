import { NextResponse } from "next/server";
import { deleteDriver, getDriver, isVehicleType, updateDriver } from "@/lib/driver-store";
import { removeDevice } from "@/lib/fleet-store";
import { deletePresence } from "@/lib/presence-store";
import { adminSnapshot } from "@/lib/snapshot";
import type { TrailerUnit } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!getDriver(id)) {
    return NextResponse.json({ error: "Chauffeur introuvable" }, { status: 404 });
  }
  let body: {
    callSign?: string;
    driverName?: string;
    phone?: string;
    vehicleType?: string;
    vehiclePlate?: string;
    trailerPlates?: string[];
    trailers?: TrailerUnit[];
    pin?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }
  if (!isVehicleType(body.vehicleType)) {
    return NextResponse.json({ error: "Type de véhicule inconnu." }, { status: 400 });
  }
  const result = updateDriver(id, {
    callSign: body.callSign ?? "",
    driverName: body.driverName ?? "",
    phone: body.phone ?? "",
    vehicleType: body.vehicleType,
    vehiclePlate: body.vehiclePlate ?? "",
    trailerPlates: body.trailerPlates,
    trailers: body.trailers,
    pin: body.pin,
  });
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ driver: result, ...adminSnapshot() });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!getDriver(id)) {
    return NextResponse.json({ error: "Chauffeur introuvable" }, { status: 404 });
  }
  removeDevice(id);
  deletePresence(id);
  deleteDriver(id);
  return NextResponse.json({ ok: true, ...adminSnapshot() });
}

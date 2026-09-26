import { NextResponse } from "next/server";
import { createDriver, isVehicleType } from "@/lib/driver-store";
import { adminSnapshot } from "@/lib/snapshot";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(adminSnapshot());
}

export async function POST(request: Request) {
  let body: { callSign?: string; driverName?: string; vehicleType?: string; pin?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }
  if (!isVehicleType(body.vehicleType)) {
    return NextResponse.json({ error: "Type de véhicule inconnu." }, { status: 400 });
  }
  const result = createDriver({
    callSign: body.callSign ?? "",
    driverName: body.driverName ?? "",
    vehicleType: body.vehicleType,
    pin: body.pin,
  });
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ driver: result, ...adminSnapshot() });
}

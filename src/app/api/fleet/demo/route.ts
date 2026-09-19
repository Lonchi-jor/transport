import { NextResponse } from "next/server";
import { isDemoRunning, listDevices, startDemoFleet, stopDemoFleet } from "@/lib/fleet-store";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    demo: isDemoRunning(),
    devices: listDevices(),
    now: Date.now(),
  });
}

export async function POST() {
  startDemoFleet();
  return NextResponse.json({
    demo: true,
    devices: listDevices(),
    now: Date.now(),
  });
}

export async function DELETE() {
  stopDemoFleet();
  return NextResponse.json({
    demo: false,
    devices: listDevices(),
    now: Date.now(),
  });
}

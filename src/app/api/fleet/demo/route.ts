import { NextResponse } from "next/server";
import { startDemoFleet, stopDemoFleet } from "@/lib/fleet-store";
import { radioSnapshot } from "@/lib/snapshot";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(radioSnapshot());
}

export async function POST() {
  startDemoFleet();
  return NextResponse.json(radioSnapshot());
}

export async function DELETE() {
  stopDemoFleet();
  return NextResponse.json(radioSnapshot());
}

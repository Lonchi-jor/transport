import { NextResponse } from "next/server";
import { loginDriver } from "@/lib/driver-store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: { callSign?: string; pin?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }
  const driver = loginDriver(body.callSign ?? "", body.pin ?? "");
  if (!driver) {
    return NextResponse.json(
      { error: "Indicatif ou code incorrect. Demandez vos infos au bureau." },
      { status: 401 },
    );
  }
  return NextResponse.json({ driver: { ...driver, role: "driver" as const } });
}

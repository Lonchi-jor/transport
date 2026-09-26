import { NextResponse } from "next/server";
import { removeDevice } from "@/lib/fleet-store";
import { snapshotFromRequest } from "@/lib/snapshot";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  let id = "";
  try {
    if (contentType.includes("application/json")) {
      const body = (await request.json()) as { id?: string };
      id = body.id ?? "";
    } else {
      const text = await request.text();
      try {
        id = (JSON.parse(text) as { id?: string }).id ?? "";
      } catch {
        id = new URLSearchParams(text).get("id") ?? "";
      }
    }
  } catch {
    id = "";
  }
  if (id) removeDevice(id);
  return NextResponse.json({ ok: true, ...snapshotFromRequest(request) });
}

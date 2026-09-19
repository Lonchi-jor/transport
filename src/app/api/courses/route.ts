import { NextResponse } from "next/server";
import { createCourse } from "@/lib/course-store";
import { radioSnapshot } from "@/lib/snapshot";
import type { CourseDraft } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(radioSnapshot());
}

export async function POST(request: Request) {
  let body: CourseDraft;
  try {
    body = (await request.json()) as CourseDraft;
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }
  if (!body?.clientName?.trim() || !body?.pickupAddress?.trim() || !body?.dropoffAddress?.trim()) {
    return NextResponse.json(
      { error: "Client, enlèvement et livraison sont obligatoires." },
      { status: 400 },
    );
  }
  const course = createCourse(body);
  return NextResponse.json({ course, ...radioSnapshot() });
}

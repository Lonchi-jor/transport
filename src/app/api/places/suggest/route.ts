import { NextResponse } from "next/server";
import { suggestPlaces } from "@/lib/geo";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q") ?? "";
  try {
    const places = await suggestPlaces(q);
    return NextResponse.json({ places });
  } catch {
    return NextResponse.json({ places: [], error: "Recherche indisponible" }, { status: 502 });
  }
}

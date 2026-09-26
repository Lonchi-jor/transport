import { NextResponse } from "next/server";
import { reversePlace } from "@/lib/geo";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const lat = Number(url.searchParams.get("lat"));
  const lng = Number(url.searchParams.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "Coordonnées invalides" }, { status: 400 });
  }
  try {
    const place = await reversePlace(lat, lng);
    return NextResponse.json({ place });
  } catch {
    return NextResponse.json(
      { place: { label: `${lat.toFixed(5)}, ${lng.toFixed(5)}`, lat, lng } },
      { status: 200 },
    );
  }
}

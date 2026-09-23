import { NextResponse } from "next/server";
import { drivingRoute } from "@/lib/geo";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const fromLat = Number(url.searchParams.get("fromLat"));
  const fromLng = Number(url.searchParams.get("fromLng"));
  const toLat = Number(url.searchParams.get("toLat"));
  const toLng = Number(url.searchParams.get("toLng"));
  if (![fromLat, fromLng, toLat, toLng].every(Number.isFinite)) {
    return NextResponse.json({ error: "Coordonnées invalides" }, { status: 400 });
  }
  const route = await drivingRoute({ lat: fromLat, lng: fromLng }, { lat: toLat, lng: toLng });
  if (!route) {
    return NextResponse.json({
      path: [
        [fromLat, fromLng],
        [toLat, toLng],
      ],
      distanceMeters: null,
      durationSeconds: null,
    });
  }
  return NextResponse.json(route);
}

import { NextResponse } from "next/server";
import { drivingItinerary, parseRoutePoints } from "@/lib/geo";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const via = parseRoutePoints(url.searchParams.get("points"));
  const fromLat = Number(url.searchParams.get("fromLat"));
  const fromLng = Number(url.searchParams.get("fromLng"));
  const toLat = Number(url.searchParams.get("toLat"));
  const toLng = Number(url.searchParams.get("toLng"));
  const points =
    via.length >= 2
      ? via
      : [fromLat, fromLng, toLat, toLng].every(Number.isFinite)
        ? [
            { lat: fromLat, lng: fromLng },
            { lat: toLat, lng: toLng },
          ]
        : [];
  if (points.length < 2) {
    return NextResponse.json({ error: "Coordonnées invalides" }, { status: 400 });
  }
  const route = await drivingItinerary(points);
  if (!route) {
    return NextResponse.json({
      path: points.map((point) => [point.lat, point.lng] as [number, number]),
      distanceMeters: null,
      durationSeconds: null,
    });
  }
  return NextResponse.json(route);
}

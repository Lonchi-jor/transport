export type PlaceHit = {
  label: string;
  lat: number;
  lng: number;
};

function googleKey() {
  return process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
}

function formatPhotonLabel(props: Record<string, unknown>) {
  const parts = [props.name, props.street, props.city, props.state, props.country]
    .map((part) => (typeof part === "string" ? part : ""))
    .filter(Boolean);
  return [...new Set(parts)].join(", ");
}

export async function suggestPlaces(query: string): Promise<PlaceHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const key = googleKey();
  if (key) {
    const url = new URL("https://maps.googleapis.com/maps/api/place/autocomplete/json");
    url.searchParams.set("input", q);
    url.searchParams.set("language", "fr");
    url.searchParams.set("components", "country:cm");
    url.searchParams.set("location", "4.051056,9.767869");
    url.searchParams.set("radius", "400000");
    url.searchParams.set("key", key);
    const res = await fetch(url, { cache: "no-store" });
    const data = (await res.json()) as {
      predictions?: { description: string; place_id: string }[];
    };
    const predictions = data.predictions ?? [];
    const detailed = await Promise.all(
      predictions.slice(0, 6).map(async (prediction) => {
        const detailsUrl = new URL("https://maps.googleapis.com/maps/api/place/details/json");
        detailsUrl.searchParams.set("place_id", prediction.place_id);
        detailsUrl.searchParams.set("fields", "geometry,formatted_address");
        detailsUrl.searchParams.set("key", key);
        const detailsRes = await fetch(detailsUrl, { cache: "no-store" });
        const details = (await detailsRes.json()) as {
          result?: { formatted_address?: string; geometry?: { location?: { lat: number; lng: number } } };
        };
        const loc = details.result?.geometry?.location;
        if (!loc) return null;
        return {
          label: details.result?.formatted_address || prediction.description,
          lat: loc.lat,
          lng: loc.lng,
        };
      }),
    );
    return detailed.filter((hit): hit is PlaceHit => Boolean(hit));
  }

  const url = new URL("https://photon.komoot.io/api/");
  url.searchParams.set("q", q);
  url.searchParams.set("limit", "6");
  url.searchParams.set("lang", "fr");
  url.searchParams.set("lat", "4.051056");
  url.searchParams.set("lon", "9.767869");
  const res = await fetch(url, {
    cache: "no-store",
    headers: { "User-Agent": "CCMM-Flotte/1.0" },
  });
  const data = (await res.json()) as {
    features?: {
      geometry?: { coordinates?: number[] };
      properties?: Record<string, unknown>;
    }[];
  };
  return (data.features ?? [])
    .map((feature) => {
      const coords = feature.geometry?.coordinates;
      if (!coords || coords.length < 2) return null;
      return {
        label: formatPhotonLabel(feature.properties ?? {}) || q,
        lat: coords[1],
        lng: coords[0],
      };
    })
    .filter((hit): hit is PlaceHit => Boolean(hit));
}

export async function reversePlace(lat: number, lng: number): Promise<PlaceHit | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const key = googleKey();
  if (key) {
    try {
      const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
      url.searchParams.set("latlng", `${lat},${lng}`);
      url.searchParams.set("language", "fr");
      url.searchParams.set("key", key);
      const res = await fetch(url, { cache: "no-store" });
      const data = (await res.json()) as {
        results?: { formatted_address?: string; geometry?: { location?: { lat: number; lng: number } } }[];
      };
      const first = data.results?.[0];
      const loc = first?.geometry?.location;
      if (first?.formatted_address) {
        return {
          label: first.formatted_address,
          lat: loc?.lat ?? lat,
          lng: loc?.lng ?? lng,
        };
      }
    } catch {
      /* Photon fallback */
    }
  }

  const url = new URL("https://photon.komoot.io/reverse");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lng));
  url.searchParams.set("lang", "fr");
  const res = await fetch(url, {
    cache: "no-store",
    headers: { "User-Agent": "CCMM-Flotte/1.0" },
  });
  if (!res.ok) return { label: `${lat.toFixed(5)}, ${lng.toFixed(5)}`, lat, lng };
  const data = (await res.json()) as {
    features?: {
      geometry?: { coordinates?: number[] };
      properties?: Record<string, unknown>;
    }[];
    geometry?: { coordinates?: number[] };
    properties?: Record<string, unknown>;
  };
  const feature = data.features?.[0] ?? (data.properties ? data : null);
  const coords = feature?.geometry?.coordinates;
  const label = formatPhotonLabel(feature?.properties ?? {}) || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  return {
    label,
    lat: coords && coords.length >= 2 ? coords[1] : lat,
    lng: coords && coords.length >= 2 ? coords[0] : lng,
  };
}

export async function resolvePlace(
  address: string,
  lat?: number | null,
  lng?: number | null,
): Promise<PlaceHit> {
  if (lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng)) {
    return { label: address, lat, lng };
  }
  const hits = await suggestPlaces(address);
  if (hits[0]) return { label: hits[0].label, lat: hits[0].lat, lng: hits[0].lng };
  return { label: address, lat: Number.NaN, lng: Number.NaN };
}

export async function drivingRoute(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
): Promise<{ path: [number, number][]; distanceMeters: number; durationSeconds: number } | null> {
  const url = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    routes?: {
      distance?: number;
      duration?: number;
      geometry?: { coordinates?: number[][] };
    }[];
  };
  const route = data.routes?.[0];
  const coords = route?.geometry?.coordinates;
  if (!route || !coords?.length) return null;
  return {
    path: coords.map((pair) => [pair[1], pair[0]] as [number, number]),
    distanceMeters: route.distance ?? 0,
    durationSeconds: route.duration ?? 0,
  };
}

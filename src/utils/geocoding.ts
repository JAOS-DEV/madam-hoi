const NOMINATIM_HEADERS: HeadersInit = {
  Accept: "application/json",
  "User-Agent": "MadamHoi-Ordering/1.0",
};

export interface GeocodeCoordinates {
  lat: number;
  lng: number;
  displayName?: string;
}

const MIN_FORWARD_QUERY_LENGTH = 8;

export async function forwardGeocodeAddress(
  query: string,
  signal?: AbortSignal,
): Promise<GeocodeCoordinates | null> {
  const trimmed = query.trim();
  if (trimmed.length < MIN_FORWARD_QUERY_LENGTH) {
    return null;
  }

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("q", trimmed);
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "th");

  const response = await fetch(url.toString(), {
    headers: NOMINATIM_HEADERS,
    signal,
  });
  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as Array<{
    lat?: string;
    lon?: string;
    display_name?: string;
  }>;
  const first = data[0];
  if (!first?.lat || !first.lon) {
    return null;
  }

  const lat = Number(first.lat);
  const lng = Number(first.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  return {
    lat,
    lng,
    displayName:
      typeof first.display_name === "string" && first.display_name.trim()
        ? first.display_name.trim()
        : undefined,
  };
}

export async function reverseGeocodeAddress(
  lat: number,
  lng: number,
  signal?: AbortSignal,
): Promise<string | null> {
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lng));
  url.searchParams.set("zoom", "18");
  url.searchParams.set("addressdetails", "1");

  const response = await fetch(url.toString(), {
    headers: NOMINATIM_HEADERS,
    signal,
  });
  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as { display_name?: unknown };
  return typeof data.display_name === "string" && data.display_name.trim()
    ? data.display_name.trim()
    : null;
}

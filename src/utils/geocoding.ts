export async function reverseGeocodeAddress(lat: number, lng: number): Promise<string | null> {
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lng));
  url.searchParams.set("zoom", "18");
  url.searchParams.set("addressdetails", "1");

  const response = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
    },
  });
  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as { display_name?: unknown };
  return typeof data.display_name === "string" && data.display_name.trim()
    ? data.display_name.trim()
    : null;
}

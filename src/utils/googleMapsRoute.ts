export interface GoogleMapsRouteParams {
  origin?: string;
  destination: string;
  waypoints?: string[];
  /** Request turn-by-turn navigation when Maps supports it (best on mobile at/near origin). */
  navigate?: boolean;
}

export function buildGoogleMapsDirectionsUrl({
  origin,
  destination,
  waypoints = [],
  navigate = true,
}: GoogleMapsRouteParams): string {
  const params = new URLSearchParams({
    api: "1",
    travelmode: "driving",
    destination,
  });

  const trimmedOrigin = origin?.trim();
  if (trimmedOrigin) {
    params.set("origin", trimmedOrigin);
  }

  const waypointValues = waypoints.map((value) => value.trim()).filter(Boolean);
  if (waypointValues.length > 0) {
    params.set("waypoints", waypointValues.join("|"));
  }

  if (navigate) {
    params.set("dir_action", "navigate");
  }

  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export function openGoogleMapsDirectionsUrl(url: string): void {
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (isMobile) {
    window.location.assign(url);
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

export interface LatLng { lat: number; lng: number }

/** Fallback when we know nothing about the user: central Bengaluru. */
export const DEFAULT_CENTER: LatLng = { lat: 12.9716, lng: 77.5946 };

export function haversineMeters(a: LatLng, b: LatLng) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function googleMapsDirectionsUrl(p: LatLng) {
  return `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`;
}
export const LOCATION_PREF_KEY = "ng:location";

"use client";

import { useEffect, useState } from "react";
import { formatDistance } from "@/lib/format";
import { haversineMeters, LOCATION_PREF_KEY, type LatLng } from "@/lib/geo";

/** Distance computed on-device from live location (if allowed) or saved neighbourhood. */
export function DistanceFromYou({ lat, lng, home }: { lat: number; lng: number; home: LatLng | null }) {
  const [live, setLive] = useState<LatLng | null>(null);

  useEffect(() => {
    let pref: string | null = null;
    try { pref = localStorage.getItem(LOCATION_PREF_KEY); } catch { /* ignore */ }
    if (pref !== "granted" || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (p) => setLive({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => {},
      { maximumAge: 120000, timeout: 8000 },
    );
  }, []);

  const from = live ?? home;
  if (!from) return <span className="text-subtle">—</span>;
  return <>{formatDistance(haversineMeters(from, { lat, lng })).replace(" away", "")}</>;
}

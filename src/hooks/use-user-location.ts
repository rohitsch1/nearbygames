"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LOCATION_PREF_KEY } from "@/lib/geo";
import type { LatLng } from "@/lib/geo";

type Status = "idle" | "locating" | "live" | "denied" | "unavailable";

/**
 * The user's live position, kept only in memory on this device.
 * It's used to centre the map and compute distances; it is never sent to other users
 * and never stored in the database.
 */
export function useUserLocation(onFirstFix?: (p: LatLng) => void) {
  const [position, setPosition] = useState<LatLng | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const onFirstFixRef = useRef(onFirstFix);
  const hadFix = useRef(false);
  useEffect(() => { onFirstFixRef.current = onFirstFix; });

  const locate = useCallback((): Promise<LatLng | null> => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus("unavailable");
      return Promise.resolve(null);
    }
    setStatus("locating");
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setPosition(p);
          setStatus("live");
          if (!hadFix.current) {
            hadFix.current = true;
            onFirstFixRef.current?.(p);
          }
          try { localStorage.setItem(LOCATION_PREF_KEY, "granted"); } catch { /* ignore */ }
          resolve(p);
        },
        () => {
          setStatus("denied");
          try { localStorage.setItem(LOCATION_PREF_KEY, "denied"); } catch { /* ignore */ }
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
      );
    });
  }, []);

  // Auto-locate only if the user already said yes (in the tour or earlier).
  useEffect(() => {
    let pref: string | null = null;
    try { pref = localStorage.getItem(LOCATION_PREF_KEY); } catch { /* ignore */ }
    if (pref !== "granted") return;
    const id = window.setTimeout(() => { void locate(); }, 0);
    return () => window.clearTimeout(id);
  }, [locate]);

  return { position, status, locate };
}

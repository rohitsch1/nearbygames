"use client";

import { APIProvider, useMapsLibrary } from "@vis.gl/react-google-maps";
import { Component, useCallback, useSyncExternalStore, type ErrorInfo, type ReactNode } from "react";
import { env } from "@/lib/env";

export const hasMapsKey = Boolean(env.googleMapsKey);

// Google can still reject a key at runtime (referrer not allowed, billing off, Map ID from another
// project). When that happens we switch every map to the built-in preview for the rest of the visit.
let mapsFailed = false;
const listeners = new Set<() => void>();

function markMapsUnavailable() {
  if (mapsFailed) return;
  mapsFailed = true;
  listeners.forEach((l) => l());
}

declare global {
  interface Window { gm_authFailure?: () => void }
}
if (typeof window !== "undefined" && hasMapsKey) {
  // Google calls this global when the key is rejected.
  const previous = window.gm_authFailure;
  window.gm_authFailure = () => {
    console.warn("[maps] Google rejected the API key — showing the preview map instead. Check the key's allowed websites and the Map ID.");
    markMapsUnavailable();
    previous?.();
  };
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => { listeners.delete(l); };
};

/** True while Google Maps can be used: a key is set and Google hasn't rejected it. */
export function useMapsAvailable() {
  return useSyncExternalStore(subscribe, () => hasMapsKey && !mapsFailed, () => hasMapsKey);
}

/** Catches crashes inside a Google map (e.g. markers on a map whose key was rejected) and shows `fallback`. */
export class MapBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.warn("[maps] map crashed — showing the preview map instead.", error, info.componentStack);
    markMapsUnavailable();
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export function MapsProvider({ children }: { children: ReactNode }) {
  if (!hasMapsKey) return <>{children}</>;
  return (
    <APIProvider apiKey={env.googleMapsKey} language="en" region="IN">
      {children}
    </APIProvider>
  );
}

export interface ReverseGeocodeResult {
  area: string | null;
  city: string | null;
}

/**
 * Returns a function that turns coordinates into a neighbourhood + city name.
 * Resolves to nulls when Maps isn't configured (the user can type instead).
 * Safe to call without a provider (returns nulls).
 */
export function useReverseGeocode() {
  const geocoding = useMapsLibrary("geocoding");
  return useCallback(
    async (lat: number, lng: number): Promise<ReverseGeocodeResult> => {
      if (!geocoding) return { area: null, city: null };
      try {
        const res = await new geocoding.Geocoder().geocode({ location: { lat, lng } });
        const comps = res.results.flatMap((r) => r.address_components);
        const pick = (...types: string[]) => comps.find((c) => types.some((t) => c.types.includes(t)))?.long_name ?? null;
        return {
          area: pick("sublocality_level_1", "sublocality", "neighborhood", "locality"),
          city: pick("locality", "administrative_area_level_2"),
        };
      } catch {
        return { area: null, city: null };
      }
    },
    [geocoding],
  );
}

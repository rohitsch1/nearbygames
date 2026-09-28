"use client";

import { APIProvider, useMapsLibrary } from "@vis.gl/react-google-maps";
import { useCallback, type ReactNode } from "react";
import { env } from "@/lib/env";

export const hasMapsKey = Boolean(env.googleMapsKey);

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

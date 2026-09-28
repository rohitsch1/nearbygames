"use client";

import { AdvancedMarker, Map as GoogleMap } from "@vis.gl/react-google-maps";
import { hasMapsKey, MapsProvider } from "@/components/map/maps-provider";
import { env } from "@/lib/env";
import { SPORT_BY_ID } from "@/lib/sports";
import type { Sport } from "@/lib/types";

export function GameLocationMap({ lat, lng, sport }: { lat: number; lng: number; sport: Sport }) {
  if (!hasMapsKey) {
    return (
      <div className="flex h-48 items-center justify-center rounded-2xl border border-line bg-surface-2 text-sm text-muted">
        {lat.toFixed(4)}, {lng.toFixed(4)}
      </div>
    );
  }
  return (
    <MapsProvider>
      <div className="h-56 overflow-hidden rounded-2xl border border-line md:h-72">
        <GoogleMap defaultCenter={{ lat, lng }} defaultZoom={15} mapId={env.googleMapsMapId} disableDefaultUI
          gestureHandling="cooperative" clickableIcons={false} className="size-full">
          <AdvancedMarker position={{ lat, lng }} title={SPORT_BY_ID[sport].label}>
            <div className="flex size-11 items-center justify-center rounded-full border-[3px] border-[#12b76a] bg-white text-xl shadow-float">
              {SPORT_BY_ID[sport].emoji}
            </div>
          </AdvancedMarker>
        </GoogleMap>
      </div>
    </MapsProvider>
  );
}

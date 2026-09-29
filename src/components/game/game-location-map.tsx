"use client";

import { AdvancedMarker, Map as GoogleMap } from "@vis.gl/react-google-maps";
import { hasMapsKey, MapsProvider } from "@/components/map/maps-provider";
import { SchematicStreets } from "@/components/map/schematic-map";
import { env } from "@/lib/env";
import { SPORT_BY_ID } from "@/lib/sports";
import type { Sport } from "@/lib/types";

export function GameLocationMap({ lat, lng, sport }: { lat: number; lng: number; sport: Sport }) {
  if (!hasMapsKey) {
    return (
      <div className="relative h-48 overflow-hidden rounded-2xl border border-line bg-[#e9efe8] dark:bg-[#17221c] md:h-60">
        <SchematicStreets />
        <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-full flex-col items-center">
          <span className="flex size-11 items-center justify-center rounded-full border-[3px] border-[#12b76a] bg-white text-xl shadow-float">
            {SPORT_BY_ID[sport].emoji}
          </span>
          <span className="-mt-1 size-2.5 rotate-45 border-b-[3px] border-r-[3px] border-[#12b76a] bg-white" />
        </div>
        <p className="absolute bottom-2 left-2 rounded-full bg-surface/85 px-2.5 py-1 text-[11px] font-semibold text-muted">
          {lat.toFixed(4)}, {lng.toFixed(4)} · tap Directions for the route
        </p>
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

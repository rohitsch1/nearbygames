"use client";

import { Map as GoogleMap, useMap } from "@vis.gl/react-google-maps";
import { LocateFixed, MapPin } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { env } from "@/lib/env";
import type { LatLng } from "@/lib/geo";
import { MapBoundary, useMapsAvailable } from "./maps-provider";

interface Props {
  value: LatLng | null;
  initialCenter: LatLng;
  onChange: (p: LatLng) => void;
}

/** Drag the map under a fixed centre pin, or snap to current location. Must be inside <MapsProvider>. */
export function LocationPicker({ value, initialCenter, onChange }: Props) {
  const [locating, setLocating] = useState(false);
  const [flyTo, setFlyTo] = useState<LatLng | null>(null);
  const mapsOn = useMapsAvailable();

  function useCurrent() {
    if (!navigator.geolocation) return toast.error("Location isn't available on this device");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setLocating(false);
        setFlyTo(p);
        onChange(p);
      },
      () => { setLocating(false); toast.error("Couldn't get your location — drag the map instead."); },
      { enableHighAccuracy: true, timeout: 12000 },
    );
  }

  const preview = (
    <div className="flex h-24 items-center justify-center rounded-2xl border border-dashed border-line bg-surface-2 text-sm text-muted">
      {value ? `📍 ${value.lat.toFixed(5)}, ${value.lng.toFixed(5)}` : "Use your current location to place the game"}
    </div>
  );

  return (
    <div className="space-y-2">
      {mapsOn ? (
        <MapBoundary fallback={preview}>
          <div className="relative h-64 overflow-hidden rounded-2xl border border-line md:h-80">
            <GoogleMap
              defaultCenter={value ?? initialCenter}
              defaultZoom={16}
              mapId={env.googleMapsMapId}
              gestureHandling="greedy"
              disableDefaultUI
              zoomControl
              clickableIcons={false}
              className="size-full"
              onIdle={(e) => {
                const c = e.map.getCenter();
                if (c) onChange({ lat: c.lat(), lng: c.lng() });
              }}
            >
              <Fly target={flyTo} />
            </GoogleMap>
            {/* Fixed centre pin */}
            <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full">
              <MapPin className="size-10 fill-brand text-white drop-shadow-lg" strokeWidth={1.5} />
            </div>
            <p className="pointer-events-none absolute inset-x-0 top-3 mx-auto w-fit rounded-full bg-surface/90 px-3 py-1 text-xs font-semibold shadow-card">
              Drag the map to put the pin on the gate
            </p>
          </div>
        </MapBoundary>
      ) : preview}
      <Button type="button" variant="outline" size="sm" onClick={useCurrent} disabled={locating}
        icon={locating ? <Spinner /> : <LocateFixed className="size-4" />}>
        Use my current location
      </Button>
    </div>
  );
}

function Fly({ target }: { target: LatLng | null }) {
  const map = useMap();
  useEffect(() => {
    if (map && target) { map.panTo(target); map.setZoom(17); }
  }, [map, target]);
  return null;
}

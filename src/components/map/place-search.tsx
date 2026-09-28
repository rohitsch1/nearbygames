"use client";

import { useMapsLibrary } from "@vis.gl/react-google-maps";
import { MapPin, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { LatLng } from "@/lib/geo";

interface Props {
  label: string;
  onPick: (p: LatLng, name: string) => void;
}

interface Suggestion { id: string; main: string; secondary: string; prediction: google.maps.places.PlacePrediction }

/** The search-style pill at the top of the map. Shows roughly where you are; tap to jump elsewhere. */
export function PlaceSearch({ label, onPick }: Props) {
  const places = useMapsLibrary("places");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Suggestion[]>([]);
  const token = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!places || !open || query.trim().length < 2) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      token.current ??= new places.AutocompleteSessionToken();
      try {
        const { suggestions } = await places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: query,
          sessionToken: token.current,
          includedRegionCodes: ["in"],
        });
        if (cancelled) return;
        setResults(
          suggestions.flatMap((s) => (s.placePrediction ? [{
            id: s.placePrediction.placeId,
            main: s.placePrediction.mainText?.text ?? s.placePrediction.text.text,
            secondary: s.placePrediction.secondaryText?.text ?? "",
            prediction: s.placePrediction,
          }] : [])),
        );
      } catch {
        if (!cancelled) setResults([]);
      }
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [query, places, open]);

  async function pick(s: Suggestion) {
    const place = s.prediction.toPlace();
    await place.fetchFields({ fields: ["location"] });
    token.current = null;
    setOpen(false);
    setQuery("");
    setResults([]);
    if (place.location) onPick({ lat: place.location.lat(), lng: place.location.lng() }, s.main);
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)}
        className="flex h-12 min-w-0 flex-1 items-center gap-2 rounded-2xl bg-surface px-4 text-left shadow-float">
        <MapPin className="size-4 shrink-0 text-brand" />
        <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{label}</span>
        <Search className="size-4 shrink-0 text-subtle" />
      </button>
    );
  }

  return (
    <div className="relative min-w-0 flex-1">
      <div className="flex h-12 items-center gap-2 rounded-2xl bg-surface px-4 shadow-float ring-2 ring-brand">
        <Search className="size-4 shrink-0 text-subtle" />
        <input ref={inputRef} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search an area, ground or café"
          aria-label="Search places" className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-subtle"
          onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }} />
        <button type="button" aria-label="Close search" onClick={() => { setOpen(false); setQuery(""); setResults([]); }}>
          <X className="size-4 text-subtle" />
        </button>
      </div>
      {results.length > 0 && (
        <ul className="absolute inset-x-0 top-14 z-10 overflow-hidden rounded-2xl border border-line bg-surface shadow-float">
          {results.map((r) => (
            <li key={r.id}>
              <button type="button" onClick={() => pick(r)} className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-surface-2">
                <MapPin className="mt-0.5 size-4 shrink-0 text-subtle" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{r.main}</span>
                  <span className="block truncate text-xs text-muted">{r.secondary}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

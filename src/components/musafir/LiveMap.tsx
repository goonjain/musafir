import React, { useEffect, useState, Suspense } from "react";
import {
  PLACES,
  byId,
  level,
  levelClass,
  type Place,
} from "@/lib/jaipur-data";
import { predictCrowd, type VerifiedObservation } from "@/lib/crowd-service";
import type { Report } from "@/components/musafir/Sections";
import type { SearchResult } from "./LeafletMapInner";

// Dynamically import LeafletMapInner on client only to prevent SSR 'window is not defined'
const LeafletMapInner = React.lazy(() => import("./LeafletMapInner"));

interface LiveMapProps {
  pulseAdj?: Record<string, number>;
  reports?: Report[];
  observations?: VerifiedObservation[];
  adminOverrides?: Record<string, number>;
  onOptimize: (id: string) => void;
  selectedPlaceId?: string | null;
  focusKey?: number;
}

export function LiveMap({
  pulseAdj = {},
  reports = [],
  observations = [],
  adminOverrides = {},
  onOptimize,
}: LiveMapProps) {
  // Client-side mounted state for SSR safety
  const [mounted, setMounted] = useState(false);
  const [hour, setHour] = useState(16);
  const [sel, setSel] = useState<Place | null>(byId("amber"));

  // Geolocation state
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [selectedSearchResult, setSelectedSearchResult] = useState<SearchResult | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Map focus controller
  const [flyTarget, setFlyTarget] = useState<[number, number] | null>(null);
  const [flyZoom, setFlyZoom] = useState<number>(13);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (selectedPlaceId) {
      try {
        const p = byId(selectedPlaceId);
        if (p) {
          setSel(p);
          setFlyTarget([p.lat, p.lng]);
          setFlyZoom(15);
        }
      } catch {
        // ignore missing place lookup
      }
    }
  }, [selectedPlaceId, focusKey]);

  // Handle "Use my location"
  const handleUseMyLocation = () => {
    setLocationError(null);
    if (typeof window === "undefined" || !navigator.geolocation) {
      setLocationError("Geolocation is not supported by your browser.");
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        const coords: [number, number] = [
          position.coords.latitude,
          position.coords.longitude,
        ];
        setUserLocation(coords);
        setFlyTarget(coords);
        setFlyZoom(15);
      },
      (error) => {
        setLocating(false);
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setLocationError("Location permission denied. Please allow location access in your browser.");
            break;
          case error.POSITION_UNAVAILABLE:
            setLocationError("Location information is currently unavailable.");
            break;
          case error.TIMEOUT:
            setLocationError("Location request timed out. Please try again.");
            break;
          default:
            setLocationError("Could not retrieve your location.");
            break;
        }
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  // Handle explicit Nominatim search
  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) {
      setSearchError("Please enter a destination to search.");
      return;
    }

    setIsSearching(true);
    setSearchError(null);
    setSearchResults([]);

    try {
      // First check if query matches one of our 16 curated places directly
      const localMatch = PLACES.find(
        (p) =>
          p.name.toLowerCase().includes(q.toLowerCase()) ||
          p.hindi.includes(q)
      );

      // Query Nominatim explicitly
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          q + " Jaipur"
        )}&limit=5`,
        {
          headers: {
            Accept: "application/json",
          },
        }
      );

      if (!res.ok) {
        throw new Error("Search service returned an error.");
      }

      let data: SearchResult[] = await res.json();

      // If no Jaipur results found, retry without Jaipur suffix
      if (!data || data.length === 0) {
        const fallbackRes = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
            q
          )}&limit=5`,
          {
            headers: { Accept: "application/json" },
          }
        );
        if (fallbackRes.ok) {
          data = await fallbackRes.json();
        }
      }

      if (!data || data.length === 0) {
        if (localMatch) {
          setSel(localMatch);
          setFlyTarget([localMatch.lat, localMatch.lng]);
          setFlyZoom(15);
          setIsSearching(false);
          return;
        }
        setSearchError(`No results found for "${q}". Try "Hawa Mahal" or "Amber Fort".`);
        setIsSearching(false);
        return;
      }

      if (data.length === 1 || localMatch) {
        const target = localMatch
          ? {
              place_id: 999999,
              display_name: localMatch.name + ", Jaipur, Rajasthan",
              lat: localMatch.lat.toString(),
              lon: localMatch.lng.toString(),
            }
          : data[0];

        if (target) {
          setSelectedSearchResult(target);
          const lat = parseFloat(target.lat);
          const lon = parseFloat(target.lon);
          setFlyTarget([lat, lon]);
          setFlyZoom(15);
          if (localMatch) {
            setSel(localMatch);
          }
        }
      } else {
        setSearchResults(data);
      }
    } catch (err) {
      const localMatch = PLACES.find((p) =>
        p.name.toLowerCase().includes(q.toLowerCase())
      );
      if (localMatch) {
        setSel(localMatch);
        setFlyTarget([localMatch.lat, localMatch.lng]);
        setFlyZoom(15);
      } else {
        setSearchError("Search service unavailable. Please check your connection.");
      }
    } finally {
      setIsSearching(false);
    }
  };

  const selectSearchResult = (item: SearchResult) => {
    setSelectedSearchResult(item);
    setSearchResults([]);
    const lat = parseFloat(item.lat);
    const lon = parseFloat(item.lon);
    setFlyTarget([lat, lon]);
    setFlyZoom(15);

    const match = PLACES.find(
      (p) =>
        Math.abs(p.lat - lat) < 0.008 && Math.abs(p.lng - lon) < 0.008
    );
    if (match) {
      setSel(match);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Search & Controls Bar */}
      <div className="rounded-2xl border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          {/* Nominatim Search Form */}
          <form
            onSubmit={handleSearchSubmit}
            className="relative flex flex-1 items-center gap-2"
          >
            <div className="relative flex-1">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                🔍
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search a place or destination... (e.g. Hawa Mahal, Delhi)"
                className="w-full rounded-xl border border-input bg-background py-2 pl-9 pr-8 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    setSearchResults([]);
                    setSelectedSearchResult(null);
                    setSearchError(null);
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
                >
                  ✕
                </button>
              )}
            </div>
            <button
              type="submit"
              disabled={isSearching}
              className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow transition hover:bg-saffron disabled:opacity-50"
            >
              {isSearching ? "Searching..." : "Search"}
            </button>
          </form>

          {/* Use My Location Button */}
          <button
            type="button"
            onClick={handleUseMyLocation}
            disabled={locating}
            className="flex items-center justify-center gap-2 rounded-xl border border-primary/30 bg-secondary/80 px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-primary hover:text-primary-foreground disabled:opacity-50"
          >
            <span className="text-primary font-bold">◎</span>
            {locating ? "Locating you..." : "Use my location"}
          </button>
        </div>

        {/* Search Results Dropdown (if multiple) */}
        {searchResults.length > 0 && (
          <div className="mt-3 rounded-xl border bg-card p-2 shadow-lg animate-in fade-in">
            <p className="px-2 py-1 text-xs font-semibold text-muted-foreground">
              Select destination ({searchResults.length} found):
            </p>
            <div className="divide-y divide-border">
              {searchResults.map((item) => (
                <button
                  key={item.place_id}
                  onClick={() => selectSearchResult(item)}
                  className="w-full px-2 py-2 text-left text-xs hover:bg-secondary/60 rounded-md transition flex items-center justify-between"
                >
                  <span className="truncate pr-2 font-medium">
                    {item.display_name}
                  </span>
                  <span className="shrink-0 text-primary font-semibold text-[11px]">
                    Go →
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* User alerts */}
        {searchError && (
          <p className="mt-2 text-xs text-destructive font-medium animate-in fade-in">
            ⚠ {searchError}
          </p>
        )}
        {locationError && (
          <p className="mt-2 text-xs text-destructive font-medium animate-in fade-in">
            ⚠ {locationError}
          </p>
        )}
        {userLocation && (
          <p className="mt-2 text-xs text-emerald-600 font-medium">
            ✓ Located at {userLocation[0].toFixed(4)}°N, {userLocation[1].toFixed(4)}°E
          </p>
        )}
      </div>

      {/* Main Map + Place Detail Card Grid */}
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        {/* Map Container */}
        <div className="relative min-h-[460px] overflow-hidden rounded-2xl border-4 border-double border-gold bg-secondary musafir-map-container shadow-md">
          {!mounted ? (
            <div className="flex h-full min-h-[460px] w-full items-center justify-center bg-secondary">
              <div className="text-center">
                <p className="font-display text-lg text-primary animate-pulse">
                  Loading Jaipur Map...
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Connecting to OpenStreetMap
                </p>
              </div>
            </div>
          ) : (
            <div className="relative h-full min-h-[460px] w-full">
              <Suspense
                fallback={
                  <div className="flex h-full min-h-[460px] w-full items-center justify-center bg-secondary">
                    <p className="font-display text-primary animate-pulse">
                      Rendering OpenStreetMap...
                    </p>
                  </div>
                }
              >
                <LeafletMapInner
                  hour={hour}
                  sel={sel}
                  setSel={setSel}
                  flyTarget={flyTarget}
                  flyZoom={flyZoom}
                  setFlyTarget={setFlyTarget}
                  setFlyZoom={setFlyZoom}
                  userLocation={userLocation}
                  selectedSearchResult={selectedSearchResult}
                  pulseAdj={pulseAdj}
                  observations={observations}
                  adminOverrides={adminOverrides}
                  onOptimize={onOptimize}
                />
              </Suspense>

              {/* Sunday Time Slider & Legend Float Card */}
              <div className="absolute bottom-3 left-3 right-3 z-[1000] rounded-xl bg-card/95 p-3 text-xs shadow-lg backdrop-blur border">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap gap-2.5">
                    {[
                      ["bg-crowd-low", "Low"],
                      ["bg-crowd-moderate", "Moderate"],
                      ["bg-crowd-high", "High"],
                      ["bg-crowd-critical", "Critical"],
                      ["bg-gem", "Hidden gem"],
                    ].map(([c, l]) => (
                      <span key={l} className="flex items-center gap-1 font-medium">
                        <i className={`h-2.5 w-2.5 rounded-full ${c}`} />
                        {l}
                      </span>
                    ))}
                  </div>

                  <span className="text-[11px] font-semibold text-muted-foreground">
                    Raahi Live Map
                  </span>
                </div>

                <label className="mt-2.5 flex items-center gap-3 font-semibold text-foreground">
                  <span className="shrink-0 w-24">
                    Sunday {hour > 12 ? hour - 12 : hour}
                    {hour < 12 ? " AM" : " PM"}
                  </span>
                  <input
                    type="range"
                    min={7}
                    max={20}
                    value={hour}
                    onChange={(e) => setHour(+e.target.value)}
                    className="flex-1 accent-[var(--primary)] cursor-pointer"
                  />
                  <span className="text-xs text-muted-foreground">
                    {hour}:00 hrs
                  </span>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Selected Place Raahi Intelligence Card */}
        {sel &&
          (() => {
            const pred = predictCrowd(sel.id, {
              day: "Sun",
              hour,
              observations,
              adminOverrideDelta: adminOverrides[sel.id] ?? (pulseAdj[sel.id] ?? 0),
            });
            const s = pred.score;
            const lvl = pred.category;
            const last = reports.find((r) => r.place === sel.id || (r as any).destinationId === sel.id);

            return (
              <div
                key={sel.id}
                className="flex flex-col justify-between rounded-2xl border bg-card p-6 shadow animate-in fade-in slide-in-from-right-4"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <p className="font-display text-saffron">{sel.hindi}</p>
                    <button
                      onClick={() => {
                        setFlyTarget([sel.lat, sel.lng]);
                        setFlyZoom(15);
                      }}
                      className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold text-primary hover:bg-primary hover:text-primary-foreground transition"
                      title="Focus on map"
                    >
                      Focus 📍
                    </button>
                  </div>

                  <h3 className="text-3xl font-bold mt-1">{sel.name}</h3>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-3 py-1 text-sm font-bold shadow-sm ${levelClass[lvl]}`}
                    >
                      {lvl} Crowd · {s}/100
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold border ${
                        pred.predictionType === "observed"
                          ? "bg-emerald-500/15 text-emerald-800 border-emerald-500/30"
                          : "bg-amber-500/15 text-amber-800 border-amber-500/30"
                      }`}
                    >
                      {pred.predictionType === "observed" ? "● Verified Observation" : "○ Baseline v1.0"}
                    </span>
                    {sel.gem && (
                      <span className="rounded-full bg-gem px-3 py-1 text-xs font-bold text-primary-foreground">
                        💎 Hidden Gem
                      </span>
                    )}
                  </div>

                  {pred.evidence.dataFreshnessMinutes && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Freshness: {pred.evidence.dataFreshnessMinutes}m ago
                    </p>
                  )}

                  <div className="mt-5 space-y-2 border-t pt-4 text-sm">
                    <p>
                      🕘 Best time to visit: <b>{sel.best}</b>
                    </p>
                    <p>
                      ⚠ Peak rush hour: <b className="text-destructive">{sel.peak}</b>
                    </p>
                    <p className="text-muted-foreground">
                      🏷 Tags: {sel.tags.join(", ")}
                    </p>
                  </div>

                  {sel.alternatives && sel.alternatives.length > 0 && (
                    <div className="mt-4 rounded-xl border border-saffron/30 bg-amber-500/5 p-3.5">
                      <p className="text-xs font-bold uppercase tracking-wide text-saffron">
                        Raahi Smart Recommendation
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Lower-crowd alternative nearby:
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {sel.alternatives.map((a) => {
                          const altPlace = byId(a);
                          if (!altPlace) return null;
                          const altPred = predictCrowd(altPlace.id, {
                            day: "Sun",
                            hour,
                            festival: false,
                            weather: "clear",
                            activeObservations: observations,
                            adminOverrides,
                          });
                          const altScore = altPred.score;
                          return (
                            <button
                              key={a}
                              onClick={() => {
                                setSel(altPlace);
                                setFlyTarget([altPlace.lat, altPlace.lng]);
                                setFlyZoom(15);
                              }}
                              className="rounded-lg border bg-card px-3 py-1.5 text-xs font-semibold hover:border-primary transition flex items-center gap-1.5"
                            >
                              <span>{altPlace.name}</span>
                              <span
                                className={`text-[10px] px-1.5 py-0.5 rounded-full ${levelClass[altPred.level]}`}
                              >
                                {altScore}/100
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="mt-4 rounded-lg bg-secondary p-3 text-sm">
                    <p className="text-xs uppercase font-semibold text-muted-foreground">
                      Latest Community Pulse
                    </p>
                    <p className="mt-1 italic text-foreground">
                      “{last ? last.tip || last.status : sel.update}”
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => onOptimize(sel.id)}
                  className="mt-6 w-full rounded-full bg-primary py-3 font-semibold text-primary-foreground shadow-md transition hover:bg-saffron"
                >
                  Optimize my visit with {sel.name}
                </button>
              </div>
            );
          })()}
      </div>
    </div>
  );
}

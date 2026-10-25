import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import {
  PLACES,
  byId,
  level,
  levelClass,
  type Place,
} from "@/lib/jaipur-data";
import { predictCrowd, type VerifiedObservation } from "@/lib/crowd-service";

export interface SearchResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

// MapController for smooth animated pan/flyTo
function MapController({
  center,
  zoom,
}: {
  center: [number, number] | null;
  zoom?: number;
}) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.flyTo(center, zoom ?? 14, { animate: true, duration: 1.2 });
    }
  }, [center, zoom, map]);
  return null;
}

// Marker icon generator using L.divIcon
function createPlaceIcon(
  p: Place,
  score: number,
  isSelected: boolean
): L.DivIcon {
  const isGem = p.gem && score < 40;
  const lvl = level(score);

  const bgHex = isGem
    ? "#a855f7" // gem purple
    : lvl === "Low"
      ? "#16a34a" // green
      : lvl === "Moderate"
        ? "#eab308" // yellow
        : lvl === "High"
          ? "#f97316" // orange
          : "#dc2626"; // critical red

  const pulseEffect =
    score >= 60
      ? `<span style="position:absolute; inset:-4px; border-radius:9999px; background:${bgHex}; opacity:0.4; animation: ping 1.8s cubic-bezier(0, 0, 0.2, 1) infinite;"></span>`
      : "";

  const size = isSelected ? 34 : 26;
  const innerSymbol = isGem ? "★" : "";

  const html = `
    <div style="position:relative; width:${size}px; height:${size}px; display:flex; align-items:center; justify-content:center; cursor:pointer;">
      ${pulseEffect}
      <div style="
        position:relative;
        width:${size}px;
        height:${size}px;
        border-radius:9999px;
        background:${bgHex};
        border:2px solid #ffffff;
        box-shadow:0 3px 8px rgba(0,0,0,0.3);
        display:flex;
        align-items:center;
        justify-content:center;
        color:#ffffff;
        font-size:${isSelected ? "13px" : "11px"};
        font-weight:bold;
        transition:transform 0.2s;
        ${isSelected ? "transform:scale(1.15); box-shadow:0 0 0 3px rgba(217, 119, 6, 0.5);" : ""}
      ">
        ${innerSymbol}
      </div>
    </div>
  `;

  return L.divIcon({
    html,
    className: "custom-leaflet-marker",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2 - 4],
  });
}

const userLocationIcon = L.divIcon({
  html: `
    <div style="position:relative; width:28px; height:28px; display:flex; align-items:center; justify-content:center;">
      <span style="position:absolute; inset:-4px; border-radius:9999px; background:#2563eb; opacity:0.4; animation:ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></span>
      <div style="width:20px; height:20px; border-radius:9999px; background:#2563eb; border:3px solid #ffffff; box-shadow:0 2px 6px rgba(0,0,0,0.35);"></div>
    </div>
  `,
  className: "user-loc-marker",
  iconSize: [28, 28],
  iconAnchor: [14, 14],
  popupAnchor: [0, -16],
});

const searchResultIcon = L.divIcon({
  html: `
    <div style="position:relative; width:30px; height:30px; display:flex; align-items:center; justify-content:center;">
      <div style="width:24px; height:24px; border-radius:9999px; background:#7c3aed; border:3px solid #ffffff; box-shadow:0 3px 8px rgba(0,0,0,0.35); display:flex; align-items:center; justify-content:center; color:#fff; font-size:12px;">📍</div>
    </div>
  `,
  className: "search-result-marker",
  iconSize: [30, 30],
  iconAnchor: [15, 15],
  popupAnchor: [0, -18],
});

export interface LeafletMapInnerProps {
  hour: number;
  sel: Place | null;
  setSel: (p: Place) => void;
  flyTarget: [number, number] | null;
  flyZoom: number;
  setFlyTarget: (target: [number, number] | null) => void;
  setFlyZoom: (zoom: number) => void;
  userLocation: [number, number] | null;
  selectedSearchResult: SearchResult | null;
  pulseAdj?: Record<string, number>;
  observations?: VerifiedObservation[];
  adminOverrides?: Record<string, number>;
  onOptimize: (id: string) => void;
}

export default function LeafletMapInner({
  hour,
  sel,
  setSel,
  flyTarget,
  flyZoom,
  setFlyTarget,
  setFlyZoom,
  userLocation,
  selectedSearchResult,
  pulseAdj,
  observations,
  adminOverrides,
  onOptimize,
}: LeafletMapInnerProps) {
  return (
    <MapContainer
      center={[26.9124, 75.7873]}
      zoom={12}
      scrollWheelZoom={true}
      style={{ height: "100%", width: "100%", minHeight: "460px" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <MapController center={flyTarget} zoom={flyZoom} />

      {/* User GPS Location Marker */}
      {userLocation && (
        <Marker position={userLocation} icon={userLocationIcon}>
          <Popup>
            <div className="p-3 text-center">
              <p className="font-bold text-sm text-blue-600">📍 You are here</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Current GPS position
              </p>
            </div>
          </Popup>
        </Marker>
      )}

      {/* Explicit Search Result Marker */}
      {selectedSearchResult && (
        <Marker
          position={[
            parseFloat(selectedSearchResult.lat),
            parseFloat(selectedSearchResult.lon),
          ]}
          icon={searchResultIcon}
        >
          <Popup>
            <div className="p-3">
              <p className="font-bold text-xs text-purple-700">Search Result</p>
              <p className="text-xs mt-1 leading-snug">
                {selectedSearchResult.display_name}
              </p>
            </div>
          </Popup>
        </Marker>
      )}

      {/* 16 Jaipur Place Markers with Raahi Unified Crowd Intelligence */}
      {PLACES.map((p) => {
        const pred = predictCrowd(p.id, {
          day: "Sun",
          hour,
          observations,
          adminOverrideDelta: adminOverrides?.[p.id] ?? (pulseAdj?.[p.id] ?? 0),
        });
        const s = pred.score;
        const isSelected = sel?.id === p.id;
        const lvl = pred.category;

        return (
          <Marker
            key={p.id}
            position={[p.lat, p.lng]}
            icon={createPlaceIcon(p, s, isSelected)}
            eventHandlers={{
              click: () => {
                setSel(p);
                setFlyTarget([p.lat, p.lng]);
                setFlyZoom(14);
              },
            }}
          >
            <Popup>
              <div className="p-3 space-y-2 min-w-[220px]">
                <div>
                  <p className="font-display text-xs text-saffron">{p.hindi}</p>
                  <h4 className="font-bold text-base text-foreground leading-tight">
                    {p.name}
                  </h4>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${levelClass[lvl]}`}
                  >
                    {lvl} · {s}/100
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium border ${
                      pred.predictionType === "observed"
                        ? "bg-emerald-500/15 text-emerald-800 border-emerald-500/30"
                        : "bg-amber-500/15 text-amber-800 border-amber-500/30"
                    }`}
                  >
                    {pred.predictionType === "observed" ? "● Observed" : "○ Estimated"}
                  </span>
                  {p.gem && s < 40 && (
                    <span className="rounded-full bg-gem px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
                      Hidden Gem 💎
                    </span>
                  )}
                </div>

                <p className="text-xs text-muted-foreground">
                  🕘 Best window: <b>{p.best}</b>
                </p>

                {pred.evidence.dataFreshnessMinutes && (
                  <p className="text-[11px] text-muted-foreground">
                    Freshness: {pred.evidence.dataFreshnessMinutes}m ago
                  </p>
                )}

                {p.alternatives && p.alternatives.length > 0 && (
                  <p className="text-[11px] text-muted-foreground pt-1 border-t">
                    Quieter alternative:{" "}
                    <button
                      onClick={() => {
                        const altId = p.alternatives?.[0];
                        if (altId) {
                          const altPlace = byId(altId);
                          setSel(altPlace);
                          setFlyTarget([altPlace.lat, altPlace.lng]);
                          setFlyZoom(14);
                        }
                      }}
                      className="underline font-semibold text-primary"
                    >
                      {byId(p.alternatives[0]!).name}
                    </button>
                  </p>
                )}

                <button
                  onClick={() => {
                    setSel(p);
                    onOptimize(p.id);
                  }}
                  className="mt-2 w-full rounded-lg bg-primary py-1.5 text-center text-xs font-bold text-primary-foreground hover:bg-saffron"
                >
                  Optimize My Visit →
                </button>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}

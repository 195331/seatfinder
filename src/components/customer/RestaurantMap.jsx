import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import { X, Flame, Coffee, Volume2, Star, Zap } from 'lucide-react';
import { Button } from "@/components/ui/button";
import OccupancyBadge from "@/components/ui/OccupancyBadge";
import StarRating from "@/components/ui/StarRating";
import { cn } from "@/lib/utils";
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix default markers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// ─── Vibe Configuration ───────────────────────────────────────────────────────
const VIBES = [
  {
    id: 'lively',
    label: 'Lively',
    icon: '🔥',
    color: '#ef4444',
    heatColor: 'rgba(239, 68, 68, 0.18)',
    borderColor: 'rgba(239, 68, 68, 0.6)',
    markerColor: '#ef4444',
    description: 'Buzzing, high energy',
  },
  {
    id: 'cozy',
    label: 'Cozy',
    icon: '☕',
    color: '#f97316',
    heatColor: 'rgba(249, 115, 22, 0.18)',
    borderColor: 'rgba(249, 115, 22, 0.6)',
    markerColor: '#f97316',
    description: 'Warm, intimate feel',
  },
  {
    id: 'quiet',
    label: 'Quiet',
    icon: '🌿',
    color: '#10b981',
    heatColor: 'rgba(16, 185, 129, 0.18)',
    borderColor: 'rgba(16, 185, 129, 0.6)',
    markerColor: '#10b981',
    description: 'Calm, relaxed ambiance',
  },
  {
    id: 'trendy',
    label: 'Trendy',
    icon: '✨',
    color: '#8b5cf6',
    heatColor: 'rgba(139, 92, 246, 0.18)',
    borderColor: 'rgba(139, 92, 246, 0.6)',
    markerColor: '#8b5cf6',
    description: 'Hip & popular right now',
  },
];

// ─── Vibe Detection Logic ─────────────────────────────────────────────────────
const getVibe = (restaurant) => {
  const occupancy = restaurant.total_seats > 0
    ? ((restaurant.total_seats - restaurant.available_seats) / restaurant.total_seats) * 100
    : 0;
  const rating = restaurant.average_rating || 0;
  const views = restaurant.view_count || 0;
  const noiseLevel = restaurant.noise_level_avg; // optional field
  const vibeRating = restaurant.vibe_rating_avg;  // optional field

  // Lively: high occupancy, high views
  if (occupancy >= 70 || views > 200) return 'lively';

  // Trendy: high rating + lots of recent activity
  if (rating >= 4.3 && views > 100) return 'trendy';

  // Quiet: low occupancy, or explicit low noise signal
  if (occupancy <= 30 || (noiseLevel && noiseLevel <= 2)) return 'quiet';

  // Cozy: moderate occupancy, good rating
  return 'cozy';
};

// ─── Custom Markers ───────────────────────────────────────────────────────────
const createVibeIcon = (vibeId, isSelected = false) => {
  const vibe = VIBES.find(v => v.id === vibeId) || VIBES[1];
  const size = isSelected ? 38 : 30;
  return L.divIcon({
    className: 'custom-vibe-marker',
    html: `
      <div style="
        background-color: ${vibe.markerColor};
        width: ${size}px;
        height: ${size}px;
        border-radius: 50%;
        border: 3px solid white;
        box-shadow: 0 2px 10px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: ${isSelected ? 16 : 13}px;
        transition: all 0.2s;
      ">${vibe.icon}</div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -(size / 2)],
  });
};

// ─── Map Updater ──────────────────────────────────────────────────────────────
function MapUpdater({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.setView(center, 14);
  }, [center, map]);
  return null;
}

// ─── Heatmap Circles (rendered inside MapContainer) ──────────────────────────
function VibeHeatLayer({ restaurants, activeVibes }) {
  if (activeVibes.size === 0) return null;

  return restaurants
    .filter(r => r.latitude && r.longitude)
    .map(r => {
      const vibe = getVibe(r);
      if (!activeVibes.has(vibe)) return null;
      const cfg = VIBES.find(v => v.id === vibe);
      return (
        <Circle
          key={`heat-${r.id}`}
          center={[r.latitude, r.longitude]}
          radius={140}
          pathOptions={{
            color: cfg.borderColor,
            fillColor: cfg.heatColor,
            fillOpacity: 1,
            weight: 1.5,
          }}
        />
      );
    });
}

// ─── Seating color helper ─────────────────────────────────────────────────────
const getSeatingColor = (restaurant) => {
  const { total_seats, available_seats, is_full } = restaurant;
  if (is_full || available_seats === 0) return { bg: '#ef4444', border: '#b91c1c', label: 'Full' };
  const pct = total_seats > 0 ? (available_seats / total_seats) * 100 : 100;
  if (pct <= 40) return { bg: '#eab308', border: '#a16207', label: 'Moderate' };
  return { bg: '#22c55e', border: '#15803d', label: 'Chill' };
};

const createSeatingIcon = (restaurant, isSelected = false) => {
  const { bg, border } = getSeatingColor(restaurant);
  const size = isSelected ? 38 : 30;
  return L.divIcon({
    className: 'custom-seating-marker',
    html: `<div style="
      background-color:${bg};
      width:${size}px;height:${size}px;
      border-radius:50%;
      border:3px solid white;
      box-shadow:0 2px 10px rgba(0,0,0,0.3);
    "></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -(size / 2)],
  });
};

// ─── Main Component ───────────────────────────────────────────────────────────
export default function RestaurantMap({
  restaurants,
  center,
  selectedRestaurant,
  onRestaurantSelect,
  onRestaurantClick,
}) {
  const defaultCenter = center || [40.7178, -74.0431];
  // 'vibe' | 'seating'
  const [filterMode, setFilterMode] = useState('vibe');
  const [activeVibes, setActiveVibes] = useState(new Set());

  const toggleVibe = (vibeId) => {
    setActiveVibes(prev => {
      const next = new Set(prev);
      if (next.has(vibeId)) next.delete(vibeId); else next.add(vibeId);
      return next;
    });
  };

  const visibleRestaurants = (filterMode === 'vibe' && activeVibes.size > 0)
    ? restaurants.filter(r => activeVibes.has(getVibe(r)))
    : restaurants;

  return (
    <div className="relative h-full w-full rounded-2xl overflow-hidden">
      <MapContainer
        center={defaultCenter}
        zoom={14}
        className="h-full w-full"
        style={{ zIndex: 0 }}
      >
        <MapUpdater center={center} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />

        {/* Heatmap glow circles for vibe mode */}
        {filterMode === 'vibe' && activeVibes.size > 0 && (
          <VibeHeatLayer restaurants={restaurants} activeVibes={activeVibes} />
        )}

        {/* Markers */}
        {visibleRestaurants.map(restaurant =>
          restaurant.latitude && restaurant.longitude ? (
            <Marker
              key={restaurant.id}
              position={[restaurant.latitude, restaurant.longitude]}
              icon={
                filterMode === 'seating'
                  ? createSeatingIcon(restaurant, selectedRestaurant?.id === restaurant.id)
                  : createVibeIcon(getVibe(restaurant), selectedRestaurant?.id === restaurant.id)
              }
              eventHandlers={{ click: () => onRestaurantSelect(restaurant) }}
            />
          ) : null
        )}
      </MapContainer>

      {/* ── Toggle button top-right ── */}
      <button
        onClick={() => { setFilterMode(m => m === 'vibe' ? 'seating' : 'vibe'); setActiveVibes(new Set()); }}
        className="absolute top-3 right-3 z-[1000] flex items-center gap-1.5 bg-white/90 backdrop-blur-sm rounded-full px-3 py-1.5 shadow-md border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-white transition-all"
      >
        <Zap className="w-3.5 h-3.5 text-purple-500" />
        {filterMode === 'vibe' ? 'Vibe Filter' : 'Seating Filter'}
      </button>

      {/* ── Vibe filter pills (left side, vibe mode only) ── */}
      {filterMode === 'vibe' && (
        <div className="absolute top-3 left-3 z-[1000] flex flex-col gap-1.5">
          {VIBES.map(vibe => {
            const isActive = activeVibes.has(vibe.id);
            const count = restaurants.filter(r => getVibe(r) === vibe.id && r.latitude && r.longitude).length;
            return (
              <button
                key={vibe.id}
                onClick={() => toggleVibe(vibe.id)}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all shadow-sm border backdrop-blur-sm",
                  isActive
                    ? "text-white shadow-lg scale-[1.02]"
                    : "bg-white/90 text-slate-700 border-slate-200 hover:border-slate-300 hover:shadow-md"
                )}
                style={isActive ? { backgroundColor: vibe.color, borderColor: vibe.color } : {}}
              >
                <span className="text-base leading-none">{vibe.icon}</span>
                <span>{vibe.label}</span>
                <span className={cn("ml-auto text-xs px-1.5 py-0.5 rounded-full font-semibold", isActive ? "bg-white/25 text-white" : "bg-slate-100 text-slate-500")}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Seating legend (left side, seating mode only) ── */}
      {filterMode === 'seating' && (
        <div className="absolute top-3 left-3 z-[1000] flex flex-col gap-1.5 bg-white/90 backdrop-blur-sm rounded-xl px-3 py-2.5 shadow-md border border-slate-200">
          {[
            { color: '#22c55e', label: 'Chill' },
            { color: '#eab308', label: 'Moderate' },
            { color: '#ef4444', label: 'Full' },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-2 text-xs text-slate-700 font-medium">
              <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: color }} />
              {label}
            </div>
          ))}
        </div>
      )}

      {/* ── Selected Restaurant Card ── */}
      {selectedRestaurant && (
        <div className="absolute bottom-4 left-4 right-4 bg-white rounded-2xl shadow-xl p-4 z-[1000]">
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 h-8 w-8 rounded-full"
            onClick={() => onRestaurantSelect(null)}
          >
            <X className="w-4 h-4" />
          </Button>

          {filterMode === 'vibe' ? (() => {
            const vibe = VIBES.find(v => v.id === getVibe(selectedRestaurant));
            return (
              <div
                className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full mb-2"
                style={{ backgroundColor: vibe.heatColor, color: vibe.color, border: `1px solid ${vibe.borderColor}` }}
              >
                {vibe.icon} {vibe.label}
              </div>
            );
          })() : (() => {
            const s = getSeatingColor(selectedRestaurant);
            return (
              <div
                className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full mb-2 text-white"
                style={{ backgroundColor: s.bg }}
              >
                {s.label}
              </div>
            );
          })()}

          <div className="flex gap-4 cursor-pointer" onClick={() => onRestaurantClick(selectedRestaurant)}>
            <img
              src={selectedRestaurant.cover_image || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=200&q=80'}
              alt={selectedRestaurant.name}
              className="w-24 h-24 rounded-xl object-cover"
            />
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-lg text-slate-900 truncate">{selectedRestaurant.name}</h3>
              <p className="text-slate-600 text-sm mb-2">{selectedRestaurant.cuisine} • {selectedRestaurant.neighborhood}</p>
              <div className="flex items-center justify-between">
                <OccupancyBadge
                  available={selectedRestaurant.available_seats}
                  total={selectedRestaurant.total_seats}
                  isFull={selectedRestaurant.is_full}
                  size="sm"
                />
                <StarRating
                  rating={selectedRestaurant.average_rating}
                  count={selectedRestaurant.review_count}
                  size="sm"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
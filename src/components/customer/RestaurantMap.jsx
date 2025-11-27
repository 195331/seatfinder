import React, { useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { X } from 'lucide-react';
import { Button } from "@/components/ui/button";
import OccupancyBadge from "@/components/ui/OccupancyBadge";
import StarRating from "@/components/ui/StarRating";
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default markers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom colored markers
const createColoredIcon = (color) => {
  const colors = {
    green: '#10b981',
    yellow: '#f59e0b',
    red: '#ef4444'
  };
  
  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="
        background-color: ${colors[color]};
        width: 28px;
        height: 28px;
        border-radius: 50%;
        border: 3px solid white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      "></div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14]
  });
};

const getMarkerColor = (restaurant) => {
  if (restaurant.is_full) return 'red';
  const occupancy = restaurant.total_seats > 0 
    ? ((restaurant.total_seats - restaurant.available_seats) / restaurant.total_seats) * 100 
    : 0;
  if (occupancy >= 85) return 'red';
  if (occupancy >= 60) return 'yellow';
  return 'green';
};

function MapUpdater({ center }) {
  const map = useMap();
  React.useEffect(() => {
    if (center) {
      map.setView(center, 14);
    }
  }, [center, map]);
  return null;
}

export default function RestaurantMap({ 
  restaurants, 
  center, 
  selectedRestaurant, 
  onRestaurantSelect,
  onRestaurantClick 
}) {
  const defaultCenter = center || [40.7178, -74.0431]; // Jersey City

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
        
        {restaurants.map((restaurant) => (
          restaurant.latitude && restaurant.longitude && (
            <Marker
              key={restaurant.id}
              position={[restaurant.latitude, restaurant.longitude]}
              icon={createColoredIcon(getMarkerColor(restaurant))}
              eventHandlers={{
                click: () => onRestaurantSelect(restaurant)
              }}
            />
          )
        ))}
      </MapContainer>

      {/* Selected Restaurant Card */}
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
          
          <div 
            className="flex gap-4 cursor-pointer"
            onClick={() => onRestaurantClick(selectedRestaurant)}
          >
            <img
              src={selectedRestaurant.cover_image || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=200&q=80'}
              alt={selectedRestaurant.name}
              className="w-24 h-24 rounded-xl object-cover"
            />
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-lg text-slate-900 truncate">
                {selectedRestaurant.name}
              </h3>
              <p className="text-slate-600 text-sm mb-2">
                {selectedRestaurant.cuisine} • {selectedRestaurant.neighborhood}
              </p>
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
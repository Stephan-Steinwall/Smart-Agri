'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { MapPin } from 'lucide-react';

// Fix Next.js Leaflet default marker icon issue
const DefaultIcon = L.icon({
  iconUrl: '/leaflet/marker-icon.png',
  iconRetinaUrl: '/leaflet/marker-icon-2x.png',
  shadowUrl: '/leaflet/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  tooltipAnchor: [16, -28],
  shadowSize: [41, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

const DEVICE_ID = 'esp32_weather_01';

// Auto-fit bounds to the full drone orthomosaic bounds
function FitBounds() {
  const map = useMap();
  useEffect(() => {
    // The exact bounding box of the generated XYZ tiles
    const bounds = L.latLngBounds(
      [7.093397, 80.404815], // SouthWest corner
      [7.095782, 80.407905]  // NorthEast corner
    );
    map.fitBounds(bounds, { padding: [10, 10] });
  }, [map]);
  return null;
}

function FocusMap({ locations }: { locations?: { lat: number; lng: number }[] }) {
  const map = useMap();
  useEffect(() => {
    if (locations && locations.length > 0) {
      if (locations.length === 1) {
        map.flyTo([locations[0].lat, locations[0].lng], 22, { animate: true, duration: 1.5 });
      } else {
        const bounds = L.latLngBounds(locations.map(loc => [loc.lat, loc.lng]));
        map.flyToBounds(bounds, { padding: [50, 50], maxZoom: 22, animate: true, duration: 1.5 });
      }
    }
  }, [locations, map]);
  return null;
}

export type SoilReading = {
  id: string;
  device_id: string;
  moisture: number | null;
  temperature: number | null;
  ph: number | null;
  electricalConductivity: number | null;
  nitrogen: number | null;
  phosphorus: number | null;
  potassium: number | null;
  latitude?: number;
  longitude?: number;
  time: string;
};

export default function FarmMapClient({ 
  mapLayer = 'drone',
  focusedLocations
}: { 
  mapLayer?: 'drone' | 'satellite';
  focusedLocations?: { lat: number; lng: number; label: string }[];
}) {
  const { data: history, isLoading, isError } = useQuery<SoilReading[]>({
    queryKey: ['wirelessSoilSensorAnalysis', DEVICE_ID],
    queryFn: async () => {
      const res = await apiClient.get(`/telemetry/dashboard-history/${DEVICE_ID}`);
      return res.data;
    },
  });

  const validMarkers = useMemo(() => {
    if (!history) return [];
    return history.filter(
      (h) => typeof h.latitude === 'number' && typeof h.longitude === 'number'
    );
  }, [history]);

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-slate-50 dark:bg-slate-900 rounded-[1.5rem] border border-slate-200 dark:border-slate-800">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm text-slate-500 font-medium">Loading map data...</p>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-slate-50 dark:bg-slate-900 rounded-[1.5rem] border border-slate-200 dark:border-slate-800">
        <div className="text-center p-6">
          <p className="text-red-500 font-medium mb-2">Error loading map data.</p>
          <p className="text-sm text-slate-500">Please check your connection and try again.</p>
        </div>
      </div>
    );
  }

  const defaultCenter: [number, number] = [7.8731, 80.7718]; // Sri Lanka fallback
  const mapCenter = validMarkers.length > 0
    ? [validMarkers[0].latitude!, validMarkers[0].longitude!] as [number, number]
    : defaultCenter;

  return (
    <div className="w-full h-full min-h-[500px] flex flex-col relative z-0">
      <MapContainer
        center={mapCenter}
        zoom={validMarkers.length > 0 ? 18 : 7}
        maxZoom={24}
        className="w-full h-full z-0 flex-1"
        scrollWheelZoom={true}
      >
        {mapLayer === 'satellite' && (
          <TileLayer
            attribution='&copy; Google'
            url="http://mt0.google.com/vt/lyrs=y&hl=en&x={x}&y={y}&z={z}"
            maxNativeZoom={20}
            maxZoom={24}
          />
        )}
        {mapLayer === 'drone' && (
          <TileLayer
            url="/farm_tiles/{z}/{x}/{y}.png"
            minZoom={14}
            maxZoom={24}
            maxNativeZoom={20}
            noWrap={true}
          />
        )}

        {validMarkers.map((reading) => (
          <Marker
            key={reading.id}
            position={[reading.latitude!, reading.longitude!]}
          >
            <Popup className="rounded-xl overflow-hidden shadow-lg border-0">
              <div className="p-1 -m-1">
                <h3 className="font-bold text-slate-800 text-sm mb-2 pb-2 border-b border-slate-100 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-green-600" />
                  {reading.device_id}
                </h3>
                <div className="grid grid-cols-2 gap-3 text-xs mb-3">
                  <div className="flex flex-col">
                    <span className="text-slate-400 font-medium uppercase text-[10px]">Nitrogen</span>
                    <span className="font-bold text-slate-700">{reading.nitrogen ?? '—'} mg/kg</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-slate-400 font-medium uppercase text-[10px]">Phosphorus</span>
                    <span className="font-bold text-slate-700">{reading.phosphorus ?? '—'} mg/kg</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-slate-400 font-medium uppercase text-[10px]">Potassium</span>
                    <span className="font-bold text-slate-700">{reading.potassium ?? '—'} mg/kg</span>
                  </div>
                  {reading.ph != null && (
                    <div className="flex flex-col">
                      <span className="text-slate-400 font-medium uppercase text-[10px]">pH</span>
                      <span className="font-bold text-slate-700">{reading.ph.toFixed(1)}</span>
                    </div>
                  )}
                  {reading.moisture != null && (
                    <div className="flex flex-col">
                      <span className="text-slate-400 font-medium uppercase text-[10px]">Moisture</span>
                      <span className="font-bold text-slate-700">{reading.moisture.toFixed(1)}%</span>
                    </div>
                  )}
                  {reading.temperature != null && (
                    <div className="flex flex-col">
                      <span className="text-slate-400 font-medium uppercase text-[10px]">Temp</span>
                      <span className="font-bold text-slate-700">{reading.temperature.toFixed(1)}°C</span>
                    </div>
                  )}
                </div>
                <div className="text-[10px] text-slate-400 mb-2">
                  Recorded: {new Date(reading.time).toLocaleString()}
                </div>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${reading.latitude},${reading.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full text-center bg-blue-50 hover:bg-blue-100 text-blue-600 font-medium text-xs py-2 rounded-lg transition-colors"
                >
                  Open in Google Maps
                </a>
              </div>
            </Popup>
          </Marker>
        ))}
        {focusedLocations && focusedLocations.map((loc, idx) => (
          <Marker key={`focused-${idx}`} position={[loc.lat, loc.lng]}>
            <Popup className="rounded-xl overflow-hidden shadow-lg border-0">
              <div className="p-2 text-center">
                <h3 className="font-bold text-slate-800 text-sm mb-1">{loc.label || 'Selected Sample'}</h3>
                <p className="text-xs text-slate-500">
                  {loc.lat.toFixed(6)}, {loc.lng.toFixed(6)}
                </p>
              </div>
            </Popup>
          </Marker>
        ))}
        <FitBounds />
        <FocusMap locations={focusedLocations} />
      </MapContainer>
    </div>
  );
}

'use client';

import React, { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, LayersControl, useMap } from 'react-leaflet';
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

// Auto-fit bounds component
function FitBounds({ markers }: { markers: any[] }) {
  const map = useMap();
  useEffect(() => {
    if (markers.length > 0) {
      const bounds = L.latLngBounds(markers.map((m) => [m.latitude, m.longitude]));
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [markers, map]);
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

export default function FarmMapClient() {
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
    <div className="w-full h-full min-h-[500px] flex flex-col rounded-[1.5rem] overflow-hidden border border-slate-200 dark:border-slate-800 relative shadow-sm">
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[400] bg-white/90 dark:bg-slate-900/90 backdrop-blur px-4 py-2 rounded-full shadow-lg border border-slate-200 dark:border-slate-700 pointer-events-none">
        <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
          {validMarkers.length} Soil Samples Found
        </span>
      </div>

      <MapContainer
        center={mapCenter}
        zoom={validMarkers.length > 0 ? 18 : 7}
        className="w-full h-full z-0 flex-1"
        scrollWheelZoom={true}
      >
        <LayersControl position="topright">
          <LayersControl.BaseLayer name="OpenStreetMap">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer checked name="Drone Orthomosaic">
            <TileLayer
              url="/farm_tiles/{z}/{x}/{y}.png"
              minZoom={14}
              maxZoom={20}
              maxNativeZoom={20}
              noWrap={true}
            />
          </LayersControl.BaseLayer>
        </LayersControl>

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
        {validMarkers.length > 0 && <FitBounds markers={validMarkers} />}
      </MapContainer>
    </div>
  );
}

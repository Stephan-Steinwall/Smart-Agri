// src/components/Map.tsx
"use client";

import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default marker icons in React-Leaflet
const icon = L.icon({
    iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
});

export default function Map() {
    // Mock coordinates for Green Valley Farms
    const center: [number, number] = [6.9271, 79.8612];

    return (
        <MapContainer center={center} zoom={13} className="h-full w-full rounded-xl z-0">
            <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            />

            <Marker position={[6.9271, 79.8612]} icon={icon}>
                <Popup>
                    <div className="font-semibold text-primary">Field A - Spot Check</div>
                    <div className="text-xs text-muted-foreground mt-1">Health: 78% (Moderate)</div>
                </Popup>
            </Marker>

            <Marker position={[6.9350, 79.8550]} icon={icon}>
                <Popup>
                    <div className="font-semibold text-primary">Field B - Spot Check</div>
                    <div className="text-xs text-muted-foreground mt-1">Health: 91% (Optimal)</div>
                </Popup>
            </Marker>
        </MapContainer>
    );
}
// src/components/FieldMap.tsx
// Enhanced map component — accepts live device + reading data, renders color-coded pins
"use client";

import { MapContainer, TileLayer, Marker, Popup, CircleMarker } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// ── Types ─────────────────────────────────────────────────────────────────────
export interface DevicePin {
    id: string;
    alias?: string;
    macAddress: string;
    deviceType: 'HUB' | 'NODE';
    operatingMode: 'FIXED' | 'PORTABLE';
    isOnline: boolean;
    batteryStatus?: number;
    loraSignalStrength?: number;
    latitude?: number;
    longitude?: number;
    field?: { id: string; name: string } | null;
    latestReading?: {
        moisture?: number;
        nitrogen?: number;
        phosphorus?: number;
        potassium?: number;
        ph?: number;
        temperature?: number;
        batteryLevel?: number;
    } | null;
    healthScore?: number; // 0-100
}

export interface SpotCheckPin {
    lat: number;
    lng: number;
    time: Date;
    moisture?: number;
    nitrogen?: number;
    phosphorus?: number;
    potassium?: number;
    ph?: number;
    temperature?: number;
}

interface FieldMapProps {
    devices?: DevicePin[];
    spotChecks?: SpotCheckPin[];
    center?: [number, number];
    zoom?: number;
}

// ── Health score → color ───────────────────────────────────────────────────
function getHealthColor(score?: number, isOnline?: boolean): { fill: string; stroke: string; label: string } {
    if (!isOnline) return { fill: '#94a3b8', stroke: '#64748b', label: 'Offline' };
    if (score === undefined || score === null) return { fill: '#f59e0b', stroke: '#d97706', label: 'Unknown' };
    if (score >= 80) return { fill: '#22c55e', stroke: '#16a34a', label: 'Optimal' };
    if (score >= 60) return { fill: '#f59e0b', stroke: '#d97706', label: 'Moderate' };
    return { fill: '#ef4444', stroke: '#dc2626', label: 'Critical' };
}

// ── Custom SVG marker icon ─────────────────────────────────────────────────
function createCustomIcon(fill: string, stroke: string, isPortable = false, isHub = false) {
    const size = isHub ? 32 : isPortable ? 26 : 28;
    const inner = isHub ? `<rect x="6" y="6" width="20" height="20" rx="4" fill="${fill}" stroke="${stroke}" stroke-width="2"/>
      <line x1="16" y1="2" x2="16" y2="6" stroke="${stroke}" stroke-width="2"/>
      <line x1="16" y1="26" x2="16" y2="30" stroke="${stroke}" stroke-width="2"/>
      <line x1="2" y1="16" x2="6" y2="16" stroke="${stroke}" stroke-width="2"/>
      <line x1="26" y1="16" x2="30" y2="16" stroke="${stroke}" stroke-width="2"/>`
        : isPortable ? `<path d="M13 2 L19 2 L19 28 L13 28 L13 2 Z" rx="3" fill="${fill}" stroke="${stroke}" stroke-width="2"/>
      <circle cx="16" cy="5" r="1.5" fill="${stroke}"/>
      <circle cx="16" cy="25" r="1.5" fill="${stroke}"/>`
        : `<circle cx="16" cy="12" r="9" fill="${fill}" stroke="${stroke}" stroke-width="2.5"/>
      <path d="M16 21 L16 30" stroke="${stroke}" stroke-width="2.5" stroke-linecap="round"/>`;

    const svg = `<svg width="${size}" height="${size + 4}" viewBox="0 0 32 34" xmlns="http://www.w3.org/2000/svg">
      ${inner}
    </svg>`;

    return L.divIcon({
        html: svg,
        className: '',
        iconSize: [size, size + 4],
        iconAnchor: [size / 2, size + 4],
        popupAnchor: [0, -(size + 4)],
    });
}

// ── Popup content helper ───────────────────────────────────────────────────
function DevicePopupContent({ device }: { device: DevicePin }) {
    const { fill, label } = getHealthColor(device.healthScore, device.isOnline);
    const r = device.latestReading;
    const batteryWarning = device.batteryStatus !== undefined && device.batteryStatus < 20;

    return (
        <div style={{ fontFamily: 'system-ui, sans-serif', minWidth: '200px' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', paddingBottom: '8px', borderBottom: '1px solid #e2e8f0' }}>
                <div style={{
                    width: '10px', height: '10px', borderRadius: '50%', flexShrink: 0,
                    background: device.isOnline ? '#22c55e' : '#94a3b8',
                    boxShadow: device.isOnline ? '0 0 0 3px rgba(34,197,94,0.2)' : 'none'
                }} />
                <div>
                    <div style={{ fontWeight: 700, fontSize: '13px', color: '#1e293b' }}>
                        {device.alias || device.macAddress}
                    </div>
                    <div style={{ fontSize: '10px', color: '#64748b', marginTop: '1px' }}>
                        {device.field?.name ?? 'Unassigned'} • {device.operatingMode === 'PORTABLE' ? '📱 Portable' : device.deviceType === 'HUB' ? '🏛️ Hub' : '📡 Fixed Node'}
                    </div>
                </div>
            </div>

            {/* Health badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                    padding: '2px 8px', borderRadius: '99px', fontSize: '11px', fontWeight: 600,
                    background: fill + '25', color: fill,
                    border: `1px solid ${fill}50`
                }}>
                    {label}{device.healthScore !== undefined ? ` — ${device.healthScore}%` : ''}
                </span>
            </div>

            {/* Telemetry grid */}
            {r && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 8px', marginBottom: '8px' }}>
                    {r.moisture !== undefined && <div style={{ fontSize: '11px', color: '#64748b' }}>💧 Moisture: <strong style={{ color: '#1e293b' }}>{r.moisture?.toFixed(1)}%</strong></div>}
                    {r.ph !== undefined && <div style={{ fontSize: '11px', color: '#64748b' }}>⚗️ pH: <strong style={{ color: '#1e293b' }}>{r.ph?.toFixed(1)}</strong></div>}
                    {r.nitrogen !== undefined && <div style={{ fontSize: '11px', color: '#64748b' }}>🌿 N: <strong style={{ color: '#1e293b' }}>{r.nitrogen?.toFixed(0)} ppm</strong></div>}
                    {r.phosphorus !== undefined && <div style={{ fontSize: '11px', color: '#64748b' }}>🔵 P: <strong style={{ color: '#1e293b' }}>{r.phosphorus?.toFixed(0)} ppm</strong></div>}
                    {r.potassium !== undefined && <div style={{ fontSize: '11px', color: '#64748b' }}>🟡 K: <strong style={{ color: '#1e293b' }}>{r.potassium?.toFixed(0)} ppm</strong></div>}
                    {r.temperature !== undefined && <div style={{ fontSize: '11px', color: '#64748b' }}>🌡️ Temp: <strong style={{ color: '#1e293b' }}>{r.temperature?.toFixed(1)}°C</strong></div>}
                </div>
            )}

            {/* Battery + LoRa */}
            <div style={{ display: 'flex', gap: '8px', fontSize: '11px', color: '#64748b', paddingTop: '6px', borderTop: '1px solid #e2e8f0' }}>
                {device.batteryStatus !== undefined && (
                    <span style={{ color: batteryWarning ? '#ef4444' : '#64748b' }}>
                        🔋 {device.batteryStatus}%{batteryWarning ? ' ⚠️' : ''}
                    </span>
                )}
                {device.loraSignalStrength !== undefined && (
                    <span>📶 {device.loraSignalStrength} dBm</span>
                )}
                {device.macAddress && (
                    <span style={{ marginLeft: 'auto', color: '#94a3b8', fontFamily: 'monospace', fontSize: '10px' }}>
                        {device.macAddress.slice(-8)}
                    </span>
                )}
            </div>
        </div>
    );
}

// ── Main Map Component ─────────────────────────────────────────────────────
export default function FieldMap({
    devices = [],
    spotChecks = [],
    center = [6.9271, 79.8612],
    zoom = 16,
}: FieldMapProps) {
    // Filter out devices without valid GPS
    const mappableDevices = devices.filter(d => d.latitude && d.longitude);

    // Compute center from devices if available
    const mapCenter: [number, number] = mappableDevices.length > 0
        ? [
            mappableDevices.reduce((sum, d) => sum + (d.latitude ?? center[0]), 0) / mappableDevices.length,
            mappableDevices.reduce((sum, d) => sum + (d.longitude ?? center[1]), 0) / mappableDevices.length,
        ]
        : center;

    return (
        <MapContainer
            center={mapCenter}
            zoom={zoom}
            className="h-full w-full"
            style={{ zIndex: 0 }}
        >
            <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            />

            {/* Device pins */}
            {mappableDevices.map((device) => {
                const { fill, stroke } = getHealthColor(device.healthScore, device.isOnline);
                const isHub = device.deviceType === 'HUB';
                const isPortable = device.operatingMode === 'PORTABLE';
                const icon = createCustomIcon(fill, stroke, isPortable, isHub);

                return (
                    <Marker
                        key={device.id}
                        position={[device.latitude!, device.longitude!]}
                        icon={icon}
                    >
                        <Popup maxWidth={260} className="leaflet-popup-custom">
                            <DevicePopupContent device={device} />
                        </Popup>
                    </Marker>
                );
            })}

            {/* Portable spot-check rings */}
            {spotChecks.map((check, i) => {
                const score = check.moisture !== undefined
                    ? Math.min(100, (check.moisture / 60) * 40 + (check.ph ? (Math.abs(check.ph - 6.5) < 0.5 ? 30 : 15) : 15) + 30)
                    : undefined;
                const { fill, stroke } = getHealthColor(score, true);

                return (
                    <CircleMarker
                        key={`spot-${i}`}
                        center={[check.lat, check.lng]}
                        radius={8}
                        pathOptions={{ fillColor: fill, color: stroke, fillOpacity: 0.85, weight: 2 }}
                    >
                        <Popup maxWidth={220}>
                            <div style={{ fontFamily: 'system-ui, sans-serif' }}>
                                <div style={{ fontWeight: 700, fontSize: '12px', color: '#1e293b', marginBottom: '6px' }}>
                                    📱 Portable Spot Check
                                </div>
                                <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '8px' }}>
                                    {new Date(check.time).toLocaleString()}
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px 8px', fontSize: '11px', color: '#64748b' }}>
                                    {check.moisture !== undefined && <div>💧 <strong style={{ color: '#1e293b' }}>{check.moisture.toFixed(1)}%</strong></div>}
                                    {check.ph !== undefined && <div>⚗️ <strong style={{ color: '#1e293b' }}>{check.ph.toFixed(1)}</strong></div>}
                                    {check.nitrogen !== undefined && <div>🌿 <strong style={{ color: '#1e293b' }}>{check.nitrogen.toFixed(0)} N</strong></div>}
                                    {check.temperature !== undefined && <div>🌡️ <strong style={{ color: '#1e293b' }}>{check.temperature.toFixed(1)}°C</strong></div>}
                                </div>
                            </div>
                        </Popup>
                    </CircleMarker>
                );
            })}
        </MapContainer>
    );
}

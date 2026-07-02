// src/app/map/page.tsx
"use client";

import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import dynamic from 'next/dynamic';
import { Loader2, MapPin, Circle, Wifi, WifiOff, Battery, Radio } from 'lucide-react';
import { DevicePin } from '@/components/FieldMap';

const API_BASE = 'http://localhost:3001/api/v1';

// Dynamically import FieldMap (Leaflet is browser-only)
const FieldMap = dynamic(() => import('@/components/FieldMap'), {
    ssr: false,
    loading: () => (
        <div className="h-full w-full flex items-center justify-center"
            style={{ background: 'var(--muted)', borderRadius: '1rem' }}>
            <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--primary)' }} />
                <p className="text-sm font-medium" style={{ color: 'var(--muted-foreground)' }}>Loading Map...</p>
            </div>
        </div>
    ),
});

// ── Health score calculation ─────────────────────────────────────────────────
function computeHealthScore(reading: any): number {
    if (!reading) return 0;
    let score = 0;
    if (reading.moisture !== undefined) score += Math.min(40, (reading.moisture / 60) * 40);
    if (reading.ph !== undefined) score += Math.abs(reading.ph - 6.5) < 0.5 ? 30 : Math.abs(reading.ph - 6.5) < 1 ? 15 : 5;
    if (reading.nitrogen !== undefined) score += Math.min(30, (reading.nitrogen / 60) * 30);
    return Math.round(Math.min(100, score));
}

// ── Legend badge ─────────────────────────────────────────────────────────────
function LegendDot({ color, label }: { color: string; label: string }) {
    return (
        <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: color, boxShadow: `0 0 0 3px ${color}30` }} />
            <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{label}</span>
        </div>
    );
}

// ── Device list card ──────────────────────────────────────────────────────────
function DeviceListItem({ device }: { device: DevicePin }) {
    const batteryWarn = device.batteryStatus !== undefined && device.batteryStatus < 20;
    const healthScore = device.healthScore ?? 0;
    const healthColor = !device.isOnline ? '#94a3b8'
        : healthScore >= 80 ? '#22c55e'
        : healthScore >= 60 ? '#f59e0b'
        : '#ef4444';

    return (
        <div
            className="flex items-center gap-3 px-4 py-3 transition-colors"
            style={{ borderBottom: '1px solid var(--border)' }}
        >
            {/* Online dot */}
            <div
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{
                    background: device.isOnline ? '#22c55e' : '#94a3b8',
                    boxShadow: device.isOnline ? '0 0 0 3px rgba(34,197,94,0.15)' : 'none',
                }}
            />

            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold truncate" style={{ color: 'var(--foreground)' }}>
                        {device.alias || device.macAddress}
                    </span>
                    {!device.isOnline && (
                        <span className="text-[10px] px-1.5 rounded" style={{ background: 'hsl(4,80%,95%)', color: 'hsl(4,80%,50%)' }}>
                            OFFLINE
                        </span>
                    )}
                </div>
                <div className="text-[10px] mt-0.5 truncate" style={{ color: 'var(--muted-foreground)' }}>
                    {device.field?.name ?? 'Unassigned'} •{' '}
                    {device.operatingMode === 'PORTABLE' ? '📱 Portable' : device.deviceType === 'HUB' ? '🏛️ Hub' : '📡 Fixed Node'}
                </div>
            </div>

            <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                {/* Health score */}
                {device.isOnline && healthScore > 0 && (
                    <span className="text-xs font-bold" style={{ color: healthColor }}>
                        {healthScore}%
                    </span>
                )}
                {/* Battery */}
                {device.batteryStatus !== undefined && (
                    <span className="text-[10px]" style={{ color: batteryWarn ? '#ef4444' : 'var(--muted-foreground)' }}>
                        🔋 {device.batteryStatus}%
                    </span>
                )}
                {/* LoRa */}
                {device.loraSignalStrength !== undefined && (
                    <span className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>
                        📶 {device.loraSignalStrength} dBm
                    </span>
                )}
            </div>
        </div>
    );
}

// ── Stat mini card ────────────────────────────────────────────────────────────
function StatPill({ label, value, color }: { label: string; value: string | number; color: string }) {
    return (
        <div className="rounded-xl px-4 py-3 text-center" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
            <div className="text-lg font-bold" style={{ color }}>{value}</div>
            <div className="text-[11px] mt-0.5" style={{ color: 'var(--muted-foreground)' }}>{label}</div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function FieldMapPage() {

    // Fetch all devices (with GPS, field, status)
    const { data: allDevices, isLoading: devicesLoading, isError } = useQuery({
        queryKey: ['all-devices-map'],
        queryFn: async () => {
            const res = await axios.get(`${API_BASE}/devices`);
            return res.data as DevicePin[];
        },
        staleTime: 30_000,
        refetchInterval: 60_000,
    });

    // Fetch latest telemetry for each fixed node to compute health score
    const { data: telemetryMap } = useQuery({
        queryKey: ['devices-latest-telemetry', allDevices?.map(d => d.id).join(',')],
        queryFn: async () => {
            if (!allDevices) return {};
            const map: Record<string, any> = {};
            await Promise.allSettled(
                allDevices
                    .filter(d => d.latitude && d.longitude) // only mappable
                    .map(async (d) => {
                        try {
                            const res = await axios.get(`${API_BASE}/telemetry/latest/${d.id}`);
                            map[d.id] = res.data;
                        } catch { /* device may have no readings yet */ }
                    })
            );
            return map;
        },
        enabled: !!allDevices && allDevices.length > 0,
        staleTime: 30_000,
    });

    // Enrich devices with their latest readings + health score
    const enrichedDevices: DevicePin[] = (allDevices ?? []).map(device => {
        const reading = telemetryMap?.[device.id] ?? null;
        return {
            ...device,
            latestReading: reading,
            healthScore: reading ? computeHealthScore(reading) : undefined,
        };
    });

    const mappableDevices = enrichedDevices.filter(d => d.latitude && d.longitude);
    const onlineCount = enrichedDevices.filter(d => d.isOnline).length;
    const offlineCount = enrichedDevices.length - onlineCount;
    const lowBatteryCount = enrichedDevices.filter(d => d.batteryStatus !== undefined && d.batteryStatus < 20).length;
    const avgHealth = enrichedDevices.length > 0
        ? Math.round(enrichedDevices.filter(d => d.healthScore !== undefined).reduce((sum, d) => sum + (d.healthScore ?? 0), 0) / Math.max(1, enrichedDevices.filter(d => d.healthScore !== undefined).length))
        : 0;

    if (isError) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="rounded-2xl p-8 text-center max-w-md" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                    <WifiOff className="w-10 h-10 mx-auto mb-3" style={{ color: 'hsl(4,80%,52%)' }} />
                    <h2 className="font-bold text-base mb-1" style={{ color: 'var(--foreground)' }}>Cannot load device data</h2>
                    <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                        Ensure the backend is running on <code className="rounded px-1" style={{ background: 'var(--muted)' }}>http://localhost:3001</code>
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col gap-5 animate-fade-in">

            {/* ── Page header ── */}
            <div className="flex items-center justify-between flex-shrink-0">
                <div>
                    <h2 className="text-2xl font-bold flex items-center gap-2.5" style={{ color: 'var(--foreground)' }}>
                        <MapPin className="w-6 h-6" style={{ color: 'var(--primary)' }} />
                        Field Map
                    </h2>
                    <p className="text-sm mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                        Live geospatial view of your farm's sensor network
                    </p>
                </div>

                {/* Stats row */}
                <div className="flex gap-3">
                    <StatPill label="Online" value={onlineCount} color="#22c55e" />
                    <StatPill label="Offline" value={offlineCount} color={offlineCount > 0 ? '#ef4444' : 'var(--muted-foreground)'} />
                    <StatPill label="Avg Health" value={avgHealth > 0 ? `${avgHealth}%` : '—'} color={avgHealth >= 80 ? '#22c55e' : avgHealth >= 60 ? '#f59e0b' : '#ef4444'} />
                    {lowBatteryCount > 0 && (
                        <StatPill label="Low Battery" value={lowBatteryCount} color="#ef4444" />
                    )}
                </div>
            </div>

            {/* ── Main grid: Map + Sidebar ── */}
            <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-3 gap-5">

                {/* Map (2/3 width) */}
                <div
                    className="lg:col-span-2 rounded-2xl overflow-hidden relative"
                    style={{ border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)', minHeight: '400px' }}
                >
                    {/* Legend overlay */}
                    <div
                        className="absolute top-3 left-3 z-10 rounded-xl px-3.5 py-2.5 flex flex-col gap-1.5"
                        style={{ background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(8px)', border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 2px 12px rgba(0,0,0,0.1)' }}
                    >
                        <p className="text-[10px] font-bold uppercase tracking-wider mb-0.5" style={{ color: '#64748b' }}>Pin Legend</p>
                        <LegendDot color="#22c55e" label="Optimal (>80%)" />
                        <LegendDot color="#f59e0b" label="Moderate (60-79%)" />
                        <LegendDot color="#ef4444" label="Critical (<60%)" />
                        <LegendDot color="#94a3b8" label="Offline" />
                        <div className="mt-1 pt-1" style={{ borderTop: '1px solid #e2e8f0' }}>
                            <p className="text-[10px]" style={{ color: '#94a3b8' }}>⬡ Hub  ◉ Fixed Node  ▐ Portable</p>
                        </div>
                    </div>

                    {devicesLoading ? (
                        <div className="h-full flex items-center justify-center" style={{ background: 'var(--muted)' }}>
                            <div className="flex flex-col items-center gap-3">
                                <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--primary)' }} />
                                <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Loading device locations...</p>
                            </div>
                        </div>
                    ) : (
                        <FieldMap devices={enrichedDevices} />
                    )}
                </div>

                {/* Sidebar: device list (1/3 width) */}
                <div
                    className="rounded-2xl flex flex-col overflow-hidden"
                    style={{ background: 'var(--card)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}
                >
                    {/* Sidebar header */}
                    <div className="px-4 py-4 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
                        <div className="flex items-center gap-2">
                            <Radio className="w-4 h-4" style={{ color: 'var(--primary)' }} />
                            <span className="font-bold text-sm" style={{ color: 'var(--foreground)' }}>Device Network</span>
                            <span
                                className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full"
                                style={{ background: 'hsl(142,40%,94%)', color: 'var(--primary)' }}
                            >
                                {enrichedDevices.length} devices
                            </span>
                        </div>
                    </div>

                    {/* Device list */}
                    <div className="flex-1 overflow-y-auto">
                        {devicesLoading ? (
                            <div className="flex items-center justify-center h-32">
                                <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--primary)' }} />
                            </div>
                        ) : enrichedDevices.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-32 gap-2 px-4 text-center">
                                <MapPin className="w-8 h-8 opacity-20" style={{ color: 'var(--foreground)' }} />
                                <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                                    No devices found. Register devices in Device Config.
                                </p>
                            </div>
                        ) : (
                            enrichedDevices.map(device => (
                                <DeviceListItem key={device.id} device={device} />
                            ))
                        )}
                    </div>

                    {/* Sidebar footer */}
                    <div className="px-4 py-3 flex-shrink-0 flex items-center gap-2" style={{ borderTop: '1px solid var(--border)', background: 'var(--muted)' }}>
                        <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#22c55e' }} />
                        <span className="text-[11px]" style={{ color: 'var(--muted-foreground)' }}>
                            Live updates every 60s
                        </span>
                        {!mappableDevices.length && enrichedDevices.length > 0 && (
                            <span className="text-[10px] ml-auto" style={{ color: '#f59e0b' }}>
                                ⚠️ No GPS data — re-run seed
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

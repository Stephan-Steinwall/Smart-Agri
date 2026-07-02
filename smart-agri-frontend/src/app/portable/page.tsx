// src/app/portable/page.tsx
"use client";

import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import dynamic from 'next/dynamic';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { MapPin, Navigation, WifiOff, Loader2 } from 'lucide-react';
import { DevicePin, SpotCheckPin } from '@/components/FieldMap';

const API_BASE = 'http://localhost:3001/api/v1';

// Dynamically import the map so it only loads in the browser (no SSR)
const FieldMap = dynamic(() => import('@/components/FieldMap'), {
    ssr: false,
    loading: () => <div className="h-full w-full bg-muted animate-pulse rounded-xl flex items-center justify-center">Loading Map...</div>
});

export default function PortableReadings() {

    // Step 1: Fetch the PORTABLE device dynamically from the backend
    const { data: portableDevices, isLoading: devicesLoading, isError: devicesError } = useQuery<DevicePin[]>({
        queryKey: ['portable-nodes'],
        queryFn: async () => {
            const res = await axios.get(`${API_BASE}/devices/portable-nodes`);
            return res.data;
        },
        retry: 2,
        staleTime: 5 * 60 * 1000,
    });

    const portableDevice = portableDevices?.[0];
    const portableDeviceId = portableDevice?.id ?? null;

    // Step 2: Fetch telemetry history for the portable device (runs only when UUID is ready)
    const { data: readings, isLoading: readingsLoading } = useQuery({
        queryKey: ['portableReadings', portableDeviceId],
        queryFn: async () => {
            const res = await axios.get(`${API_BASE}/telemetry/history/${portableDeviceId}`);
            return res.data;
        },
        enabled: !!portableDeviceId,
        retry: 2,
    });

    const isLoading = devicesLoading || readingsLoading;

    // Loading state
    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="text-center space-y-3">
                    <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
                    <p className="text-muted-foreground">Connecting to portable reader...</p>
                </div>
            </div>
        );
    }

    // Error or no portable device seeded
    if (devicesError || !portableDeviceId) {
        return (
            <div className="flex items-center justify-center h-full">
                <Card className="max-w-md w-full">
                    <CardContent className="pt-6 text-center space-y-3">
                        <WifiOff className="w-12 h-12 text-destructive mx-auto" />
                        <h2 className="text-lg font-semibold">No Portable Reader Found</h2>
                        <p className="text-sm text-muted-foreground">
                            Ensure the backend is running on{' '}
                            <code className="bg-muted px-1 rounded">http://localhost:3001</code> and the database has been seeded with a PORTABLE device.
                        </p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // Convert readings into map pins
    // Since we don't have GPS coordinates attached to each individual reading in the DB yet,
    // we use the portable device's base GPS coords and add a tiny spiral offset to plot them visually.
    const baseLat = portableDevice?.latitude ?? 6.9271;
    const baseLng = portableDevice?.longitude ?? 79.8612;

    const spotCheckPins: SpotCheckPin[] = (readings || []).slice(0, 15).map((r: any, idx: number) => {
        // Create a fake spiral offset so pins don't overlap completely
        const angle = idx * 1.5;
        const radius = idx * 0.0001;
        return {
            lat: baseLat + Math.cos(angle) * radius,
            lng: baseLng + Math.sin(angle) * radius,
            time: new Date(r.time),
            moisture: r.moisture,
            nitrogen: r.nitrogen,
            phosphorus: r.phosphorus,
            potassium: r.potassium,
            ph: r.ph,
            temperature: r.temperature,
        };
    });

    return (
        <div className="space-y-6 animate-fade-in">
            <div>
                <h2 className="text-2xl font-bold tracking-tight flex items-center">
                    <Navigation className="w-6 h-6 mr-2 text-primary" />
                    Portable Spot Checks
                </h2>
                <p className="text-muted-foreground">
                    Geotagged soil readings from your portable LoRa reader.{' '}
                    <span className="text-xs">
                        Device: <code className="bg-muted px-1 rounded">{portableDevice?.alias || portableDeviceId}</code>
                    </span>
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" style={{ height: 'calc(100vh - 12rem)', minHeight: '500px' }}>
                {/* Left Side: The Interactive Map */}
                <Card className="flex flex-col h-full border-2 border-primary/20 shadow-sm overflow-hidden">
                    <CardHeader className="bg-primary/5 pb-4">
                        <CardTitle className="text-lg flex items-center">
                            <MapPin className="w-5 h-5 mr-2 text-primary" />
                            Spot Check Map
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0 flex-1 relative z-0">
                        {portableDevice && (
                            <FieldMap
                                devices={[portableDevice]}
                                spotChecks={spotCheckPins}
                                center={[baseLat, baseLng]}
                                zoom={17}
                            />
                        )}
                    </CardContent>
                </Card>

                {/* Right Side: The Data Table */}
                <Card className="flex flex-col h-full shadow-card">
                    <CardHeader className="border-b bg-muted/30">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Navigation className="w-4 h-4 text-primary" />
                            Recent Scans
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 overflow-auto p-0">
                        {!readings || readings.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-center p-6 opacity-60">
                                <MapPin className="w-10 h-10 mb-3 text-muted-foreground" />
                                <p className="text-sm font-medium">No readings recorded yet.</p>
                            </div>
                        ) : (
                            <Table>
                                <TableHeader className="bg-muted/50 sticky top-0 backdrop-blur-sm">
                                    <TableRow>
                                        <TableHead>Time</TableHead>
                                        <TableHead>Moisture</TableHead>
                                        <TableHead className="hidden sm:table-cell">NPK</TableHead>
                                        <TableHead className="hidden md:table-cell">pH</TableHead>
                                        <TableHead className="hidden lg:table-cell">Temp</TableHead>
                                        <TableHead className="text-right">Health</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {readings.map((reading: any, idx: number) => {
                                        // Compute a rough score for the badge
                                        const score = (reading.moisture || 0) * 0.4 +
                                            (reading.ph ? (Math.abs(reading.ph - 6.5) < 0.5 ? 30 : 15) : 15) +
                                            30;

                                        return (
                                            <TableRow key={idx}>
                                                <TableCell className="font-medium text-xs whitespace-nowrap text-muted-foreground">
                                                    {new Date(reading.time).toLocaleString([], {
                                                        month: 'short', day: 'numeric',
                                                        hour: '2-digit', minute: '2-digit'
                                                    })}
                                                </TableCell>
                                                <TableCell>
                                                    <span className="font-bold">{reading.moisture?.toFixed(1)}%</span>
                                                </TableCell>
                                                <TableCell className="hidden sm:table-cell text-xs">
                                                    <span className="text-green-600 font-medium">{reading.nitrogen?.toFixed(0)}</span> /{' '}
                                                    <span className="text-blue-600 font-medium">{reading.phosphorus?.toFixed(0)}</span> /{' '}
                                                    <span className="text-amber-500 font-medium">{reading.potassium?.toFixed(0)}</span>
                                                </TableCell>
                                                <TableCell className="hidden md:table-cell text-xs font-mono">
                                                    {reading.ph?.toFixed(1)}
                                                </TableCell>
                                                <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                                                    {reading.temperature?.toFixed(1)}°C
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {score >= 80 ? (
                                                        <Badge className="bg-green-100 text-green-700 border-green-200 hover:bg-green-100 shadow-none">Optimal</Badge>
                                                    ) : score >= 60 ? (
                                                        <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100 shadow-none">Moderate</Badge>
                                                    ) : (
                                                        <Badge className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100 shadow-none">Critical</Badge>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
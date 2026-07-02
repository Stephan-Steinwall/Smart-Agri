// src/app/portable/page.tsx
"use client";

import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import dynamic from 'next/dynamic';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { MapPin, Navigation, WifiOff, Loader2 } from 'lucide-react';

const API_BASE = 'http://localhost:3001/api/v1';

// Dynamically import the map so it only loads in the browser (no SSR)
const FieldMap = dynamic(() => import('@/components/Map'), {
    ssr: false,
    loading: () => <div className="h-full w-full bg-muted animate-pulse rounded-xl flex items-center justify-center">Loading Map...</div>
});

export default function PortableReadings() {

    // Step 1: Fetch the PORTABLE device UUID dynamically from the backend
    const { data: portableDevices, isLoading: devicesLoading, isError: devicesError } = useQuery({
        queryKey: ['portable-nodes'],
        queryFn: async () => {
            const res = await axios.get(`${API_BASE}/devices/portable-nodes`);
            return res.data;
        },
        retry: 2,
        staleTime: 5 * 60 * 1000,
    });

    const portableDeviceId = portableDevices?.[0]?.id ?? null;

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

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold tracking-tight flex items-center">
                    <Navigation className="w-6 h-6 mr-2 text-primary" />
                    Portable Spot Checks
                </h2>
                <p className="text-muted-foreground">
                    Geotagged soil readings from your portable LoRa reader.{' '}
                    <span className="text-xs">
                        Device: <code className="bg-muted px-1 rounded">{portableDeviceId}</code>
                    </span>
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[500px]">
                {/* Left Side: The Interactive Map */}
                <Card className="flex flex-col h-full border-2 border-primary/20 shadow-sm overflow-hidden">
                    <CardHeader className="bg-primary/5 pb-4">
                        <CardTitle className="text-lg flex items-center">
                            <MapPin className="w-5 h-5 mr-2 text-primary" />
                            Field Map
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0 flex-1 relative z-0">
                        <FieldMap />
                    </CardContent>
                </Card>

                {/* Right Side: The Data Table */}
                <Card className="flex flex-col h-full">
                    <CardHeader>
                        <CardTitle className="text-lg">Recent Scans</CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 overflow-auto">
                        {!readings || readings.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center mt-10">
                                No readings recorded yet for this portable device.
                            </p>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Time</TableHead>
                                        <TableHead>Moisture</TableHead>
                                        <TableHead>Nitrogen</TableHead>
                                        <TableHead>Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {readings.slice(0, 10).map((reading: any, idx: number) => (
                                        <TableRow key={idx}>
                                            <TableCell className="font-medium text-xs">
                                                {new Date(reading.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </TableCell>
                                            <TableCell>{reading.moisture?.toFixed(1)}%</TableCell>
                                            <TableCell>{reading.nitrogen?.toFixed(1)} ppm</TableCell>
                                            <TableCell>
                                                <Badge variant={reading.moisture > 40 ? "default" : "destructive"}>
                                                    {reading.moisture > 40 ? "Healthy" : "Dry"}
                                                </Badge>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
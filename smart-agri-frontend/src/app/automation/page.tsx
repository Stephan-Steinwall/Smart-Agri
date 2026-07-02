"use client";

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Power, Activity, Settings2, WifiOff, Loader2 } from 'lucide-react';
import { useFarmStore } from '@/store/useFarmStore';

const API_BASE = 'http://localhost:3001/api/v1';

export default function AutomationDashboard() {
    const queryClient = useQueryClient();
    const { activeFieldId, activeFieldName } = useFarmStore();

    // Fetch automation devices for the currently selected field
    const { data: devices, isLoading, isError } = useQuery({
        queryKey: ['automation', activeFieldId],
        queryFn: async () => {
            const res = await axios.get(`${API_BASE}/automation/field/${activeFieldId}`);
            return res.data;
        },
        enabled: !!activeFieldId,
        retry: 2,
    });

    // Mutation to Toggle Pump ON/OFF
    const toggleMutation = useMutation({
        mutationFn: async ({ deviceId, turnOn }: { deviceId: string; turnOn: boolean }) => {
            const res = await axios.post(`${API_BASE}/automation/toggle`, {
                deviceId,
                turnOn,
            });
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['automation', activeFieldId] });
        }
    });

    if (!activeFieldId) {
        return (
            <div className="flex items-center justify-center h-full">
                <Card className="max-w-md w-full">
                    <CardContent className="pt-6 text-center space-y-3">
                        <WifiOff className="w-12 h-12 text-muted-foreground mx-auto" />
                        <h2 className="text-lg font-semibold">No Field Selected</h2>
                        <p className="text-sm text-muted-foreground">
                            Use the field selector in the header to choose a field.
                        </p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="text-center space-y-3">
                    <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
                    <p className="text-muted-foreground">Loading Automation Systems...</p>
                </div>
            </div>
        );
    }

    if (isError) {
        return (
            <div className="flex items-center justify-center h-full">
                <Card className="max-w-md w-full">
                    <CardContent className="pt-6 text-center space-y-3">
                        <WifiOff className="w-12 h-12 text-destructive mx-auto" />
                        <h2 className="text-lg font-semibold">Cannot Load Automation Data</h2>
                        <p className="text-sm text-muted-foreground">
                            Ensure the backend is running on{' '}
                            <code className="bg-muted px-1 rounded">http://localhost:3001</code> and the database has been seeded.
                        </p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold tracking-tight">Automation Control: {activeFieldName}</h2>
                <p className="text-muted-foreground">
                    Manage your fixed irrigation and fertigation systems.
                    <span className="ml-2 text-xs">
                        Field: <code className="bg-muted px-1 rounded">{activeFieldId}</code>
                    </span>
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* Left Column: The Control Switches */}
                <div className="lg:col-span-2 space-y-4">
                    <h3 className="text-lg font-semibold flex items-center">
                        <Settings2 className="w-5 h-5 mr-2 text-primary" />
                        Device Controllers
                    </h3>

                    {(!devices || devices.length === 0) ? (
                        <Card>
                            <CardContent className="pt-6 text-center text-muted-foreground">
                                No automation devices found for this field.
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {devices.map((device: any) => (
                                <Card key={device.id} className={device.isOn ? 'border-primary shadow-sm' : ''}>
                                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                                        <div className="space-y-1">
                                            <CardTitle className="text-base">{device.name}</CardTitle>
                                            <Badge variant={device.mode === 'AI_AUTO' ? 'default' : 'secondary'} className="text-[10px]">
                                                {device.mode.replace('_', ' ')}
                                            </Badge>
                                        </div>
                                        <Power className={`w-5 h-5 ${device.isOn ? 'text-green-500' : 'text-muted-foreground'}`} />
                                    </CardHeader>
                                    <CardContent className="flex items-center justify-between mt-4">
                                        <span className="text-sm font-medium text-muted-foreground">
                                            Status: <span className={device.isOn ? 'text-green-600 font-bold' : ''}>{device.isOn ? 'RUNNING' : 'OFF'}</span>
                                        </span>

                                        {/* The Interactive Switch */}
                                        <Switch
                                            checked={device.isOn}
                                            disabled={toggleMutation.isPending}
                                            onCheckedChange={(checked) => toggleMutation.mutate({ deviceId: device.id, turnOn: checked })}
                                        />
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </div>

                {/* Right Column: The Activity Logs */}
                <div className="space-y-4">
                    <h3 className="text-lg font-semibold flex items-center">
                        <Activity className="w-5 h-5 mr-2 text-primary" />
                        Pump Activity Log
                    </h3>
                    <Card className="h-[400px] flex flex-col">
                        <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
                            {devices?.flatMap((d: any) => d.logs ?? [])
                                .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                                .map((log: any) => (
                                    <div key={log.id} className="flex flex-col border-b border-border pb-3 last:border-0">
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm font-semibold">
                                                {devices.find((d: any) => d.logs?.some((l: any) => l.id === log.id))?.name || 'Device'}
                                            </span>
                                            <span className={`text-xs font-bold ${log.action ? 'text-green-600' : 'text-orange-500'}`}>
                                                Turned {log.action ? 'ON' : 'OFF'}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between mt-1">
                                            <span className="text-xs text-muted-foreground">Trigger: {log.triggeredBy}</span>
                                            <span className="text-xs text-muted-foreground">
                                                {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                    </div>
                                ))}

                            {devices?.flatMap((d: any) => d.logs ?? []).length === 0 && (
                                <p className="text-sm text-muted-foreground text-center mt-10">No recent activity.</p>
                            )}
                        </CardContent>
                    </Card>
                </div>

            </div>
        </div>
    );
}
// src/app/settings/page.tsx
"use client";

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Settings, Plus, Loader2, Server, Trash2, Smartphone, Cpu, ShieldAlert, ArrowRightLeft, Radio } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DevicePin } from '@/components/FieldMap';

const API_BASE = 'http://localhost:3001/api/v1';

// ── Icons for device types ─────────────────────────────────────────────────
function DeviceIcon({ type, mode }: { type: string; mode: string }) {
    if (type === 'HUB') return <Server className="w-4 h-4 text-primary" />;
    if (mode === 'PORTABLE') return <Smartphone className="w-4 h-4 text-purple-500" />;
    return <Cpu className="w-4 h-4 text-blue-500" />;
}

// ─────────────────────────────────────────────────────────────────────────────
export default function DeviceConfigPage() {
    const queryClient = useQueryClient();

    // Modals & Forms state
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isReassignModalOpen, setIsReassignModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [selectedDevice, setSelectedDevice] = useState<DevicePin | null>(null);

    // Form data
    const [macAddress, setMacAddress] = useState('');
    const [alias, setAlias] = useState('');
    const [deviceType, setDeviceType] = useState('NODE');
    const [operatingMode, setOperatingMode] = useState('FIXED');
    const [fieldId, setFieldId] = useState<string>('none');

    // ── Data Fetching ──
    const { data: devices, isLoading: devicesLoading } = useQuery<DevicePin[]>({
        queryKey: ['settings-devices'],
        queryFn: async () => {
            const res = await axios.get(`${API_BASE}/devices`);
            return res.data;
        },
    });

    const { data: fields } = useQuery({
        queryKey: ['settings-fields'],
        queryFn: async () => {
            // Re-use sensor-nodes call to extract unique fields
            const res = await axios.get(`${API_BASE}/devices/sensor-nodes`);
            const unique = Array.from(new Map((res.data as any[]).filter(n => n.field).map(n => [n.field.id, n.field])).values());
            return unique as { id: string; name: string }[];
        },
    });

    // ── Mutations ──
    const createMutation = useMutation({
        mutationFn: async (data: any) => axios.post(`${API_BASE}/devices`, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['settings-devices'] });
            setIsCreateModalOpen(false);
            resetForm();
        }
    });

    const updateMutation = useMutation({
        mutationFn: async ({ id, data }: { id: string, data: any }) => axios.patch(`${API_BASE}/devices/${id}`, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['settings-devices'] });
            setIsReassignModalOpen(false);
            setSelectedDevice(null);
        }
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => axios.delete(`${API_BASE}/devices/${id}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['settings-devices'] });
            setIsDeleteModalOpen(false);
            setSelectedDevice(null);
        }
    });

    // ── Helpers ──
    const resetForm = () => {
        setMacAddress(''); setAlias(''); setDeviceType('NODE'); setOperatingMode('FIXED'); setFieldId('none');
    };

    const handleCreate = () => {
        if (!macAddress.trim()) return;
        createMutation.mutate({
            macAddress,
            alias: alias || undefined,
            deviceType,
            operatingMode,
            fieldId: fieldId === 'none' ? null : fieldId,
        });
    };

    const handleReassign = () => {
        if (!selectedDevice) return;
        updateMutation.mutate({
            id: selectedDevice.id,
            data: { fieldId: fieldId === 'none' ? null : fieldId }
        });
    };

    const handleDelete = () => {
        if (!selectedDevice) return;
        deleteMutation.mutate(selectedDevice.id);
    };


    return (
        <div className="space-y-6 max-w-6xl mx-auto animate-fade-in">

            {/* ── Page Header ── */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold flex items-center gap-2.5" style={{ color: 'var(--foreground)' }}>
                        <Settings className="w-6 h-6" style={{ color: 'var(--primary)' }} />
                        Device Config
                    </h2>
                    <p className="text-sm mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                        Manage hardware inventory, provision new sensors, and reassign fields
                    </p>
                </div>
                <Button onClick={() => { resetForm(); setIsCreateModalOpen(true); }} className="gap-2">
                    <Plus className="w-4 h-4" />
                    Register New Device
                </Button>
            </div>

            {/* ── Hardware Inventory Table ── */}
            <div className="rounded-2xl overflow-hidden shadow-card" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                <div className="px-6 py-4 border-b flex items-center gap-2" style={{ background: 'var(--muted)' }}>
                    <Server className="w-4 h-4 text-primary" />
                    <h3 className="font-semibold text-sm">Hardware Inventory</h3>
                </div>

                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-muted/30">
                                <TableHead className="w-[200px]">Device & Alias</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>MAC Address</TableHead>
                                <TableHead>Assigned Field</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Battery / LoRa</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {devicesLoading ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="h-32 text-center">
                                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
                                        <p className="text-sm text-muted-foreground">Loading devices...</p>
                                    </TableCell>
                                </TableRow>
                            ) : devices?.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                                        No devices registered yet.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                devices?.map((device) => {
                                    const battWarn = device.batteryStatus !== undefined && device.batteryStatus < 20;
                                    return (
                                        <TableRow key={device.id}>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <DeviceIcon type={device.deviceType} mode={device.operatingMode} />
                                                    <div className="font-semibold text-sm">
                                                        {device.alias || 'Unnamed Device'}
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="text-[10px] tracking-wider uppercase bg-muted/50">
                                                    {device.operatingMode === 'PORTABLE' ? 'PORTABLE NODE' : device.deviceType}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="font-mono text-xs text-muted-foreground">
                                                {device.macAddress}
                                            </TableCell>
                                            <TableCell>
                                                {device.field ? (
                                                    <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20">
                                                        {device.field.name}
                                                    </Badge>
                                                ) : (
                                                    <span className="text-xs text-muted-foreground italic">Unassigned</span>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {device.isOnline ? (
                                                    <Badge className="bg-green-100 text-green-700 border-green-200 hover:bg-green-100 shadow-none">Online</Badge>
                                                ) : (
                                                    <Badge variant="destructive" className="shadow-none">Offline</Badge>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col gap-0.5 text-[11px] text-muted-foreground">
                                                    {device.batteryStatus !== undefined ? (
                                                        <span className={battWarn ? 'text-red-500 font-bold' : ''}>
                                                            🔋 {device.batteryStatus}% {battWarn && '⚠️'}
                                                        </span>
                                                    ) : <span>🔋 —</span>}
                                                    {device.loraSignalStrength !== undefined ? (
                                                        <span>📶 {device.loraSignalStrength} dBm</span>
                                                    ) : <span>📶 —</span>}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <Button
                                                        variant="ghost" size="icon" className="h-8 w-8 hover:text-blue-500 hover:bg-blue-50"
                                                        onClick={() => {
                                                            setSelectedDevice(device);
                                                            setFieldId(device.field?.id || 'none');
                                                            setIsReassignModalOpen(true);
                                                        }}
                                                        title="Reassign Field"
                                                    >
                                                        <ArrowRightLeft className="w-4 h-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost" size="icon" className="h-8 w-8 hover:text-red-500 hover:bg-red-50"
                                                        onClick={() => { setSelectedDevice(device); setIsDeleteModalOpen(true); }}
                                                        title="Delete Device"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>

            {/* ── Modals ── */}
            {/* 1. Register Modal */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-[hsl(152,14%,12%)] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden border">
                        <div className="px-6 py-4 border-b flex items-center gap-2">
                            <Radio className="w-5 h-5 text-primary" />
                            <h3 className="font-bold text-lg">Register New Device</h3>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">MAC Address (Required)</label>
                                <Input placeholder="AA:BB:CC:DD:EE:FF" value={macAddress} onChange={e => setMacAddress(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Alias Name (Optional)</label>
                                <Input placeholder="e.g. Pump Node 3" value={alias} onChange={e => setAlias(e.target.value)} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Device Type</label>
                                    <Select value={deviceType} onValueChange={setDeviceType}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="NODE">Sensor Node</SelectItem>
                                            <SelectItem value="HUB">Central Hub</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Operating Mode</label>
                                    <Select value={operatingMode} onValueChange={setOperatingMode}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="FIXED">Fixed (In-ground)</SelectItem>
                                            <SelectItem value="PORTABLE">Portable (Handheld)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Assign to Field</label>
                                <Select value={fieldId} onValueChange={setFieldId}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">-- Do not assign yet --</SelectItem>
                                        {fields?.map(f => (
                                            <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="px-6 py-4 bg-muted/50 border-t flex justify-end gap-3">
                            <Button variant="outline" onClick={() => setIsCreateModalOpen(false)}>Cancel</Button>
                            <Button onClick={handleCreate} disabled={!macAddress.trim() || createMutation.isPending}>
                                {createMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                                Register Device
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* 2. Reassign Modal */}
            {isReassignModalOpen && selectedDevice && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-[hsl(152,14%,12%)] rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden border">
                        <div className="px-6 py-4 border-b flex items-center gap-2">
                            <ArrowRightLeft className="w-5 h-5 text-blue-500" />
                            <h3 className="font-bold text-lg">Reassign Device</h3>
                        </div>
                        <div className="p-6 space-y-4">
                            <p className="text-sm text-muted-foreground">
                                Select a new field for <span className="font-bold text-foreground">{selectedDevice.alias || selectedDevice.macAddress}</span>.
                            </p>
                            <Select value={fieldId} onValueChange={setFieldId}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">-- Unassign Field --</SelectItem>
                                    {fields?.map(f => (
                                        <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="px-6 py-4 bg-muted/50 border-t flex justify-end gap-3">
                            <Button variant="outline" onClick={() => setIsReassignModalOpen(false)}>Cancel</Button>
                            <Button onClick={handleReassign} disabled={updateMutation.isPending}>
                                {updateMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                                Save Changes
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* 3. Delete Modal */}
            {isDeleteModalOpen && selectedDevice && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-[hsl(152,14%,12%)] rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden border border-red-200">
                        <div className="px-6 py-5 text-center">
                            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <ShieldAlert className="w-6 h-6 text-red-600" />
                            </div>
                            <h3 className="font-bold text-lg mb-2">Decommission Device</h3>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                Are you sure you want to remove <span className="font-bold text-foreground">{selectedDevice.alias || selectedDevice.macAddress}</span> from the platform? This will stop all telemetry logging for this device.
                            </p>
                        </div>
                        <div className="px-6 py-4 bg-red-50/50 border-t border-red-100 flex flex-col gap-2">
                            <Button variant="destructive" className="w-full" onClick={handleDelete} disabled={deleteMutation.isPending}>
                                {deleteMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                                Yes, Decommission Device
                            </Button>
                            <Button variant="outline" className="w-full" onClick={() => setIsDeleteModalOpen(false)}>
                                Cancel
                            </Button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}

"use client";

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useFarmStore } from '@/store/useFarmStore';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Map as MapIcon, Loader2 } from 'lucide-react';

const API_BASE = 'http://localhost:3001/api/v1';

interface Field {
    id: string;
    name: string;
}

interface SensorNode {
    id: string;
    field: Field | null;
}

export default function FieldSelector() {
    const { activeFieldId, setActiveField } = useFarmStore();

    // Dynamically fetch all fields via sensor-nodes (same pattern as the dashboard)
    const { data: sensorNodes, isLoading } = useQuery<SensorNode[]>({
        queryKey: ['sensor-nodes'],
        queryFn: async () => {
            const res = await axios.get(`${API_BASE}/devices/sensor-nodes`);
            return res.data;
        },
        staleTime: 60_000,
    });

    // Auto-select the first field once sensorNodes loads (stable React Query reference)
    // NOTE: We depend on `sensorNodes`, NOT on a derived `fields` array —
    // a derived array is a new object every render and would cause an infinite loop.
    useEffect(() => {
        if (!sensorNodes || activeFieldId) return;
        const first = sensorNodes.find((n) => n.field !== null)?.field;
        if (first) setActiveField(first.id, first.name);
    }, [sensorNodes, activeFieldId, setActiveField]);

    // Deduplicate to get unique fields (used only for rendering the dropdown)
    const fields: Field[] = sensorNodes
        ? Array.from(
            new Map(
                sensorNodes
                    .filter((n) => n.field !== null)
                    .map((n) => [n.field!.id, n.field!])
            ).values()
        )
        : [];

    if (isLoading) {
        return (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading fields…
            </div>
        );
    }

    return (
        <div className="flex items-center space-x-2">
            <MapIcon className="w-5 h-5 text-primary" />
            <Select
                value={activeFieldId || ''}
                onValueChange={(value) => {
                    const field = fields.find((f) => f.id === value);
                    if (field) setActiveField(field.id, field.name);
                }}
            >
                <SelectTrigger className="w-[220px] h-10 border-primary/20 bg-primary/5 font-semibold text-foreground">
                    <SelectValue placeholder="Select a field" />
                </SelectTrigger>
                <SelectContent>
                    {fields.map((field) => (
                        <SelectItem key={field.id} value={field.id}>
                            {field.name}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}
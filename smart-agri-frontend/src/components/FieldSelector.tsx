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
import { Loader2, ChevronDown, MapPin } from 'lucide-react';

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

  const { data: sensorNodes, isLoading } = useQuery<SensorNode[]>({
    queryKey: ['sensor-nodes'],
    queryFn: async () => {
      const res = await axios.get(`${API_BASE}/devices/sensor-nodes`);
      return res.data;
    },
    staleTime: 60_000,
  });

  // Auto-select first field
  useEffect(() => {
    if (!sensorNodes || activeFieldId) return;
    const first = sensorNodes.find((n) => n.field !== null)?.field;
    if (first) setActiveField(first.id, first.name);
  }, [sensorNodes, activeFieldId, setActiveField]);

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
      <div
        className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm"
        style={{
          background: 'hsl(142, 40%, 95%)',
          border: '1px solid hsl(142, 40%, 86%)',
          color: 'var(--muted-foreground)',
        }}
      >
        <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: 'var(--primary)' }} />
        <span>Loading fields…</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1.5">
        <MapPin className="w-3.5 h-3.5" style={{ color: 'var(--primary)' }} />
        <span className="text-xs font-semibold hidden sm:block" style={{ color: 'var(--muted-foreground)' }}>
          Active Field:
        </span>
      </div>
      <Select
        value={activeFieldId || ''}
        onValueChange={(value) => {
          const field = fields.find((f) => f.id === value);
          if (field) setActiveField(field.id, field.name);
        }}
      >
        <SelectTrigger
          className="h-9 text-sm font-semibold rounded-xl"
          style={{
            width: '180px',
            background: 'hsl(142, 40%, 95%)',
            border: '1px solid hsl(142, 40%, 85%)',
            color: 'hsl(142, 65%, 22%)',
            boxShadow: 'none',
          }}
        >
          <SelectValue placeholder="Select field" />
        </SelectTrigger>
        <SelectContent
          className="rounded-xl overflow-hidden"
          style={{
            background: 'var(--card)',
            border: '1px solid var(--border)',
            boxShadow: 'var(--shadow-hover)',
          }}
        >
          {fields.map((field) => (
            <SelectItem
              key={field.id}
              value={field.id}
              className="text-sm font-medium rounded-lg cursor-pointer"
            >
              {field.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
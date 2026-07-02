"use client";

import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import AiInsightCard from '@/components/AiInsightCard';
import { LayoutDashboard, Loader2, AlertCircle } from 'lucide-react';

const API_BASE = 'http://localhost:3001/api/v1';

interface SensorNode {
  id: string;
  field: { id: string; name: string } | null;
}

export default function Dashboard() {
  // Dynamically resolve fields by fetching fixed sensor nodes (which include their field relation)
  const { data: sensorNodes, isLoading, isError } = useQuery<SensorNode[]>({
    queryKey: ['sensor-nodes'],
    queryFn: async () => {
      const res = await axios.get(`${API_BASE}/devices/sensor-nodes`);
      return res.data;
    },
    staleTime: 60_000, // cache for 1 minute
  });

  // Deduplicate: one card per unique field that actually has a sensor node
  const fields = sensorNodes
    ? Array.from(
        new Map(
          sensorNodes
            .filter((n) => n.field !== null)
            .map((n) => [n.field!.id, n.field!])
        ).values()
      )
    : [];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight flex items-center">
          <LayoutDashboard className="w-6 h-6 mr-2 text-primary" />
          Farm Overview
        </h2>
        <p className="text-muted-foreground">AI-driven insights and health metrics across all fields.</p>
      </div>

      {/* The Field Comparison Matrix (AI Cards) */}
      <div>
        <h3 className="text-lg font-semibold mb-4 text-foreground">Autonomous Agronomist Insights</h3>

        {isLoading && (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            Discovering fields…
          </div>
        )}

        {isError && (
          <div className="flex items-center gap-2 text-destructive text-sm">
            <AlertCircle className="w-4 h-4" />
            Failed to load fields from backend.
          </div>
        )}

        {!isLoading && !isError && fields.length === 0 && (
          <p className="text-sm text-muted-foreground">No fields with sensor nodes found.</p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {fields.map((field) => (
            <AiInsightCard key={field.id} fieldId={field.id} fieldName={field.name} />
          ))}
        </div>
      </div>

      {/* Here you could keep your old charts below the AI insights! */}
      <div className="mt-8 border-t border-border pt-8">
        <h3 className="text-lg font-semibold mb-4 text-foreground">System Analytics</h3>
        <p className="text-sm text-muted-foreground">Historical charts can go here...</p>
        {/* You can paste your old Recharts <LineChart> code back in here later! */}
      </div>
    </div>
  );
}
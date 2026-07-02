"use client";

import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useFarmStore } from '@/store/useFarmStore';
import AiInsightCard from '@/components/AiInsightCard';
import { LayoutDashboard, Activity } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent } from '@/components/ui/card';

const API_BASE = 'http://localhost:3001/api/v1';

interface SensorNode {
  id: string;
  field: { id: string; name: string } | null;
}

export default function Dashboard() {
  const { activeFieldId, activeFieldName } = useFarmStore();

  // Fetch all fields dynamically via sensor-nodes
  const { data: sensorNodes } = useQuery<SensorNode[]>({
    queryKey: ['sensor-nodes'],
    queryFn: async () => {
      const res = await axios.get(`${API_BASE}/devices/sensor-nodes`);
      return res.data;
    },
    staleTime: 60_000,
  });

  // Deduplicate: one AI card per unique field that has a sensor node
  const fields = sensorNodes
    ? Array.from(
        new Map(
          sensorNodes
            .filter((n) => n.field !== null)
            .map((n) => [n.field!.id, n.field!])
        ).values()
      )
    : [];

  // Fetch telemetry chart data for the currently selected field
  const { data: chartData, isLoading } = useQuery({
    queryKey: ['fieldTelemetry', activeFieldId],
    queryFn: async () => {
      const res = await axios.get(`${API_BASE}/telemetry/field-history/${activeFieldId}`);
      return res.data;
    },
    enabled: !!activeFieldId,
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight flex items-center">
          <LayoutDashboard className="w-6 h-6 mr-2 text-primary" />
          Farm Overview
        </h2>
        <p className="text-muted-foreground">AI-driven insights and health metrics across all fields.</p>
      </div>

      {/* TOP SECTION: The AI Executive Summary */}
      <div>
        <h3 className="text-lg font-semibold mb-4 text-foreground">Autonomous Agronomist Insights</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {fields.map((field) => (
            <AiInsightCard key={field.id} fieldId={field.id} fieldName={field.name} />
          ))}
        </div>
      </div>

      {/* BOTTOM SECTION: The Interactive Data Proof */}
      <div className="mt-8 border-t border-border pt-8">
        <h3 className="text-lg font-semibold mb-4 flex items-center text-foreground">
          <Activity className="w-5 h-5 mr-2 text-primary" />
          System Analytics: {activeFieldName}
        </h3>

        <Card className="border-2 border-primary/10">
          <CardContent className="h-[400px] w-full p-6">
            {isLoading ? (
              <div className="h-full w-full flex items-center justify-center animate-pulse text-muted-foreground">
                Loading telemetry data...
              </div>
            ) : chartData && chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="time"
                    tickFormatter={(time) => new Date(time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                  />
                  <YAxis yAxisId="left" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis yAxisId="right" orientation="right" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                    labelFormatter={(label) => new Date(label).toLocaleString()}
                  />

                  {/* Moisture Line */}
                  <Line yAxisId="left" type="monotone" dataKey="moisture" stroke="#3b82f6" strokeWidth={3} dot={false} name="Moisture (%)" />
                  {/* Temperature Line */}
                  <Line yAxisId="right" type="monotone" dataKey="temperature" stroke="#f97316" strokeWidth={2} dot={false} name="Temp (°C)" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              // This is what you will see for the Chillies!
              <div className="h-full w-full flex flex-col items-center justify-center text-muted-foreground">
                <Activity className="w-12 h-12 mb-2 opacity-20" />
                <p>No sensor nodes installed in this field yet.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
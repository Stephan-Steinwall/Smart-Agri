"use client";

import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useFarmStore } from '@/store/useFarmStore';
import AiInsightCard from '@/components/AiInsightCard';
import {
  Activity, Droplets, Thermometer, Sprout,
  BrainCircuit, BarChart2, CloudSun
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from 'recharts';

const API_BASE = 'http://localhost:3001/api/v1';

interface SensorNode {
  id: string;
  field: { id: string; name: string } | null;
}

// ── Stat mini-card ─────────────────────────────────────────────────────────
function StatCard({
  icon: Icon, label, value, unit, color, bgColor
}: {
  icon: React.ElementType; label: string; value: string | number;
  unit?: string; color: string; bgColor: string;
}) {
  return (
    <div
      className="rounded-2xl p-4 flex items-center gap-4 card-lift animate-fade-in"
      style={{ background: 'var(--card)', boxShadow: 'var(--shadow-card)', border: '1px solid var(--border)' }}
    >
      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: bgColor }}
      >
        <Icon className="w-5 h-5" style={{ color }} />
      </div>
      <div>
        <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--muted-foreground)' }}>{label}</p>
        <p className="text-lg font-bold mt-0.5" style={{ color: 'var(--foreground)' }}>
          {value}<span className="text-sm font-medium ml-0.5" style={{ color: 'var(--muted-foreground)' }}>{unit}</span>
        </p>
      </div>
    </div>
  );
}

// ── Custom recharts tooltip ────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-xl px-4 py-3 text-sm"
      style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-hover)',
      }}
    >
      <p className="font-semibold mb-2" style={{ color: 'var(--foreground)' }}>
        {new Date(label).toLocaleString()}
      </p>
      {payload.map((entry: any) => (
        <div key={entry.dataKey} className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: entry.color }} />
          <span style={{ color: 'var(--muted-foreground)' }}>{entry.name}:</span>
          <span className="font-bold" style={{ color: 'var(--foreground)' }}>{entry.value?.toFixed(1)}</span>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { activeFieldId, activeFieldName } = useFarmStore();

  // Fetch all fields via sensor-nodes
  const { data: sensorNodes } = useQuery<SensorNode[]>({
    queryKey: ['sensor-nodes'],
    queryFn: async () => {
      const res = await axios.get(`${API_BASE}/devices/sensor-nodes`);
      return res.data;
    },
    staleTime: 60_000,
  });

  // Deduplicate to one card per unique field
  const fields = sensorNodes
    ? Array.from(
        new Map(
          sensorNodes
            .filter((n) => n.field !== null)
            .map((n) => [n.field!.id, n.field!])
        ).values()
      )
    : [];

  // Telemetry chart for selected field
  const { data: chartData, isLoading: chartLoading } = useQuery({
    queryKey: ['fieldTelemetry', activeFieldId],
    queryFn: async () => {
      const res = await axios.get(`${API_BASE}/telemetry/field-history/${activeFieldId}`);
      return res.data;
    },
    enabled: !!activeFieldId,
  });

  // Latest readings for stat cards
  const latestReading = chartData?.[chartData.length - 1];

  // Greeting
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="space-y-8 animate-fade-in">

      {/* ── Hero Banner ─────────────────────────────────────────────────── */}
      <div
        className="rounded-2xl p-6 md:p-8 text-white relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, hsl(142, 58%, 22%) 0%, hsl(162, 50%, 28%) 55%, hsl(200, 45%, 28%) 100%)' }}
      >
        {/* Decorative circle */}
        <div
          className="absolute -right-12 -top-12 w-48 h-48 rounded-full opacity-10"
          style={{ background: 'white' }}
        />
        <div
          className="absolute -right-4 bottom-4 w-24 h-24 rounded-full opacity-5"
          style={{ background: 'white' }}
        />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <CloudSun className="w-4 h-4 opacity-75" />
              <span className="text-sm opacity-75 font-medium">{greeting}, Farmer 🌱</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-bold">Farm Overview</h2>
            <p className="text-sm opacity-70 mt-1">
              AI-driven insights and health metrics across{' '}
              <span className="font-semibold opacity-90">{fields.length} field{fields.length !== 1 ? 's' : ''}</span>
            </p>
          </div>

          {/* Date & live indicator */}
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2 text-sm opacity-80">
              <span className="w-2 h-2 rounded-full bg-green-300 animate-pulse" />
              <span>Live Monitoring</span>
            </div>
            <p className="text-sm opacity-60">
              {new Date().toLocaleDateString('en-IN', {
                weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
              })}
            </p>
          </div>
        </div>
      </div>

      {/* ── Stat Cards Row ───────────────────────────────────────────────── */}
      {latestReading && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            icon={Droplets}
            label="Soil Moisture"
            value={latestReading.moisture?.toFixed(1) ?? '—'}
            unit="%"
            color="hsl(210, 68%, 48%)"
            bgColor="hsl(210, 68%, 95%)"
          />
          <StatCard
            icon={Thermometer}
            label="Temperature"
            value={latestReading.temperature?.toFixed(1) ?? '—'}
            unit="°C"
            color="hsl(20, 80%, 52%)"
            bgColor="hsl(20, 80%, 95%)"
          />
          <StatCard
            icon={Sprout}
            label="Fields Active"
            value={fields.length}
            color="hsl(142, 65%, 30%)"
            bgColor="hsl(142, 65%, 94%)"
          />
          <StatCard
            icon={BrainCircuit}
            label="AI Analyses"
            value={fields.length}
            unit=" today"
            color="hsl(280, 60%, 52%)"
            bgColor="hsl(280, 60%, 95%)"
          />
        </div>
      )}

      {/* ── AI Insight Cards ─────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-3 mb-5">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: 'hsl(142, 65%, 94%)' }}
          >
            <BrainCircuit className="w-4 h-4" style={{ color: 'var(--primary)' }} />
          </div>
          <div>
            <h3 className="font-bold text-base" style={{ color: 'var(--foreground)' }}>
              Autonomous Agronomist Insights
            </h3>
            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              AI-generated soil health analysis updated every 5 minutes
            </p>
          </div>
        </div>

        {fields.length === 0 ? (
          <div
            className="rounded-2xl p-12 text-center"
            style={{ background: 'var(--card)', border: '1px dashed var(--border)', boxShadow: 'var(--shadow-card)' }}
          >
            <Sprout className="w-10 h-10 mx-auto mb-3 opacity-25" style={{ color: 'var(--primary)' }} />
            <p className="font-semibold" style={{ color: 'var(--foreground)' }}>No fields with sensors found</p>
            <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
              Add sensor nodes to your fields to get AI-powered insights.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {fields.map((field) => (
              <AiInsightCard key={field.id} fieldId={field.id} fieldName={field.name} />
            ))}
          </div>
        )}
      </section>

      {/* ── Analytics Chart ──────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-3 mb-5">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: 'hsl(210, 68%, 95%)' }}
          >
            <BarChart2 className="w-4 h-4" style={{ color: 'hsl(210, 68%, 48%)' }} />
          </div>
          <div>
            <h3 className="font-bold text-base" style={{ color: 'var(--foreground)' }}>
              Sensor Analytics
              {activeFieldName && (
                <span className="ml-2 text-sm font-normal" style={{ color: 'var(--muted-foreground)' }}>
                  — {activeFieldName}
                </span>
              )}
            </h3>
            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              Real-time moisture and temperature from field sensors
            </p>
          </div>
        </div>

        <div
          className="rounded-2xl p-6 animate-fade-in"
          style={{ background: 'var(--card)', boxShadow: 'var(--shadow-card)', border: '1px solid var(--border)' }}
        >
          {chartLoading ? (
            <div className="h-72 flex flex-col items-center justify-center gap-3">
              <div className="flex gap-1.5">
                <span className="thinking-dot" />
                <span className="thinking-dot" />
                <span className="thinking-dot" />
              </div>
              <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Loading sensor data...</p>
            </div>
          ) : chartData && chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData} margin={{ top: 5, right: 8, bottom: 5, left: 0 }}>
                <CartesianGrid
                  strokeDasharray="4 4"
                  vertical={false}
                  stroke="hsl(120, 14%, 92%)"
                />
                <XAxis
                  dataKey="time"
                  tickFormatter={(t) =>
                    new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  }
                  stroke="transparent"
                  tick={{ fill: 'hsl(140, 10%, 50%)', fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  yAxisId="left"
                  stroke="transparent"
                  tick={{ fill: 'hsl(140, 10%, 50%)', fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={36}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  stroke="transparent"
                  tick={{ fill: 'hsl(140, 10%, 50%)', fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={36}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: '12px', paddingTop: '16px', color: 'hsl(140,10%,42%)' }}
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="moisture"
                  stroke="hsl(210, 68%, 48%)"
                  strokeWidth={2.5}
                  dot={false}
                  name="Moisture (%)"
                  activeDot={{ r: 5, strokeWidth: 0 }}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="temperature"
                  stroke="hsl(20, 80%, 52%)"
                  strokeWidth={2}
                  dot={false}
                  name="Temp (°C)"
                  activeDot={{ r: 5, strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-72 flex flex-col items-center justify-center gap-3">
              <Activity className="w-10 h-10 opacity-15" style={{ color: 'var(--foreground)' }} />
              <p className="font-medium" style={{ color: 'var(--foreground)' }}>No sensor data yet</p>
              <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                {activeFieldId
                  ? 'No sensor nodes are installed in this field yet.'
                  : 'Select a field above to see its sensor analytics.'}
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
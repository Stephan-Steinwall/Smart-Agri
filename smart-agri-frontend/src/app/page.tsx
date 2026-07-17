// src/app/page.tsx
"use client";

import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import AiInsightCard from '@/components/AiInsightCard';
import {
  Activity, Droplets, Thermometer, Sprout,
  BrainCircuit, BarChart2, CloudSun, Beaker, Zap, Leaf, FlaskConical, Target
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from 'recharts';

const API_BASE = 'http://localhost:3001/api/v1';
const DEVICE_ID = 'agribot_receiver_01';
const DEVICE_NAME = 'Main Field Node';

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
      className="rounded-xl px-4 py-3 text-sm z-50"
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
          <span className="font-bold" style={{ color: 'var(--foreground)' }}>
            {entry.value != null ? entry.value.toFixed(1) : 'N/A'}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function Dashboard() {
  // Telemetry chart for the specific device
  const { data: chartData, isLoading: chartLoading } = useQuery({
    queryKey: ['fieldTelemetry', DEVICE_ID],
    queryFn: async () => {
      const res = await axios.get(`${API_BASE}/telemetry/history/${DEVICE_ID}`);
      return res.data;
    },
    refetchInterval: 60000, // Refresh every minute
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
              AI-driven insights and health metrics for{' '}
              <span className="font-semibold opacity-90">{DEVICE_NAME}</span>
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

      {/* ── Overview Stats Grid ───────────────────────────────────────────── */}
      {latestReading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            icon={Droplets} label="Soil Moisture"
            value={latestReading.moisture?.toFixed(1) ?? '—'} unit="%"
            color="hsl(210, 68%, 48%)" bgColor="hsl(210, 68%, 95%)"
          />
          <StatCard
            icon={Thermometer} label="Temperature"
            value={latestReading.temperature?.toFixed(1) ?? '—'} unit="°C"
            color="hsl(20, 80%, 52%)" bgColor="hsl(20, 80%, 95%)"
          />
          <StatCard
            icon={Beaker} label="Soil pH"
            value={latestReading.ph?.toFixed(1) ?? '—'} unit=""
            color="hsl(280, 60%, 52%)" bgColor="hsl(280, 60%, 95%)"
          />
          <StatCard
            icon={Zap} label="Electrical Cond."
            value={latestReading.electricalConductivity?.toFixed(2) ?? '—'} unit="dS/m"
            color="hsl(45, 90%, 45%)" bgColor="hsl(45, 90%, 94%)"
          />
          <StatCard
            icon={Leaf} label="Nitrogen (N)"
            value={latestReading.nitrogen?.toFixed(0) ?? '—'} unit="mg/kg"
            color="hsl(142, 65%, 40%)" bgColor="hsl(142, 65%, 94%)"
          />
          <StatCard
            icon={Sprout} label="Phosphorus (P)"
            value={latestReading.phosphorus?.toFixed(0) ?? '—'} unit="mg/kg"
            color="hsl(330, 65%, 50%)" bgColor="hsl(330, 65%, 95%)"
          />
          <StatCard
            icon={FlaskConical} label="Potassium (K)"
            value={latestReading.potassium?.toFixed(0) ?? '—'} unit="mg/kg"
            color="hsl(190, 80%, 40%)" bgColor="hsl(190, 80%, 94%)"
          />
          <StatCard
            icon={Target} label="Latest Reading"
            value={new Date(latestReading.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} unit=""
            color="hsl(220, 20%, 40%)" bgColor="hsl(220, 20%, 95%)"
          />
        </div>
      ) : (
        <div className="h-32 rounded-2xl flex items-center justify-center" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Waiting for sensor data...</p>
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

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          <AiInsightCard deviceId={DEVICE_ID} fieldName={DEVICE_NAME} />
        </div>
      </section>

      {/* ── Comprehensive Analytics ──────────────────────────────────────── */}
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
              Detailed Sensor Analytics
            </h3>
            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              Real-time monitoring across multiple soil parameters
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          
          {/* NPK Chart */}
          <div className="rounded-2xl p-6 animate-fade-in card-lift" style={{ background: 'var(--card)', boxShadow: 'var(--shadow-card)', border: '1px solid var(--border)' }}>
            <h4 className="font-bold text-sm mb-4" style={{ color: 'var(--foreground)' }}>Macronutrients (NPK)</h4>
            {chartLoading ? (
              <div className="h-64 flex items-center justify-center"><span className="thinking-dot" /><span className="thinking-dot" /><span className="thinking-dot" /></div>
            ) : chartData && chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={chartData} margin={{ top: 5, right: 0, bottom: 5, left: -20 }}>
                  <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="hsl(120, 14%, 92%)" />
                  <XAxis dataKey="time" tickFormatter={(t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} stroke="transparent" tick={{ fill: 'hsl(140, 10%, 50%)', fontSize: 11 }} />
                  <YAxis stroke="transparent" tick={{ fill: 'hsl(140, 10%, 50%)', fontSize: 11 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                  <Line type="monotone" dataKey="nitrogen" name="Nitrogen" stroke="hsl(142, 65%, 40%)" strokeWidth={2.5} dot={false} activeDot={{ r: 5, strokeWidth: 0 }} />
                  <Line type="monotone" dataKey="phosphorus" name="Phosphorus" stroke="hsl(330, 65%, 50%)" strokeWidth={2.5} dot={false} activeDot={{ r: 5, strokeWidth: 0 }} />
                  <Line type="monotone" dataKey="potassium" name="Potassium" stroke="hsl(190, 80%, 40%)" strokeWidth={2.5} dot={false} activeDot={{ r: 5, strokeWidth: 0 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex flex-col items-center justify-center opacity-50"><Activity className="w-8 h-8 mb-2" /><p className="text-sm">No data</p></div>
            )}
          </div>

          {/* Moisture & Temp Chart */}
          <div className="rounded-2xl p-6 animate-fade-in card-lift" style={{ background: 'var(--card)', boxShadow: 'var(--shadow-card)', border: '1px solid var(--border)' }}>
            <h4 className="font-bold text-sm mb-4" style={{ color: 'var(--foreground)' }}>Environment (Moisture & Temp)</h4>
            {chartLoading ? (
              <div className="h-64 flex items-center justify-center"><span className="thinking-dot" /><span className="thinking-dot" /><span className="thinking-dot" /></div>
            ) : chartData && chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={chartData} margin={{ top: 5, right: 0, bottom: 5, left: -20 }}>
                  <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="hsl(120, 14%, 92%)" />
                  <XAxis dataKey="time" tickFormatter={(t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} stroke="transparent" tick={{ fill: 'hsl(140, 10%, 50%)', fontSize: 11 }} />
                  <YAxis yAxisId="left" stroke="transparent" tick={{ fill: 'hsl(140, 10%, 50%)', fontSize: 11 }} />
                  <YAxis yAxisId="right" orientation="right" stroke="transparent" tick={{ fill: 'hsl(140, 10%, 50%)', fontSize: 11 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                  <Line yAxisId="left" type="monotone" dataKey="moisture" name="Moisture (%)" stroke="hsl(210, 68%, 48%)" strokeWidth={2.5} dot={false} activeDot={{ r: 5, strokeWidth: 0 }} />
                  <Line yAxisId="right" type="monotone" dataKey="temperature" name="Temp (°C)" stroke="hsl(20, 80%, 52%)" strokeWidth={2.5} dot={false} activeDot={{ r: 5, strokeWidth: 0 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex flex-col items-center justify-center opacity-50"><Activity className="w-8 h-8 mb-2" /><p className="text-sm">No data</p></div>
            )}
          </div>

          {/* pH & EC Chart */}
          <div className="rounded-2xl p-6 animate-fade-in card-lift xl:col-span-2" style={{ background: 'var(--card)', boxShadow: 'var(--shadow-card)', border: '1px solid var(--border)' }}>
            <h4 className="font-bold text-sm mb-4" style={{ color: 'var(--foreground)' }}>Soil Chemistry (pH & EC)</h4>
            {chartLoading ? (
              <div className="h-64 flex items-center justify-center"><span className="thinking-dot" /><span className="thinking-dot" /><span className="thinking-dot" /></div>
            ) : chartData && chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={chartData} margin={{ top: 5, right: 0, bottom: 5, left: -20 }}>
                  <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="hsl(120, 14%, 92%)" />
                  <XAxis dataKey="time" tickFormatter={(t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} stroke="transparent" tick={{ fill: 'hsl(140, 10%, 50%)', fontSize: 11 }} />
                  <YAxis yAxisId="left" domain={[4, 9]} stroke="transparent" tick={{ fill: 'hsl(140, 10%, 50%)', fontSize: 11 }} />
                  <YAxis yAxisId="right" orientation="right" stroke="transparent" tick={{ fill: 'hsl(140, 10%, 50%)', fontSize: 11 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                  <Line yAxisId="left" type="monotone" dataKey="ph" name="pH Level" stroke="hsl(280, 60%, 52%)" strokeWidth={2.5} dot={false} activeDot={{ r: 5, strokeWidth: 0 }} />
                  <Line yAxisId="right" type="monotone" dataKey="electricalConductivity" name="EC (dS/m)" stroke="hsl(45, 90%, 45%)" strokeWidth={2.5} dot={false} activeDot={{ r: 5, strokeWidth: 0 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex flex-col items-center justify-center opacity-50"><Activity className="w-8 h-8 mb-2" /><p className="text-sm">No data</p></div>
            )}
          </div>

        </div>
      </section>
    </div>
  );
}
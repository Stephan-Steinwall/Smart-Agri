// src/app/page.tsx
"use client";

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import {
  Activity, Droplets, Thermometer, Sprout,
  BrainCircuit, BarChart2, CloudSun, Beaker, Zap, Leaf, FlaskConical, Target,
  Wind, CloudRain, Sun, Gauge, Cloud, ShieldAlert, Umbrella, Power, ChevronRight
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import WeatherWidget from '@/components/WeatherWidget';

const API_BASE = 'http://localhost:3001/api/v1';
const DEVICE_ID = 'agribot_receiver_01';
const DEVICE_NAME = 'Main Field Node';

// ── Mock Test Data ──────────────────────────────────────────────────────────
// (WEATHER_STATION_DATA mock removed, using live DB instead)

// ── Mock Test Data ──────────────────────────────────────────────────────────
const TEST_DATA = Array.from({ length: 24 }).map((_, i) => {
  const time = new Date();
  time.setHours(time.getHours() - (23 - i));
  return {
    time: time.toISOString(),
    moisture: 45 + Math.sin(i / 2) * 10 + Math.random() * 5,
    temperature: 22 + Math.cos(i / 3) * 5 + Math.random() * 2,
    ph: 6.5 + Math.random() * 0.4,
    electricalConductivity: 1.2 + Math.random() * 0.3,
    nitrogen: 40 + Math.random() * 10,
    phosphorus: 25 + Math.random() * 5,
    potassium: 35 + Math.random() * 8,
  };
});

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

// ── Pump Control Card ─────────────────────────────────────────────────────────
function PumpControl({
  label, icon: Icon, isActive, onClick, color
}: {
  label: string; icon: React.ElementType; isActive: boolean; onClick: () => void; color: string;
}) {
  return (
    <div 
      className={`rounded-2xl p-4 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all border-2 ${
        isActive ? 'scale-[1.02]' : 'hover:bg-muted/50'
      }`}
      style={isActive ? { background: 'var(--card)', boxShadow: 'var(--shadow-card)', borderColor: color } : { borderColor: 'var(--border)', background: 'transparent' }}
      onClick={onClick}
    >
      <div 
        className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
          isActive ? 'shadow-sm' : ''
        }`}
        style={{ 
          background: isActive ? color : 'var(--muted)',
          color: isActive ? 'white' : 'var(--muted-foreground)'
        }}
      >
        <Icon className="w-6 h-6" />
      </div>
      <div className="text-center">
        <p className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>{label}</p>
        <p className="text-xs font-bold mt-1 uppercase tracking-wider" style={{ color: isActive ? color : 'var(--muted-foreground)' }}>
          {isActive ? 'PUMPING...' : 'OFF'}
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [isSystemOn, setIsSystemOn] = useState(true);
  const [pumps, setPumps] = useState({
    water: false,
    nitrogen: false,
    potassium: false,
    phosphorus: false
  });

  // Telemetry chart for the specific device
  const { data: chartData, isLoading: chartLoading } = useQuery({
    queryKey: ['fieldTelemetry', DEVICE_ID],
    queryFn: async () => {
      try {
        const res = await axios.get(`${API_BASE}/telemetry/history/${DEVICE_ID}`);
        return res.data && res.data.length > 0 ? res.data : TEST_DATA;
      } catch (error) {
        console.warn("Failed to fetch sensor data, using test data.", error);
        return TEST_DATA;
      }
    },
    refetchInterval: 60000, // Refresh every minute
  });

  // Local Microclimate environment data
  const { data: envData } = useQuery({
    queryKey: ['environmentLatest', DEVICE_ID],
    queryFn: async () => {
      try {
        const res = await axios.get(`${API_BASE}/telemetry/environment/latest/esp32_weather_01`, { timeout: 3000 });
        return res.data;
      } catch (error) {
        return null;
      }
    },
    retry: false,
    refetchInterval: 10000, // Auto refresh every 10s
  });

  // Safe fallback if db is empty
  const LATEST = envData || {
    light_condition: "N/A",
    rain_status: "N/A",
    rain_wetness_percent: 0,
    air_temperature_c: 0,
    humidity_percent: 0,
    condensation_risk: "N/A",
    atmospheric_pressure_hpa: 0,
  };

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

          {/* Real-time Weather & Date */}
          <div className="flex flex-col md:flex-row items-end md:items-center gap-4 md:gap-6 mt-4 md:mt-0">
            <WeatherWidget />
            
            <div className="flex flex-col items-end gap-1.5 border-t md:border-t-0 md:border-l border-white/20 pt-3 md:pt-0 md:pl-6">
              
              <div className="flex items-center gap-2 mb-2">
                <button 
                  onClick={() => setIsSystemOn(!isSystemOn)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-colors border shadow-sm ${
                    isSystemOn 
                    ? 'bg-green-500/20 text-green-100 border-green-400/30 hover:bg-green-500/30' 
                    : 'bg-red-500/20 text-red-100 border-red-500/30 hover:bg-red-500/30'
                  }`}
                >
                  <Power className="w-3.5 h-3.5" />
                  {isSystemOn ? 'System ON' : 'System OFF'}
                </button>
              </div>

              <div className="flex items-center gap-2 text-sm opacity-90 font-medium">
                <span className={`w-2.5 h-2.5 rounded-full ${isSystemOn ? 'bg-green-400 animate-pulse shadow-[0_0_8px_rgba(74,222,128,0.6)]' : 'bg-red-500'}`} />
                <span>{isSystemOn ? 'Live System' : 'System Offline'}</span>
              </div>
              <p className="text-xs opacity-75 font-medium uppercase tracking-wider">
                {new Date().toLocaleDateString('en-US', {
                  weekday: 'short', day: 'numeric', month: 'short'
                })}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Local Microclimate (Weather Station) ───────────────────────── */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-blue-50">
            <CloudSun className="w-4 h-4 text-blue-500" />
          </div>
          <div>
            <h3 className="font-bold text-base text-foreground">Local Microclimate</h3>
            <p className="text-xs text-muted-foreground">Real-time data from on-site weather station</p>
          </div>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            icon={CloudSun} label="Light Condition"
            value={LATEST.light_condition} unit=""
            color="hsl(45, 90%, 45%)" bgColor="hsl(45, 90%, 94%)"
          />
          <StatCard
            icon={Umbrella} label="Rain Status"
            value={LATEST.rain_status} unit=""
            color="hsl(220, 70%, 50%)" bgColor="hsl(220, 70%, 95%)"
          />
          <StatCard
            icon={Droplets} label="Rain Wetness"
            value={LATEST.rain_wetness_percent?.toFixed(0) || 0} unit="%"
            color="hsl(210, 80%, 45%)" bgColor="hsl(210, 80%, 95%)"
          />
          <StatCard
            icon={Thermometer} label="Air Temp"
            value={LATEST.air_temperature_c?.toFixed(1) || 0} unit="°C"
            color="hsl(20, 80%, 52%)" bgColor="hsl(20, 80%, 95%)"
          />
          <StatCard
            icon={Cloud} label="Humidity"
            value={LATEST.humidity_percent?.toFixed(0) || 0} unit="%"
            color="hsl(210, 68%, 48%)" bgColor="hsl(210, 68%, 95%)"
          />
          <StatCard
            icon={ShieldAlert} label="Condensation Risk"
            value={LATEST.condensation_risk} unit=""
            color="hsl(330, 60%, 50%)" bgColor="hsl(330, 60%, 95%)"
          />
          <StatCard
            icon={Gauge} label="Atm. Pressure"
            value={LATEST.atmospheric_pressure_hpa?.toFixed(0) || 0} unit="hPa"
            color="hsl(260, 40%, 50%)" bgColor="hsl(260, 40%, 95%)"
          />
        </div>
      </section>

      {/* ── Overview Stats Grid (Soil Node) ─────────────────────────────── */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-green-50">
            <Sprout className="w-4 h-4 text-green-600" />
          </div>
          <div>
            <h3 className="font-bold text-base text-foreground">Soil Health Metrics</h3>
            <p className="text-xs text-muted-foreground">Latest telemetry from {DEVICE_NAME}</p>
          </div>
        </div>

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
      </section>

      {/* ── Manual Override Controls ───────────────────────────────────────────── */}
      <section className="bg-muted/20 border border-border rounded-2xl p-5 md:p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-orange-50">
              <Zap className="w-4 h-4 text-orange-500" />
            </div>
            <div>
              <h3 className="font-bold text-base text-foreground">Manual Override Controls</h3>
              <p className="text-xs text-muted-foreground">Directly toggle irrigation and nutrient dosing pumps</p>
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <PumpControl 
            label="Water Pump" icon={Droplets} isActive={pumps.water} 
            onClick={() => setPumps({...pumps, water: !pumps.water})} color="hsl(210, 80%, 50%)" 
          />
          <PumpControl 
            label="Nitrogen (N)" icon={FlaskConical} isActive={pumps.nitrogen} 
            onClick={() => setPumps({...pumps, nitrogen: !pumps.nitrogen})} color="hsl(280, 70%, 50%)" 
          />
          <PumpControl 
            label="Phosphorus (P)" icon={FlaskConical} isActive={pumps.phosphorus} 
            onClick={() => setPumps({...pumps, phosphorus: !pumps.phosphorus})} color="hsl(45, 90%, 45%)" 
          />
          <PumpControl 
            label="Potassium (K)" icon={FlaskConical} isActive={pumps.potassium} 
            onClick={() => setPumps({...pumps, potassium: !pumps.potassium})} color="hsl(15, 80%, 55%)" 
          />
        </div>
      </section>

      {/* ── Dosing History Overview ─────────────────────────────────────────────── */}
      <section className="mb-4">
        <div className="flex items-center gap-3 mb-4 mt-2">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-gray-100">
            <Activity className="w-4 h-4 text-gray-500" />
          </div>
          <div>
            <h3 className="font-bold text-base text-foreground">Dosing History Overview</h3>
            <p className="text-xs text-muted-foreground">Last time resources were dispensed</p>
          </div>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded-xl p-4 flex flex-col justify-center border border-border bg-card shadow-sm">
            <p className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1.5"><Droplets className="w-3 h-3"/> Water</p>
            <p className="text-sm font-bold">2 hours ago</p>
            <p className="text-xs text-blue-500 mt-1 font-medium">12.5 Liters</p>
          </div>
          <div className="rounded-xl p-4 flex flex-col justify-center border border-border bg-card shadow-sm">
            <p className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1.5"><FlaskConical className="w-3 h-3"/> Nitrogen</p>
            <p className="text-sm font-bold">Yesterday, 4:30 PM</p>
            <p className="text-xs text-purple-500 mt-1 font-medium">450 ml</p>
          </div>
          <div className="rounded-xl p-4 flex flex-col justify-center border border-border bg-card shadow-sm">
            <p className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1.5"><FlaskConical className="w-3 h-3"/> Phosphorus</p>
            <p className="text-sm font-bold">3 days ago</p>
            <p className="text-xs text-pink-500 mt-1 font-medium">200 ml</p>
          </div>
          <div className="rounded-xl p-4 flex flex-col justify-center border border-border bg-card shadow-sm">
            <p className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1.5"><FlaskConical className="w-3 h-3"/> Potassium</p>
            <p className="text-sm font-bold">3 days ago</p>
            <p className="text-xs text-yellow-600 mt-1 font-medium">350 ml</p>
          </div>
        </div>
      </section>

      {/* ── Comprehensive Analytics ──────────────────────────────────────── */}
      <section>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
          <div className="flex items-center gap-3">
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
          
          <Link 
            href="/field-data-analysis"
            className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all hover:opacity-90 active:scale-95 shadow-sm"
            style={{ background: 'var(--primary)', color: 'white' }}
          >
            Full Data Analysis <ChevronRight className="w-4 h-4" />
          </Link>
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
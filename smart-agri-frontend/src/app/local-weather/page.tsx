// src/app/local-weather/page.tsx
"use client";

import {
  Thermometer, Cloud, Wind, CloudRain, Sun, Navigation, Droplets,
  CloudLightning, Gauge, Activity, BarChart2, CloudSun, Leaf, Umbrella,
  Wifi, ShieldAlert, Mountain, ThermometerSun, Sprout, CheckCircle2, Loader2
} from 'lucide-react';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import WeatherWidget from '@/components/WeatherWidget';

// (No mock data fallback - real data only)

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
        <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>{label}</p>
        <p className="text-base font-bold mt-0.5" style={{ color: 'var(--foreground)' }}>
          {value}<span className="text-xs font-semibold ml-1" style={{ color: 'var(--muted-foreground)' }}>{unit}</span>
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
        {new Date(label).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </p>
      {payload.map((entry: any) => (
        <div key={entry.dataKey} className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: entry.color }} />
          <span style={{ color: 'var(--muted-foreground)' }}>{entry.name}:</span>
          <span className="font-bold" style={{ color: 'var(--foreground)' }}>
            {entry.value != null && typeof entry.value === 'number' ? entry.value.toFixed(1) : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function LocalWeatherPage() {
  const { data: dbHistory, isLoading } = useQuery({
    queryKey: ['environmentHistory'],
    queryFn: async () => {
      // 3-second timeout so the page doesn't hang forever if the backend is offline
      const res = await axios.get('http://localhost:3001/api/v1/telemetry/environment/history/agribot_receiver_01', {
        timeout: 3000 
      });
      return res.data;
    },
    retry: false, // Don't retry 3 times if the backend is down, just fall back immediately
    refetchInterval: 10000, // Auto-refresh the data every 10 seconds
  });

  const history = dbHistory && dbHistory.length > 0 ? dbHistory.map((row: any) => ({
    time: row.recorded_at,
    air_temperature: row.air_temperature_c ?? 0,
    humidity_percent: row.humidity_percent ?? 0,
    soil_temperature: row.soil_temperature_c ?? 0,
    atmospheric_pressure_hpa: row.atmospheric_pressure_hpa ?? 0,
    heat_index: row.heat_index_c ?? 0,
    dew_point: row.dew_point_c ?? 0,
    dew_point_spread_c: row.dew_point_spread_c ?? 0,
    condensation_risk: row.condensation_risk ?? "Low",
    air_comfort: row.air_comfort ?? "Good",
    light_intensity: row.light_intensity_lux ?? 0,
    light_condition: row.light_condition ?? "Unknown",
    altitude_m: row.altitude_m ?? 0,
    pressure_condition: row.pressure_condition ?? "Stable",
    soil_condition: row.soil_condition ?? "Unknown",
    soil_vs_air: row.soil_vs_air ? parseFloat(row.soil_vs_air) : 0,
    rain_wetness_percent: row.rain_wetness_percent ?? 0,
    rain_detected: row.rain_detected ? "Yes" : "No",
    rain_status: row.rain_status ?? "Clear",
    rain_condition: row.rain_condition ?? "Dry",
    wifi_signal_strength: row.wifi_rssi_dbm ?? -50,
    windSpeed: 0, // DB doesn't track wind speed currently
    rainfall: row.rain_analog_raw ? row.rain_analog_raw / 1000 : 0,
    solarRadiation: (row.light_intensity_lux || 0) / 116,
  })) : [];

  const LATEST = history.length > 0 ? history[history.length - 1] : {
    time: new Date().toISOString(),
    air_temperature: 0,
    humidity_percent: 0,
    soil_temperature: 0,
    atmospheric_pressure_hpa: 0,
    heat_index: 0,
    dew_point: 0,
    dew_point_spread_c: 0,
    condensation_risk: "N/A",
    air_comfort: "N/A",
    light_intensity: 0,
    light_condition: "N/A",
    altitude_m: 0,
    pressure_condition: "N/A",
    soil_condition: "N/A",
    soil_vs_air: 0,
    rain_wetness_percent: 0,
    rain_detected: "No",
    rain_status: "N/A",
    rain_condition: "N/A",
    wifi_signal_strength: 0,
    windSpeed: 0,
    rainfall: 0,
    solarRadiation: 0,
  };

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in pb-12">

      {/* ── Hero Banner ─────────────────────────────────────────────────── */}
      <div
        className="rounded-2xl p-6 md:p-8 text-white relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, hsl(210, 80%, 35%) 0%, hsl(200, 70%, 45%) 55%, hsl(190, 60%, 40%) 100%)' }}
      >
        <div className="absolute -right-12 -top-12 w-48 h-48 rounded-full opacity-10 bg-white" />
        <div className="absolute -left-12 -bottom-12 w-48 h-48 rounded-full opacity-10 bg-white" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <CloudSun className="w-4 h-4 opacity-75" />
              <span className="text-sm opacity-75 font-medium">On-Site Weather Station</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-bold">Local Microclimate</h2>
            <p className="text-sm opacity-80 mt-1 max-w-xl">
              High-precision, hyper-local meteorological data directly from the farm's sensory array.
            </p>
          </div>

          <div className="flex flex-col md:flex-row items-end md:items-center gap-4 mt-4 md:mt-0">
             <div className="flex flex-col items-end gap-1.5 border-t md:border-t-0 md:border-l border-white/20 pt-3 md:pt-0 md:pl-6">
              <div className="flex items-center gap-2 text-sm opacity-90 font-medium">
                <Wifi className="w-4 h-4" />
                <span>Signal: {Math.abs(LATEST.wifi_signal_strength).toFixed(0)} dBm</span>
              </div>
              <div className="flex items-center gap-2 text-sm opacity-90 font-medium">
                <Mountain className="w-4 h-4" />
                <span>Altitude: {LATEST.altitude_m} m</span>
              </div>
              <div className="flex items-center gap-2 text-xs opacity-75 font-medium uppercase tracking-wider mt-1">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse shadow-[0_0_8px_rgba(74,222,128,0.6)]" />
                <span>Station Online</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Comprehensive Grid Data ───────────────────────────────────────────── */}
      
      <div className="flex flex-col gap-8">
        
        {/* Atmospheric & Temp (8 Cards) */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-blue-50">
              <ThermometerSun className="w-4 h-4 text-blue-500" />
            </div>
            <div>
              <h3 className="font-bold text-base text-foreground">Atmospheric & Temperature</h3>
              <p className="text-xs text-muted-foreground">Air quality, pressure, and heat metrics</p>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <StatCard icon={Thermometer} label="Air Temp" value={LATEST.air_temperature.toFixed(1)} unit="°C" color="hsl(20, 80%, 52%)" bgColor="hsl(20, 80%, 95%)" />
            <StatCard icon={Droplets} label="Humidity" value={LATEST.humidity_percent.toFixed(0)} unit="%" color="hsl(210, 68%, 48%)" bgColor="hsl(210, 68%, 95%)" />
            <StatCard icon={Gauge} label="Pressure" value={LATEST.atmospheric_pressure_hpa.toFixed(0)} unit="hPa" color="hsl(260, 40%, 50%)" bgColor="hsl(260, 40%, 95%)" />
            <StatCard icon={Activity} label="Pressure Cond" value={LATEST.pressure_condition} unit="" color="hsl(260, 40%, 65%)" bgColor="hsl(260, 40%, 95%)" />
            <StatCard icon={Sun} label="Heat Index" value={LATEST.heat_index.toFixed(1)} unit="°C" color="hsl(15, 80%, 55%)" bgColor="hsl(15, 80%, 95%)" />
            <StatCard icon={Cloud} label="Dew Point" value={LATEST.dew_point.toFixed(1)} unit="°C" color="hsl(200, 60%, 50%)" bgColor="hsl(200, 60%, 95%)" />
            <StatCard icon={Activity} label="Dew Pt Spread" value={LATEST.dew_point_spread_c.toFixed(1)} unit="°C" color="hsl(280, 50%, 60%)" bgColor="hsl(280, 50%, 95%)" />
            <StatCard icon={ShieldAlert} label="Condensation" value={LATEST.condensation_risk} unit="" color="hsl(330, 60%, 50%)" bgColor="hsl(330, 60%, 95%)" />
            <StatCard icon={CheckCircle2} label="Air Comfort" value={LATEST.air_comfort} unit="" color="hsl(140, 60%, 45%)" bgColor="hsl(140, 60%, 95%)" />
          </div>
        </section>

        {/* Rain & Moisture (4 Cards) */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-indigo-50">
              <Umbrella className="w-4 h-4 text-indigo-500" />
            </div>
            <div>
              <h3 className="font-bold text-base text-foreground">Rain & Moisture</h3>
              <p className="text-xs text-muted-foreground">Precipitation detection</p>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard icon={CloudRain} label="Rain Detected" value={LATEST.rain_detected} unit="" color="hsl(220, 70%, 50%)" bgColor="hsl(220, 70%, 95%)" />
            <StatCard icon={Droplets} label="Wetness" value={LATEST.rain_wetness_percent.toFixed(0)} unit="%" color="hsl(210, 80%, 45%)" bgColor="hsl(210, 80%, 95%)" />
            <StatCard icon={Activity} label="Rain Status" value={LATEST.rain_status} unit="" color="hsl(240, 50%, 60%)" bgColor="hsl(240, 50%, 95%)" />
            <StatCard icon={Cloud} label="Condition" value={LATEST.rain_condition} unit="" color="hsl(200, 40%, 50%)" bgColor="hsl(200, 40%, 95%)" />
          </div>
        </section>

        {/* Environment & Soil (4 Cards) */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-orange-50">
              <Sun className="w-4 h-4 text-orange-500" />
            </div>
            <div>
              <h3 className="font-bold text-base text-foreground">Environment & Soil</h3>
              <p className="text-xs text-muted-foreground">Light and ground metrics</p>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <StatCard icon={Sun} label="Light Int." value={LATEST.light_intensity.toFixed(1)} unit="lux" color="hsl(45, 90%, 45%)" bgColor="hsl(45, 90%, 94%)" />
            <StatCard icon={CloudSun} label="Light Cond." value={LATEST.light_condition} unit="" color="hsl(35, 90%, 55%)" bgColor="hsl(35, 90%, 95%)" />
            <StatCard icon={Mountain} label="Altitude" value={LATEST.altitude_m.toFixed(1)} unit="m" color="hsl(210, 40%, 50%)" bgColor="hsl(210, 40%, 95%)" />
            <StatCard icon={Sprout} label="Soil Temp" value={LATEST.soil_temperature.toFixed(1)} unit="°C" color="hsl(142, 60%, 40%)" bgColor="hsl(142, 60%, 95%)" />
            <StatCard icon={Leaf} label="Soil Cond" value={LATEST.soil_condition} unit="" color="hsl(120, 60%, 35%)" bgColor="hsl(120, 60%, 95%)" />
            <StatCard icon={Activity} label="Soil vs Air" value={LATEST.soil_vs_air > 0 ? `+${LATEST.soil_vs_air.toFixed(1)}` : LATEST.soil_vs_air.toFixed(1)} unit="°C" color="hsl(280, 50%, 50%)" bgColor="hsl(280, 50%, 95%)" />
          </div>
        </section>

      </div>

      {/* ── Advanced Analytics Charts (Important Graphs) ────────────────────── */}
      <section className="pt-4 border-t border-border">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-indigo-50">
            <BarChart2 className="w-4 h-4 text-indigo-500" />
          </div>
          <div>
            <h3 className="font-bold text-base text-foreground">Critical 24-Hour Trends</h3>
            <p className="text-xs text-muted-foreground">Key metrics for immediate farm microclimate analysis</p>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          
          {/* 1. Thermodynamics (Temp, Soil Temp, Dew Point) */}
          <div className="rounded-2xl p-6 animate-fade-in card-lift" style={{ background: 'var(--card)', boxShadow: 'var(--shadow-card)', border: '1px solid var(--border)' }}>
            <h4 className="font-bold text-sm mb-4" style={{ color: 'var(--foreground)' }}>Thermodynamics & Condensation Risk</h4>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={history} margin={{ top: 5, right: 0, bottom: 5, left: -20 }}>
                <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="hsl(120, 14%, 92%)" />
                <XAxis dataKey="time" tickFormatter={(t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} stroke="transparent" tick={{ fill: 'hsl(140, 10%, 50%)', fontSize: 11 }} />
                <YAxis stroke="transparent" tick={{ fill: 'hsl(140, 10%, 50%)', fontSize: 11 }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                <Line type="monotone" dataKey="air_temperature" name="Air Temp (°C)" stroke="hsl(20, 80%, 52%)" strokeWidth={2.5} dot={false} activeDot={{ r: 5, strokeWidth: 0 }} />
                <Line type="monotone" dataKey="soil_temperature" name="Soil Temp (°C)" stroke="hsl(142, 60%, 40%)" strokeWidth={2.5} dot={false} activeDot={{ r: 5, strokeWidth: 0 }} />
                <Line type="monotone" dataKey="dew_point" name="Dew Point (°C)" stroke="hsl(200, 60%, 50%)" strokeWidth={2} strokeDasharray="5 5" dot={false} activeDot={{ r: 5, strokeWidth: 0 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* 2. Hydration & Wind */}
          <div className="rounded-2xl p-6 animate-fade-in card-lift" style={{ background: 'var(--card)', boxShadow: 'var(--shadow-card)', border: '1px solid var(--border)' }}>
            <h4 className="font-bold text-sm mb-4" style={{ color: 'var(--foreground)' }}>Hydration & Wind Forces</h4>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={history} margin={{ top: 5, right: 0, bottom: 5, left: -20 }}>
                <defs>
                  <linearGradient id="colorRain" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(220, 70%, 50%)" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="hsl(220, 70%, 50%)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="hsl(120, 14%, 92%)" />
                <XAxis dataKey="time" tickFormatter={(t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} stroke="transparent" tick={{ fill: 'hsl(140, 10%, 50%)', fontSize: 11 }} />
                <YAxis yAxisId="left" stroke="transparent" tick={{ fill: 'hsl(140, 10%, 50%)', fontSize: 11 }} />
                <YAxis yAxisId="right" orientation="right" stroke="transparent" tick={{ fill: 'hsl(140, 10%, 50%)', fontSize: 11 }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                <Area yAxisId="left" type="monotone" dataKey="rainfall" name="Rainfall (mm)" stroke="hsl(220, 70%, 50%)" fillOpacity={1} fill="url(#colorRain)" />
                <Line yAxisId="right" type="monotone" dataKey="windSpeed" name="Wind (km/h)" stroke="hsl(180, 50%, 45%)" strokeWidth={2.5} dot={false} activeDot={{ r: 5, strokeWidth: 0 }} />
                <Line yAxisId="right" type="monotone" dataKey="humidity_percent" name="Humidity (%)" stroke="hsl(210, 68%, 48%)" strokeWidth={2} strokeDasharray="3 3" dot={false} activeDot={{ r: 5, strokeWidth: 0 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* 3. Solar Energy (Full Width) */}
          <div className="rounded-2xl p-6 animate-fade-in card-lift xl:col-span-2" style={{ background: 'var(--card)', boxShadow: 'var(--shadow-card)', border: '1px solid var(--border)' }}>
            <h4 className="font-bold text-sm mb-4" style={{ color: 'var(--foreground)' }}>Solar Energy & Light Condition</h4>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={history} margin={{ top: 5, right: 0, bottom: 5, left: -20 }}>
                <defs>
                  <linearGradient id="colorSun" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(45, 90%, 45%)" stopOpacity={0.5}/>
                    <stop offset="95%" stopColor="hsl(45, 90%, 45%)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="hsl(120, 14%, 92%)" />
                <XAxis dataKey="time" tickFormatter={(t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} stroke="transparent" tick={{ fill: 'hsl(140, 10%, 50%)', fontSize: 11 }} />
                <YAxis yAxisId="left" stroke="transparent" tick={{ fill: 'hsl(140, 10%, 50%)', fontSize: 11 }} />
                <YAxis yAxisId="right" orientation="right" stroke="transparent" tick={{ fill: 'hsl(140, 10%, 50%)', fontSize: 11 }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                <Area yAxisId="left" type="monotone" dataKey="solarRadiation" name="Solar Radiation (W/m²)" stroke="hsl(45, 90%, 45%)" fillOpacity={1} fill="url(#colorSun)" />
                <Line yAxisId="right" type="stepAfter" dataKey="light_intensity" name="Light Intensity (lux)" stroke="hsl(35, 90%, 55%)" strokeWidth={2.5} dot={false} activeDot={{ r: 5, strokeWidth: 0 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

        </div>
      </section>

      {/* ── Raw Data Table ─────────────────────────────────────────────────── */}
      <section className="pt-4 border-t border-border">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-gray-100">
            <Activity className="w-4 h-4 text-gray-600" />
          </div>
          <div>
            <h3 className="font-bold text-base text-foreground">Tabular Data Log</h3>
            <p className="text-xs text-muted-foreground">Detailed 24-hour historical readings</p>
          </div>
        </div>

        <div className="rounded-2xl border border-border overflow-hidden" style={{ background: 'var(--card)', boxShadow: 'var(--shadow-card)' }}>
          <div className="overflow-x-auto max-h-[500px] overflow-y-auto custom-scrollbar">
            <table className="w-full text-sm text-left">
              <thead className="text-xs uppercase sticky top-0 z-10" style={{ background: 'var(--muted)', color: 'var(--muted-foreground)' }}>
                <tr>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Time</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Light Intensity</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Light Condition</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Altitude</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Soil Temp</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Air Temp</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Humidity</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Heat Index</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Dew Point</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Soil Cond</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Dew Spread</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Cond Risk</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Pressure</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Air Comfort</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Soil vs Air</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Pressure Cond</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Wetness %</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Rain Detected</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Rain Status</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Rain Cond</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {history.length === 0 ? (
                  <tr>
                    <td colSpan={20} className="px-4 py-8 text-center text-muted-foreground">
                      No environmental records found in the database.
                    </td>
                  </tr>
                ) : (
                  [...history].reverse().map((row, idx) => (
                    <tr key={idx} className="hover:bg-muted/50 transition-colors">
                      <td className="px-4 py-3 font-medium whitespace-nowrap" style={{ color: 'var(--foreground)' }}>
                        {new Date(row.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">{row.light_intensity?.toFixed(1) || 0} lux</td>
                      <td className="px-4 py-3 whitespace-nowrap">{row.light_condition}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{row.altitude_m?.toFixed(2) || 0} m</td>
                      <td className="px-4 py-3 whitespace-nowrap">{row.soil_temperature?.toFixed(1) || 0} °C</td>
                      <td className="px-4 py-3 whitespace-nowrap">{row.air_temperature?.toFixed(1) || 0} °C</td>
                      <td className="px-4 py-3 whitespace-nowrap">{row.humidity_percent?.toFixed(0) || 0} %</td>
                      <td className="px-4 py-3 whitespace-nowrap">{row.heat_index?.toFixed(1) || 0} °C</td>
                      <td className="px-4 py-3 whitespace-nowrap">{row.dew_point?.toFixed(1) || 0} °C</td>
                      <td className="px-4 py-3 whitespace-nowrap">{row.soil_condition}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{row.dew_point_spread_c?.toFixed(1) || 0} °C</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${row.condensation_risk === 'High' ? 'bg-red-100 text-red-700' : (row.condensation_risk === 'N/A' ? 'bg-gray-100 text-gray-500' : 'bg-green-100 text-green-700')}`}>
                          {row.condensation_risk}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">{row.atmospheric_pressure_hpa?.toFixed(0) || 0} hPa</td>
                      <td className="px-4 py-3 whitespace-nowrap">{row.air_comfort}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{row.soil_vs_air?.toFixed(2) || 0} °C</td>
                      <td className="px-4 py-3 whitespace-nowrap">{row.pressure_condition}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{row.rain_wetness_percent?.toFixed(0) || 0} %</td>
                      <td className="px-4 py-3 whitespace-nowrap">{row.rain_detected}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{row.rain_status}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{row.rain_condition}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}

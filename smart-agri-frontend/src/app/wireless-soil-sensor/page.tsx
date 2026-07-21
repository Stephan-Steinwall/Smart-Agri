"use client";

import Link from 'next/link';
import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Droplets, Thermometer, Beaker, Zap, Wifi, Activity, Battery, SignalHigh, Leaf, Sprout, FlaskConical, CheckCircle2, ArrowRight } from 'lucide-react';

const API_BASE = 'http://localhost:3001/api/v1';
const DEVICE_ID = 'agribot_receiver_01';
const DEVICE_NAME = 'Main Field Node';

function SensorCard({ icon: Icon, label, value, unit, color, bgColor }: { icon: React.ElementType; label: string; value: string | number; unit?: string; color: string; bgColor: string; }) {
  return (
    <div className="rounded-2xl p-4 flex items-center gap-4 card-lift animate-fade-in min-w-0 overflow-hidden" style={{ background: 'var(--card)', boxShadow: 'var(--shadow-card)', border: '1px solid var(--border)' }}>
      <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: bgColor }}>
        <Icon className="w-5 h-5" style={{ color }} />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide break-words" style={{ color: 'var(--muted-foreground)' }}>{label}</p>
        <p className="text-lg font-bold mt-0.5 break-words" style={{ color: 'var(--foreground)' }}>
          {value}
          {unit ? <span className="text-sm font-medium ml-0.5" style={{ color: 'var(--muted-foreground)' }}>{unit}</span> : null}
        </p>
      </div>
    </div>
  );
}

export default function WirelessSoilSensorPage() {
  const queryClient = useQueryClient();

  const { data: latestReading, isLoading, isError } = useQuery({
    queryKey: ['wirelessSoilSensorLatest', DEVICE_ID],
    queryFn: async () => {
      const res = await axios.get(`${API_BASE}/telemetry/latest/${DEVICE_ID}`);
      return res.data;
    },
    refetchInterval: 10000,
  });

  // Supabase realtime: subscribe to changes in latest_soil_reading and soil_readings
  // to invalidate queries and refresh the UI immediately.
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!SUPABASE_URL || !SUPABASE_KEY) return;

    let channel: any = null;
    let supabase: any = null;

    (async () => {
      try {
        // @ts-ignore
        const mod = await import('@supabase/supabase-js');
        supabase = mod.createClient(SUPABASE_URL, SUPABASE_KEY);
        channel = supabase.channel('realtime-wireless-soil-page');

        const handleChange = () => {
          queryClient.invalidateQueries({ queryKey: ['wirelessSoilSensorLatest', DEVICE_ID] });
        };

        channel.on('postgres_changes', { event: '*', schema: 'public', table: 'latest_soil_reading', filter: `device_id=eq.${DEVICE_ID}` }, (_payload: any) => {
          handleChange();
        });
        channel.on('postgres_changes', { event: '*', schema: 'public', table: 'soil_readings', filter: `device_id=eq.${DEVICE_ID}` }, (_payload: any) => {
          handleChange();
        });

        await channel.subscribe();
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('Supabase realtime subscription failed on page:', err);
      }
    })();

    return () => {
      try {
        if (channel && typeof channel.unsubscribe === 'function') channel.unsubscribe();
        else if (supabase && channel) { try { supabase.removeChannel(channel); } catch {} }
      } catch {}
    };
  }, [queryClient]);

  const connectivity = isError ? 'Disconnected' : isLoading ? 'Checking...' : latestReading?.sensorStatus ?? 'Connected';
  const statusColor = connectivity === 'Connected' ? 'hsl(142, 65%, 40%)' : connectivity === 'Checking...' ? 'hsl(210, 68%, 48%)' : 'hsl(4, 80%, 55%)';

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="rounded-2xl p-6 md:p-8 relative overflow-hidden" style={{ background: 'linear-gradient(135deg, hsl(210, 68%, 28%) 0%, hsl(142, 58%, 28%) 55%, hsl(162, 45%, 35%) 100%)' }}>
        <div className="absolute -right-12 -top-12 w-48 h-48 rounded-full opacity-10" style={{ background: 'white' }} />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-3 text-sm text-white/80">
            <Wifi className="w-4 h-4" />
            <span>Wireless Soil Sensor</span>
          </div>
          <h1 className="text-3xl font-bold text-white">Sensor Dashboard</h1>
          <p className="mt-2 max-w-2xl text-sm text-white/80">
            Monitor soil moisture, temperature, pH, NPK nutrients, TDS, and soil conductivity for the wireless sensor node in real time.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center rounded-full px-3.5 py-2 text-sm font-semibold" style={{ background: 'rgba(255,255,255,0.12)', color: 'white' }}>
              <span className="w-2.5 h-2.5 rounded-full mr-2" style={{ background: statusColor }} />
              Sensor status: {connectivity}
            </div>
            <div className="inline-flex items-center rounded-full px-3.5 py-2 text-sm font-semibold" style={{ background: 'rgba(255,255,255,0.12)', color: 'white' }}>
              <Leaf className="w-4 h-4 mr-2" />
              Soil Health Score: {latestReading?.soilHealthScore != null ? `${latestReading.soilHealthScore} / 100` : '—'}
            </div>
          </div>
        </div>
      </div>

      <section className="rounded-2xl p-6 card-lift animate-fade-in" style={{ background: 'var(--card)', boxShadow: 'var(--shadow-card)', border: '1px solid var(--border)' }}>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-bold" style={{ color: 'var(--foreground)' }}>Data Analysis</h2>
            <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
              Open the detailed analysis view to review live soil conditions and get crop suggestions.
            </p>
          </div>
          <Link
            href="/wireless-soil-sensor/analyze"
            className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all"
            style={{ background: 'hsl(142, 65%, 94%)', color: 'hsl(142, 65%, 28%)' }}
          >
            Analyze data
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <SensorCard icon={Droplets} label="Soil Moisture" value={latestReading?.moisture?.toFixed(1) ?? '—'} unit="%" color="hsl(210, 68%, 48%)" bgColor="hsl(210, 68%, 95%)" />
        <SensorCard icon={Thermometer} label="Temperature" value={latestReading?.temperature?.toFixed(1) ?? '—'} unit="°C" color="hsl(20, 80%, 52%)" bgColor="hsl(20, 80%, 95%)" />
        <SensorCard icon={Beaker} label="Soil pH" value={latestReading?.ph?.toFixed(1) ?? '—'} color="hsl(280, 60%, 52%)" bgColor="hsl(280, 60%, 95%)" />
        <SensorCard icon={Zap} label="Soil Conductivity" value={latestReading?.soilConductivity?.toFixed(2) ?? latestReading?.electricalConductivity?.toFixed(2) ?? '—'} unit="dS/m" color="hsl(45, 90%, 45%)" bgColor="hsl(45, 90%, 94%)" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
        <SensorCard icon={Leaf} label="Nitrogen (N)" value={latestReading?.nitrogen?.toFixed(0) ?? '—'} unit="mg/kg" color="hsl(142, 65%, 40%)" bgColor="hsl(142, 65%, 94%)" />
        <SensorCard icon={Sprout} label="Phosphorus (P)" value={latestReading?.phosphorus?.toFixed(0) ?? '—'} unit="mg/kg" color="hsl(330, 65%, 50%)" bgColor="hsl(330, 65%, 95%)" />
        <SensorCard icon={FlaskConical} label="Potassium (K)" value={latestReading?.potassium?.toFixed(0) ?? '—'} unit="mg/kg" color="hsl(190, 80%, 40%)" bgColor="hsl(190, 80%, 94%)" />
        <SensorCard icon={Beaker} label="TDS" value={latestReading?.tds?.toFixed(0) ?? '—'} unit="ppm" color="hsl(260, 65%, 45%)" bgColor="hsl(260, 65%, 94%)" />
        <SensorCard icon={Zap} label="Salinity" value={latestReading?.salinity?.toFixed(2) ?? '—'} unit="‰" color="hsl(208, 87%, 45%)" bgColor="hsl(208, 87%, 94%)" />
      </div>

      <section className="rounded-2xl p-6 card-lift animate-fade-in" style={{ background: 'var(--card)', boxShadow: 'var(--shadow-card)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between gap-3 mb-5">
          <div>
            <h2 className="text-lg font-bold" style={{ color: 'var(--foreground)' }}>Connection & Power</h2>
            <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
              Live sensor and receiver status for the wireless soil node.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold" style={{ background: 'hsl(210, 68%, 95%)', color: 'hsl(210, 68%, 40%)' }}>
            <Activity className="w-4 h-4" /> Updated every 60s
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-2xl p-4" style={{ background: 'hsl(142, 65%, 94%)', border: '1px solid hsl(142, 65%, 87%)' }}>
            <div className="flex items-center gap-3 mb-3">
              <CheckCircle2 className="w-5 h-5" style={{ color: statusColor }} />
              <div>
                <p className="text-xs uppercase tracking-wide font-semibold" style={{ color: 'var(--muted-foreground)' }}>Sensor Connection</p>
                <p className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>{connectivity}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 mb-3">
              <Battery className="w-5 h-5" style={{ color: 'hsl(220, 70%, 45%)' }} />
              <div>
                <p className="text-xs uppercase tracking-wide font-semibold" style={{ color: 'var(--muted-foreground)' }}>Battery Voltage</p>
                <p className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>{latestReading?.batteryVoltage != null ? `${latestReading.batteryVoltage.toFixed(2)} V` : '—'}</p>
              </div>
            </div>
          </div>
          <div className="rounded-2xl p-4" style={{ background: 'hsl(210, 68%, 95%)', border: '1px solid hsl(210, 68%, 87%)' }}>
            <div className="flex items-center gap-3 mb-3">
              <SignalHigh className="w-5 h-5" style={{ color: 'hsl(142, 65%, 38%)' }} />
              <div>
                <p className="text-xs uppercase tracking-wide font-semibold" style={{ color: 'var(--muted-foreground)' }}>Receiver Wi-Fi Strength</p>
                <p className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>{latestReading?.receiverWifiSignalStrength != null ? `${latestReading.receiverWifiSignalStrength} dBm` : '—'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Wifi className="w-5 h-5" style={{ color: 'hsl(20, 80%, 52%)' }} />
              <div>
                <p className="text-xs uppercase tracking-wide font-semibold" style={{ color: 'var(--muted-foreground)' }}>Wi-Fi Quality</p>
                <p className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>{latestReading?.receiverWifiQuality != null ? `${latestReading.receiverWifiQuality}%` : '—'}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl p-6 card-lift animate-fade-in" style={{ background: 'var(--card)', boxShadow: 'var(--shadow-card)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between gap-3 mb-5">
          <div>
            <h2 className="text-lg font-bold" style={{ color: 'var(--foreground)' }}>Wireless Sensor Details</h2>
            <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
              Node ID: {DEVICE_ID} · Location: {DEVICE_NAME}
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold" style={{ background: 'hsl(210, 68%, 95%)', color: 'hsl(210, 68%, 40%)' }}>
            <Activity className="w-4 h-4" /> Live updates every 60s
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm font-semibold mb-3" style={{ color: 'var(--foreground)' }}>Latest reading timestamp</p>
            <div className="rounded-2xl p-5" style={{ background: 'hsl(142, 65%, 94%)', border: '1px solid hsl(142, 65%, 87%)' }}>
              <p className="text-sm text-muted-foreground">{latestReading ? new Date(latestReading.time).toLocaleString() : 'No recent data available'}</p>
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold mb-3" style={{ color: 'var(--foreground)' }}>Raw sensor connection</p>
            <div className="rounded-2xl p-5" style={{ background: 'hsl(210, 68%, 95%)', border: '1px solid hsl(210, 68%, 87%)' }}>
              <p className="text-sm text-muted-foreground">Wireless soil sensors send periodic data via the agribot receiver. If the node is offline, check the power and network connectivity.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

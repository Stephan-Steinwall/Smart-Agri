// src/app/page.tsx
"use client";

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import {
  Activity, Droplets, Thermometer, Sprout,
  BrainCircuit, BarChart2, CloudSun, Beaker, Zap, Leaf, FlaskConical, Target,
  Wind, CloudRain, Gauge, Cloud, ShieldAlert, Umbrella, Power, ChevronRight, Bot, X, Send, Trash2
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import WeatherWidget from '@/components/WeatherWidget';

const DEVICE_ID = 'esp32_weather_01';
const DEVICE_NAME = 'Main Field Node';

// The AI agronomist reads soil telemetry (moisture/NPK/pH), which is only
// published under the portable soil sensor's device id -- DEVICE_ID above is
// the weather station node used for pumps/lights/environment on this page.
const AI_CHAT_DEVICE_ID = 'agribot_receiver_01';
const QUICK_CHAT_SESSION_ID = 'dashboard_quick_chat';

type Message = { role: 'user' | 'ai'; content: string; ts?: Date };

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
      className="rounded-[1.5rem] p-5 flex items-center gap-4 transition-all hover:-translate-y-1 hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)] bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-[0_8px_30px_rgb(0,0,0,0.04)] animate-fade-in min-w-0 overflow-hidden"
    >
      <div
        className="w-12 h-12 rounded-[1rem] flex items-center justify-center flex-shrink-0"
        style={{ background: bgColor }}
      >
        <Icon className="w-6 h-6" style={{ color }} />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-0.5 break-words">{label}</p>
        <p className="text-lg font-bold text-slate-900 dark:text-white tracking-tight break-words">
          {value}<span className="text-sm font-medium ml-1 text-slate-400">{unit}</span>
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
  const queryClient = useQueryClient();
  const [isSystemOn, setIsSystemOn] = useState(true);

  const WELCOME_MESSAGE: Message = { role: 'ai', content: "Hello! I'm AgriBot. Ask me anything about your current dashboard data." };

  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isChatHistoryLoaded, setIsChatHistoryLoaded] = useState(false);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isChatOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isChatOpen]);

  // Restore the persisted conversation the first time the widget is opened,
  // instead of always starting from a blank welcome message. Reuses the same
  // ai_chat_history table and /ai/history endpoint the full AI Assistant
  // page already uses -- this quick-chat widget just never called it before.
  useEffect(() => {
    if (!isChatOpen || isChatHistoryLoaded) return;
    setIsChatHistoryLoaded(true);

    (async () => {
      try {
        const res = await apiClient.get(`/ai/history/${QUICK_CHAT_SESSION_ID}`);
        if (res.data && res.data.length > 0) {
          setMessages(res.data.map((row: any) => ({
            role: row.role === 'assistant' ? 'ai' : 'user',
            content: row.content,
            ts: new Date(row.created_at),
          })));
        }
      } catch (error) {
        // Backend offline or no history yet -- keep the welcome message.
      }
    })();
  }, [isChatOpen, isChatHistoryLoaded]);

  const handleClearChat = async () => {
    setMessages([WELCOME_MESSAGE]);
    try {
      await apiClient.delete(`/ai/history/${QUICK_CHAT_SESSION_ID}`);
    } catch (e) {
      console.error('Failed to clear chat history on server', e);
    }
  };

  const sendQuickMessage = async () => {
    if (!chatInput.trim() || isChatLoading) return;
    const userMsg: Message = { role: 'user', content: chatInput, ts: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setIsChatLoading(true);

    try {
      const res = await apiClient.post('/ai/chat', {
        query: userMsg.content,
        deviceId: AI_CHAT_DEVICE_ID,
        sessionId: QUICK_CHAT_SESSION_ID,
      });
      setMessages(prev => [
        ...prev,
        { role: 'ai', content: res.data.answer ?? 'No response received.', ts: new Date() }
      ]);
    } catch (error) {
      setMessages(prev => [
        ...prev,
        { role: 'ai', content: 'Sorry, I encountered an error connecting to the AI service.', ts: new Date() }
      ]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const { data: pumpData } = useQuery({
    queryKey: ['systemSwitches', DEVICE_ID],
    queryFn: async () => {
      try {
        const res = await apiClient.get(`/telemetry/system-switches/${DEVICE_ID}`);
        return res.data;
      } catch (e) {
        return null;
      }
    },
    refetchInterval: 5000,
  });

  const { data: deferralStatus } = useQuery({
    queryKey: ['rainDeferralStatus', DEVICE_ID],
    queryFn: async () => {
      try {
        const res = await apiClient.get(`/telemetry/rain-deferral-status/${DEVICE_ID}`);
        return res.data;
      } catch (e) {
        return null;
      }
    },
    refetchInterval: 5000,
  });

  useEffect(() => {
    if (pumpData) {
      if (pumpData.system_switch !== undefined && pumpData.system_switch !== null) {
        setIsSystemOn(pumpData.system_switch);
      }
    }
  }, [pumpData]);



  // Telemetry chart for the specific device
  const { data: chartData, isLoading: chartLoading } = useQuery({
    queryKey: ['fieldTelemetry', DEVICE_ID],
    queryFn: async () => {
      try {
        const res = await apiClient.get(`/telemetry/dashboard-history/${DEVICE_ID}`);
        return res.data && res.data.length > 0 ? res.data : TEST_DATA;
      } catch (error) {
        console.warn("Failed to fetch sensor data, using test data.", error);
        return TEST_DATA;
      }
    },
    refetchInterval: 5000, // Refresh every 5 seconds for live data
  });

  // Local Microclimate environment data
  const { data: envData } = useQuery({
    queryKey: ['environmentLatest', DEVICE_ID],
    queryFn: async () => {
      try {
        const res = await apiClient.get(`/telemetry/environment/latest/esp32_weather_01`, { timeout: 3000 });
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
    <>
      <div className="space-y-8 animate-fade-in">

      {/* ── Hero Banner ────────────────────────────────────────────────────── */}
      <div
        className="rounded-[2rem] p-8 md:p-10 text-white relative overflow-hidden shadow-[0_20px_60px_-15px_rgba(22,163,74,0.3)]"
        style={{ background: 'linear-gradient(135deg, #064e3b 0%, #047857 55%, #0f766e 100%)' }}
      >
        {/* Glassmorphism Decorative elements */}
        <div className="absolute -right-20 -top-20 w-80 h-80 rounded-full bg-white/5 blur-3xl pointer-events-none" />
        <div className="absolute -left-20 -bottom-20 w-80 h-80 rounded-full bg-emerald-400/10 blur-3xl pointer-events-none" />

        {/* Floating image hint (like the welcome page banner) */}
        <div className="absolute top-0 right-0 w-1/2 h-full opacity-20 pointer-events-none mix-blend-overlay">
          <img src="/welcome-banner.png" alt="Overlay" className="w-full h-full object-cover mask-image-gradient-l" style={{ WebkitMaskImage: 'linear-gradient(to left, black, transparent)' }} />
        </div>

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
                <div 
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border shadow-sm ${
                    isSystemOn 
                    ? 'bg-green-500/20 text-green-100 border-green-400/30' 
                    : 'bg-red-500/20 text-red-100 border-red-500/30'
                  }`}
                >
                  <Power className="w-3.5 h-3.5" />
                  {isSystemOn ? 'System ON' : 'System OFF'}
                </div>
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

      {/* ── Rain Deferral Alert ──────────────────────────────────────────────── */}
      {deferralStatus?.showBanner && (
        <div className="bg-blue-50/50 dark:bg-blue-950/40 border border-blue-500/50 rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center flex-shrink-0">
              <CloudRain className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <h3 className="font-semibold text-blue-900 dark:text-blue-200">AI Rain Deferral Active</h3>
              <p className="text-blue-700 dark:text-blue-300 text-sm mt-0.5">
                Water pump needs to be activated (Moisture is below {pumpData?.moisture_threshold_low ?? 20}%). <br className="hidden sm:block"/>
                But didn't activate because of rain prediction.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/system-control" className="px-4 py-2 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/40 dark:hover:bg-blue-800/60 text-blue-700 dark:text-blue-300 rounded-lg text-sm font-medium transition-colors border border-blue-200 dark:border-blue-800">
              Manage Controls
            </Link>
            <div className="px-4 py-2 bg-white dark:bg-slate-900/60 rounded-lg border border-blue-100 dark:border-blue-900 shadow-sm flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Monitoring Weather</span>
            </div>
          </div>
        </div>
      )}

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
        
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
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
        
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
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
          <div className="rounded-[1.5rem] p-6 animate-fade-in transition-all hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)] bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
            <h4 className="font-bold text-sm mb-6 text-slate-800 dark:text-slate-200 tracking-wide">MACRONUTRIENTS (NPK)</h4>
            {chartLoading ? (
              <div className="h-64 flex items-center justify-center"><span className="thinking-dot" /><span className="thinking-dot" /><span className="thinking-dot" /></div>
            ) : chartData && chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={chartData} margin={{ top: 5, right: 0, bottom: 5, left: -20 }}>
                  <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="var(--border)" opacity={0.5} />
                  <XAxis dataKey="time" tickFormatter={(t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} stroke="transparent" tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} />
                  <YAxis stroke="transparent" tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} />
                  <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'var(--border)', strokeWidth: 1, strokeDasharray: '4 4' }} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                  <Line type="monotone" dataKey="nitrogen" name="Nitrogen" stroke="#16a34a" strokeWidth={3} dot={false} activeDot={{ r: 6, strokeWidth: 0, fill: '#16a34a' }} />
                  <Line type="monotone" dataKey="phosphorus" name="Phosphorus" stroke="#d946ef" strokeWidth={3} dot={false} activeDot={{ r: 6, strokeWidth: 0, fill: '#d946ef' }} />
                  <Line type="monotone" dataKey="potassium" name="Potassium" stroke="#0ea5e9" strokeWidth={3} dot={false} activeDot={{ r: 6, strokeWidth: 0, fill: '#0ea5e9' }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex flex-col items-center justify-center opacity-50"><Activity className="w-8 h-8 mb-2" /><p className="text-sm">No data</p></div>
            )}
          </div>

          {/* Moisture & Temp Chart */}
          <div className="rounded-[1.5rem] p-6 animate-fade-in transition-all hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)] bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
            <h4 className="font-bold text-sm mb-6 text-slate-800 dark:text-slate-200 tracking-wide">ENVIRONMENTAL DATA</h4>
            {chartLoading ? (
              <div className="h-64 flex items-center justify-center"><span className="thinking-dot" /><span className="thinking-dot" /><span className="thinking-dot" /></div>
            ) : chartData && chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={chartData} margin={{ top: 5, right: 0, bottom: 5, left: -20 }}>
                  <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="var(--border)" opacity={0.5} />
                  <XAxis dataKey="time" tickFormatter={(t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} stroke="transparent" tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} />
                  <YAxis yAxisId="left" stroke="transparent" tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} />
                  <YAxis yAxisId="right" orientation="right" stroke="transparent" tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} />
                  <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'var(--border)', strokeWidth: 1, strokeDasharray: '4 4' }} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                  <Line yAxisId="left" type="monotone" dataKey="moisture" name="Moisture (%)" stroke="#3b82f6" strokeWidth={3} dot={false} activeDot={{ r: 6, strokeWidth: 0, fill: '#3b82f6' }} />
                  <Line yAxisId="right" type="monotone" dataKey="temperature" name="Temp (°C)" stroke="#f97316" strokeWidth={3} dot={false} activeDot={{ r: 6, strokeWidth: 0, fill: '#f97316' }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex flex-col items-center justify-center opacity-50"><Activity className="w-8 h-8 mb-2" /><p className="text-sm">No data</p></div>
            )}
          </div>

          {/* pH & EC Chart */}
          <div className="rounded-[1.5rem] p-6 animate-fade-in xl:col-span-2 transition-all hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)] bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
            <h4 className="font-bold text-sm mb-6 text-slate-800 dark:text-slate-200 tracking-wide">SOIL CHEMISTRY (pH & EC)</h4>
            {chartLoading ? (
              <div className="h-64 flex items-center justify-center"><span className="thinking-dot" /><span className="thinking-dot" /><span className="thinking-dot" /></div>
            ) : chartData && chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={chartData} margin={{ top: 5, right: 0, bottom: 5, left: -20 }}>
                  <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="var(--border)" opacity={0.5} />
                  <XAxis dataKey="time" tickFormatter={(t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} stroke="transparent" tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} />
                  <YAxis yAxisId="left" domain={[4, 9]} stroke="transparent" tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} />
                  <YAxis yAxisId="right" orientation="right" stroke="transparent" tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} />
                  <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'var(--border)', strokeWidth: 1, strokeDasharray: '4 4' }} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                  <Line yAxisId="left" type="monotone" dataKey="ph" name="pH Level" stroke="#a855f7" strokeWidth={3} dot={false} activeDot={{ r: 6, strokeWidth: 0, fill: '#a855f7' }} />
                  <Line yAxisId="right" type="monotone" dataKey="electricalConductivity" name="EC (dS/m)" stroke="#eab308" strokeWidth={3} dot={false} activeDot={{ r: 6, strokeWidth: 0, fill: '#eab308' }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex flex-col items-center justify-center opacity-50"><Activity className="w-8 h-8 mb-2" /><p className="text-sm">No data</p></div>
            )}
          </div>

        </div>
      </section>
      </div>

      {/* ── Floating AI Assistant Popup ────────────────────────────────────── */}
      {isChatOpen && (
        <div className="fixed bottom-24 right-4 left-4 sm:left-auto sm:right-8 z-50 w-auto sm:w-80 md:w-96 bg-white dark:bg-slate-900 rounded-[1.5rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] border border-slate-100 dark:border-slate-800 flex flex-col overflow-hidden animate-fade-in" style={{ height: '500px', maxHeight: '70vh' }}>
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4" style={{ background: 'linear-gradient(135deg, hsl(142, 65%, 28%), hsl(162, 55%, 40%))', color: 'white' }}>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-bold leading-none">AgriBot</h3>
                <p className="text-[10px] text-white/80 font-medium mt-1 uppercase tracking-wider">Quick Chat</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={handleClearChat} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors" title="Clear Chat">
                <Trash2 className="w-4 h-4" />
              </button>
              <button onClick={() => setIsChatOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar bg-slate-50 dark:bg-slate-900/50">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm ${msg.role === 'user' ? 'bg-emerald-600 text-white rounded-br-sm' : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-100 dark:border-slate-700 rounded-bl-sm'}`}>
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ))}
            {isChatLoading && (
              <div className="flex justify-start">
                <div className="max-w-[85%] rounded-2xl rounded-bl-sm px-4 py-3 text-sm shadow-sm bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                  <span className="thinking-dot" /><span className="thinking-dot" /><span className="thinking-dot" />
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') sendQuickMessage(); }}
                placeholder="Ask about your farm..."
                className="flex-1 bg-slate-100 dark:bg-slate-800 text-sm rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all dark:text-white"
              />
              <button
                onClick={sendQuickMessage}
                disabled={!chatInput.trim() || isChatLoading}
                className="w-11 h-11 flex items-center justify-center rounded-xl bg-emerald-600 text-white flex-shrink-0 hover:bg-emerald-700 transition-colors disabled:opacity-50"
              >
                <Send className="w-4 h-4 ml-0.5" />
              </button>
            </div>
            <div className="mt-3 text-center">
              <Link href="/ai-assistant" className="text-[11px] text-emerald-600 hover:underline font-semibold">
                Go to full AI Assistant
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ── Floating AI Assistant Button ────────────────────────────────────── */}
      <button
        onClick={() => setIsChatOpen(!isChatOpen)}
        className="fixed bottom-8 right-8 z-50 flex items-center justify-center w-14 h-14 rounded-full shadow-[0_12px_40px_rgb(0,0,0,0.15)] bg-emerald-600 text-white hover:bg-emerald-500 hover:-translate-y-1 transition-all"
        title="Open AI Assistant"
      >
        {isChatOpen ? <X className="w-6 h-6" /> : <Bot className="w-6 h-6" />}
      </button>
    </>
  );
}
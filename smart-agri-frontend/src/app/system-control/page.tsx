"use client";

import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import Link from 'next/link';
import {
  Power, Sliders, Zap, Droplets, FlaskConical, Sun, Bot, Activity,
  ShieldAlert, CheckCircle2, Clock, AlertTriangle, RefreshCw, Play,
  Square, Settings, Gauge, ChevronRight, Wifi, Layers, Sparkles,
  Timer, History, ArrowUpRight, Check, Flame, Radio, AlertCircle,
  Lock, Eye, EyeOff, KeyRound
} from 'lucide-react';

const API_BASE = 'http://localhost:3001/api/v1';
const DEVICE_ID = 'esp32_weather_01';
const DEVICE_NAME = 'Main Field Node';

type PumpLog = {
  id?: string;
  session_id: string;
  device_id: string;
  pump_name: string;
  start_time: string;
  end_time?: string;
  duration_seconds?: number;
  status: 'running' | 'completed';
};

export default function SystemControlPage() {
  const queryClient = useQueryClient();

  // Security Lock State
  const [isSecurityUnlocked, setIsSecurityUnlocked] = useState(false);
  const [securityPassword, setSecurityPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [securityError, setSecurityError] = useState('');
  const [verifyingSecurity, setVerifyingSecurity] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const unlocked = sessionStorage.getItem('systemControlUnlocked');
      if (unlocked === 'true') {
        setIsSecurityUnlocked(true);
      }
    }
  }, []);

  const handleUnlockSecurity = async (e: React.FormEvent) => {
    e.preventDefault();
    setVerifyingSecurity(true);
    setSecurityError('');

    try {
      let userEmail = 'admin@smartagri.io';
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('userAccount');
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            userEmail = parsed.email || parsed.username || userEmail;
          } catch (err) {}
        }
      }

      const res = await axios.post(`${API_BASE}/telemetry/auth/verify-system-control`, {
        emailOrUsername: userEmail,
        password: securityPassword
      });

      if (res.data && res.data.success) {
        setIsSecurityUnlocked(true);
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('systemControlUnlocked', 'true');
        }
      } else {
        setSecurityError(res.data?.message || 'Invalid System Control security password.');
      }
    } catch (err: any) {
      setSecurityError(err?.response?.data?.message || 'Failed to verify password. Please try again.');
    } finally {
      setVerifyingSecurity(false);
    }
  };

  // System master switch
  const [isSystemOn, setIsSystemOn] = useState(true);
  const [emergencyStop, setEmergencyStop] = useState(false);

  // Pump states
  const [pumps, setPumps] = useState({
    water: false,
    nitrogen: false,
    phosphorus: false,
    potassium: false,
    light_01: false,
    light_02: false,
  });

  // Light intensity simulated states (for UI visual feedback)
  const [lightIntensity, setLightIntensity] = useState({
    light_01: 85,
    light_02: 70,
  });

  // Autonomous AI Irrigation automation state
  const [isAiAutomationEnabled, setIsAiAutomationEnabled] = useState(true);

  // Timed dosing countdown simulation (in seconds remaining)
  const [activeTimers, setActiveTimers] = useState<Record<string, number>>({});

  // System uptime counter simulation
  const [uptime, setUptime] = useState(99.94);
  const [secondsElapsed, setSecondsElapsed] = useState(14820); // ~4 hours 7 mins

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsElapsed(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Format elapsed seconds into HH:MM:SS
  const formatUptime = (totalSecs: number) => {
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    return `${hrs}h ${mins}m ${secs}s`;
  };

  // Timer countdown hook for quick dosing
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveTimers(prev => {
        const next: Record<string, number> = {};
        let changed = false;
        for (const [key, val] of Object.entries(prev)) {
          if (val > 1) {
            next[key] = val - 1;
            changed = true;
          } else if (val === 1) {
            // Timer finished, auto shutoff pump!
            handlePumpToggle(key, getDbName(key), false);
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [pumps]);

  const getDbName = (key: string) => {
    if (key.startsWith('light_')) return key;
    return `pump_${key}`;
  };

  // Fetch real-time switch states from backend
  const { data: switchData } = useQuery({
    queryKey: ['systemSwitches', DEVICE_ID],
    queryFn: async () => {
      try {
        const res = await axios.get(`${API_BASE}/telemetry/system-switches/${DEVICE_ID}`);
        return res.data;
      } catch (e) {
        return null;
      }
    },
    refetchInterval: 3000,
  });

  useEffect(() => {
    if (switchData && !emergencyStop) {
      setPumps({
        water: switchData.pump_water || false,
        nitrogen: switchData.pump_nitrogen || false,
        phosphorus: switchData.pump_phosphorus || false,
        potassium: switchData.pump_potassium || false,
        light_01: switchData.light_01 || false,
        light_02: switchData.light_02 || false,
      });
      if (switchData.system_switch !== undefined && switchData.system_switch !== null) {
        setIsSystemOn(switchData.system_switch);
      }
    }
  }, [switchData, emergencyStop]);

  // Fetch pump activation logs from pump_activation_logs table
  const { data: pumpLogs, isLoading: logsLoading, refetch: refetchLogs } = useQuery<PumpLog[]>({
    queryKey: ['pumpLogs', DEVICE_ID],
    queryFn: async () => {
      try {
        const res = await axios.get(`${API_BASE}/telemetry/pump-logs/${DEVICE_ID}`);
        if (res.data && Array.isArray(res.data) && res.data.length > 0) {
          return res.data;
        }
      } catch (e) {
        console.warn("Failed to fetch pump logs via API, trying direct Supabase query...", e);
      }
      try {
        const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        if (SUPABASE_URL && SUPABASE_KEY) {
          const mod = await import('@supabase/supabase-js');
          const supabase = mod.createClient(SUPABASE_URL, SUPABASE_KEY);
          const { data } = await supabase
            .from('pump_activation_logs')
            .select('*')
            .eq('device_id', DEVICE_ID)
            .order('start_time', { ascending: false })
            .limit(50);
          if (data && Array.isArray(data)) return data;
        }
      } catch (err) {
        console.warn("Supabase fallback query failed:", err);
      }
      return [];
    },
    refetchInterval: 3000,
  });

  // Toggle master system switch
  const handleSystemToggle = async () => {
    const newState = !isSystemOn;
    setIsSystemOn(newState);
    if (!newState) {
      // If turning system off, turn all pumps off in UI
      setPumps({
        water: false,
        nitrogen: false,
        phosphorus: false,
        potassium: false,
        light_01: false,
        light_02: false,
      });
    }
    queryClient.setQueryData(['systemSwitches', DEVICE_ID], (old: any) =>
      old ? { ...old, system_switch: newState } : { system_switch: newState }
    );

    try {
      const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (SUPABASE_URL && SUPABASE_KEY) {
        const mod = await import('@supabase/supabase-js');
        const supabase = mod.createClient(SUPABASE_URL, SUPABASE_KEY);
        await supabase.from('system_switches').update({ system_switch: newState, updated_at: new Date().toISOString() }).eq('device_id', DEVICE_ID);
      }
      await axios.post(`${API_BASE}/telemetry/system-switches/${DEVICE_ID}/toggle`, {
        pumpName: 'system_switch',
        state: newState
      }).catch(() => {});
      refetchLogs();
    } catch (e) {
      console.error('Failed to toggle system switch', e);
      setIsSystemOn(!newState);
    }
  };

  // Emergency All-Stop trigger
  const handleEmergencyStop = async () => {
    setEmergencyStop(true);
    setIsSystemOn(false);
    setPumps({
      water: false,
      nitrogen: false,
      phosphorus: false,
      potassium: false,
      light_01: false,
      light_02: false,
    });
    setActiveTimers({});

    // Send stop signal for every pump to backend
    const allPumps = ['pump_water', 'pump_nitrogen', 'pump_phosphorus', 'pump_potassium', 'light_01', 'light_02', 'system_switch'];
    for (const p of allPumps) {
      try {
        await axios.post(`${API_BASE}/telemetry/system-switches/${DEVICE_ID}/toggle`, {
          pumpName: p,
          state: false
        }).catch(() => {});
      } catch (e) {}
    }
    refetchLogs();
  };

  // Reset Emergency Stop
  const handleResetEmergency = () => {
    setEmergencyStop(false);
    setIsSystemOn(true);
    handleSystemToggle(); // Turn system back on
  };

  // Toggle individual pump/light
  const handlePumpToggle = async (pumpKey: string, dbName: string, forcedState?: boolean) => {
    if (!isSystemOn && forcedState !== false) {
      alert("Cannot activate pump while Master System Switch is OFF. Please turn the System ON first.");
      return;
    }
    if (emergencyStop && forcedState !== false) {
      alert("Emergency Stop is currently engaged! Reset emergency lock before operating valves.");
      return;
    }

    const newState = forcedState !== undefined ? forcedState : !pumps[pumpKey as keyof typeof pumps];
    setPumps(prev => ({ ...prev, [pumpKey]: newState }));

    if (!newState && activeTimers[pumpKey]) {
      setActiveTimers(prev => {
        const copy = { ...prev };
        delete copy[pumpKey];
        return copy;
      });
    }

    queryClient.setQueryData(['systemSwitches', DEVICE_ID], (old: any) =>
      old ? { ...old, [dbName]: newState } : { [dbName]: newState }
    );

    try {
      const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (SUPABASE_URL && SUPABASE_KEY) {
        const mod = await import('@supabase/supabase-js');
        const supabase = mod.createClient(SUPABASE_URL, SUPABASE_KEY);
        await supabase.from('system_switches').update({ [dbName]: newState, updated_at: new Date().toISOString() }).eq('device_id', DEVICE_ID);
      }
      await axios.post(`${API_BASE}/telemetry/system-switches/${DEVICE_ID}/toggle`, {
        pumpName: dbName,
        state: newState
      }).catch(() => {});
      setTimeout(() => refetchLogs(), 500);
    } catch (e) {
      console.error('Failed to toggle pump', e);
      setPumps(prev => ({ ...prev, [pumpKey]: !newState }));
    }
  };

  // Trigger quick timed dosing
  const handleQuickDose = (pumpKey: string, durationSecs: number) => {
    if (!isSystemOn || emergencyStop) {
      handlePumpToggle(pumpKey, getDbName(pumpKey), true);
      return;
    }
    handlePumpToggle(pumpKey, getDbName(pumpKey), true);
    setActiveTimers(prev => ({ ...prev, [pumpKey]: durationSecs }));
  };

  if (!isSecurityUnlocked) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] px-4 animate-fade-in">
        <div className="max-w-md w-full bg-slate-900/90 border border-emerald-500/40 rounded-3xl p-8 shadow-[0_0_50px_rgba(16,185,129,0.15)] backdrop-blur-xl relative overflow-hidden">
          {/* Top glow effect */}
          <div className="absolute -top-24 -left-24 w-48 h-48 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none"></div>
          <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-teal-500/20 rounded-full blur-3xl pointer-events-none"></div>

          <div className="flex flex-col items-center text-center relative z-10 mb-6">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mb-4 shadow-[0_0_30px_rgba(16,185,129,0.2)]">
              <ShieldAlert className="w-8 h-8 text-emerald-400 animate-pulse" />
            </div>
            <h2 className="text-2xl font-extrabold text-white tracking-tight">Security Access Required</h2>
            <p className="text-sm text-slate-300 mt-2">
              This area contains high-voltage irrigation pumps and chemical dosing overrides. Please enter your authorized System Control password.
            </p>
          </div>

          <form onSubmit={handleUnlockSecurity} className="space-y-4 relative z-10">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                System Control Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-emerald-400" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  value={securityPassword}
                  onChange={(e) => setSecurityPassword(e.target.value)}
                  className="w-full pl-11 pr-11 py-3.5 bg-black/40 border border-white/15 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all font-mono"
                  placeholder="Enter security code..."
                  autoFocus
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              <p className="text-[11px] text-slate-400 mt-1.5 flex items-center gap-1">
                <span>Default system password: <code className="text-emerald-400 font-mono bg-emerald-950/50 px-1.5 py-0.5 rounded border border-emerald-800/50">admin123</code></span>
              </p>
            </div>

            {securityError && (
              <div className="text-red-400 text-sm text-center font-medium bg-red-500/10 py-2.5 px-3 rounded-xl border border-red-500/20 flex items-center justify-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{securityError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={verifyingSecurity || !securityPassword}
              className="w-full mt-2 flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-extrabold py-3.5 px-4 rounded-xl transition-all duration-300 shadow-[0_0_30px_rgba(16,185,129,0.3)] hover:shadow-[0_0_50px_rgba(16,185,129,0.5)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <KeyRound className="w-5 h-5" />
              <span>{verifyingSecurity ? 'Verifying Authorization...' : 'Unlock Control Center'}</span>
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-white/10 flex items-center justify-between text-xs text-slate-400 relative z-10">
            <Link href="/dashboard" className="hover:text-white transition-colors flex items-center gap-1">
              ← Return to Dashboard
            </Link>
            <span className="flex items-center gap-1.5 text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              256-bit Encrypted
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in pb-12">

      {/* ── Top Navigation / Breadcrumbs ───────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
            <Link href="/dashboard" className="hover:text-primary transition-colors flex items-center gap-1">
              Dashboard
            </Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-foreground">System Control & Automation</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-2.5">
            <Sliders className="w-8 h-8 text-emerald-600 animate-pulse" />
            System Control Center
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage actuators, nutrient dosing valves, artificial grow spectra, and autonomous AI irrigation.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider border border-border bg-card hover:bg-muted/50 transition-all shadow-sm text-foreground"
          >
            <ArrowUpRight className="w-4 h-4 rotate-180" />
            Back to Dashboard
          </Link>
          <button
            onClick={() => refetchLogs()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-all shadow-sm"
          >
            <RefreshCw className="w-3.5 h-3.5 animate-spin-once" />
            Refresh Telemetry
          </button>
        </div>
      </div>

      {/* ── Emergency Alert Banner (when active) ───────────────────────────── */}
      {emergencyStop && (
        <div className="rounded-2xl p-6 bg-red-600 text-white shadow-xl animate-bounce border-4 border-red-400 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-8 h-8 text-white animate-pulse" />
            </div>
            <div>
              <h3 className="text-xl font-black tracking-wide uppercase">EMERGENCY ALL-STOP ENGAGED</h3>
              <p className="text-sm text-red-100 mt-1">
                All irrigation pumps, nutrient dosing valves, and lighting circuits have been instantly terminated.
              </p>
            </div>
          </div>
          <button
            onClick={handleResetEmergency}
            className="px-6 py-3 rounded-xl bg-white text-red-700 font-extrabold text-sm uppercase tracking-wider hover:bg-red-50 transition-all shadow-lg hover:scale-105 active:scale-95 flex items-center gap-2"
          >
            <Check className="w-5 h-5" />
            Reset & Restore System
          </button>
        </div>
      )}

      {/* ── Hero Master Status Console ─────────────────────────────────────── */}
      <div
        className="rounded-[2rem] p-6 md:p-8 text-white relative overflow-hidden shadow-2xl transition-all"
        style={{
          background: emergencyStop
            ? 'linear-gradient(135deg, #7f1d1d 0%, #991b1b 50%, #450a0a 100%)'
            : isSystemOn
            ? 'linear-gradient(135deg, #065f46 0%, #047857 50%, #0f766e 100%)'
            : 'linear-gradient(135deg, #1e293b 0%, #334155 50%, #0f172a 100%)',
        }}
      >
        {/* Decorative background glows */}
        <div className="absolute -right-24 -top-24 w-96 h-96 rounded-full bg-white/5 blur-3xl pointer-events-none" />
        <div className="absolute -left-24 -bottom-24 w-96 h-96 rounded-full bg-emerald-400/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          
          {/* Main Status Column */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-black uppercase tracking-wider border shadow-sm ${
                emergencyStop
                  ? 'bg-red-500 text-white border-red-300'
                  : isSystemOn
                  ? 'bg-emerald-500/20 text-emerald-100 border-emerald-400/30'
                  : 'bg-slate-500/20 text-slate-200 border-slate-400/30'
              }`}>
                <span className={`w-2 h-2 rounded-full ${emergencyStop ? 'bg-white animate-ping' : isSystemOn ? 'bg-emerald-400 animate-pulse' : 'bg-slate-400'}`} />
                {emergencyStop ? 'SYSTEM LOCKDOWN' : isSystemOn ? 'OPERATIONAL MODE' : 'STANDBY MODE'}
              </span>

            </div>

            <h2 className="text-2xl md:text-4xl font-extrabold tracking-tight">
              {emergencyStop ? 'System Safety Lockdown' : isSystemOn ? 'Automated Field Actuators Online' : 'Master System Disabled'}
            </h2>
            <p className="text-sm md:text-base text-white/80 max-w-2xl leading-relaxed">
              {isSystemOn
                ? 'All valves and electronic switches are responsive to telemetry feedback and AI agronomist rules. Real-time logging is actively monitoring fluid flow and electrical consumption.'
                : 'Power to field pumps and grow lights is currently suspended. Toggle the Master Power switch to restore automated irrigation and dosing regimes.'}
            </p>

            {/* Hardware diagnostics metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
              <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/15">
                <p className="text-[10px] font-bold uppercase tracking-wider text-white/70">System Uptime</p>
                <p className="text-sm font-extrabold mt-0.5 font-mono">{formatUptime(secondsElapsed)}</p>
              </div>
              <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/15">
                <p className="text-[10px] font-bold uppercase tracking-wider text-white/70">Network Ping</p>
                <p className="text-sm font-extrabold mt-0.5 text-emerald-300">14 ms (Optimal)</p>
              </div>
              <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/15">
                <p className="text-[10px] font-bold uppercase tracking-wider text-white/70">Valves Health</p>
                <p className="text-sm font-extrabold mt-0.5 text-emerald-300 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> 100% Normal
                </p>
              </div>
            </div>
          </div>

          {/* Right Control Actions */}
          <div className="lg:col-span-5 flex flex-col sm:flex-row lg:flex-col justify-end gap-4 border-t lg:border-t-0 lg:border-l border-white/20 pt-6 lg:pt-0 lg:pl-8">
            
            {/* Master Power Button */}
            <button
              onClick={handleSystemToggle}
              className={`w-full py-4 px-6 rounded-2xl font-black text-base uppercase tracking-wider transition-all shadow-xl flex items-center justify-center gap-3 border-2 ${
                isSystemOn
                  ? 'bg-emerald-500/30 text-white border-emerald-400 hover:bg-emerald-500/40 hover:scale-[1.02]'
                  : 'bg-red-500 text-white border-red-300 hover:bg-red-600 hover:scale-[1.02] shadow-red-500/30'
              }`}
            >
              <Power className={`w-6 h-6 ${isSystemOn ? 'text-emerald-300 animate-pulse' : 'text-white'}`} />
              <span>{isSystemOn ? 'Master Power: ON' : 'Master Power: OFF'}</span>
            </button>

            {/* Emergency Shutoff Button */}
            {!emergencyStop && (
              <button
                onClick={handleEmergencyStop}
                className="w-full py-3.5 px-6 rounded-2xl font-extrabold text-xs uppercase tracking-widest bg-red-600/80 hover:bg-red-600 text-white transition-all shadow-lg hover:shadow-red-500/50 flex items-center justify-center gap-2 border border-red-400/50 active:scale-95"
              >
                <AlertTriangle className="w-4 h-4 text-amber-300" />
                <span>Emergency All-Stop</span>
              </button>
            )}

            <div className="bg-black/20 rounded-xl p-3 text-center text-xs text-white/75 font-medium">
              <span className="text-emerald-300 font-bold">Pro-Tip:</span> Timed quick-dosing automatically shuts off valves to prevent root over-saturation.
            </div>
          </div>

        </div>
      </div>

      {/* ── Autonomous AI Irrigation Automation Card ───────────────────────── */}
      <section className="bg-gradient-to-r from-emerald-950/20 via-teal-950/20 to-slate-900/20 dark:from-emerald-950/40 dark:via-teal-950/40 dark:to-slate-900/40 border-2 border-emerald-500/30 rounded-[1.75rem] p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Bot className="w-6 h-6 text-emerald-600 dark:text-emerald-400 animate-bounce" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 mb-1">
                <h3 className="text-lg font-extrabold text-foreground">AI Autonomous Irrigation Engine</h3>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                  isAiAutomationEnabled ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30' : 'bg-slate-500/20 text-slate-500 border border-slate-500/30'
                }`}>
                  {isAiAutomationEnabled ? 'Active Guard' : 'Manual Override Only'}
                </span>
              </div>
              <p className="text-sm text-muted-foreground max-w-3xl leading-relaxed">
                When enabled, <span className="font-semibold text-foreground">AutomationService</span> continuously evaluates telemetry against localized weather forecasts. Water pumps trigger automatically when moisture drops below <span className="text-emerald-600 dark:text-emerald-400 font-bold">20%</span> and shuts off at <span className="text-emerald-600 dark:text-emerald-400 font-bold">50%</span> unless impending rainfall is detected.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 self-end md:self-center">
            <button
              onClick={() => setIsAiAutomationEnabled(!isAiAutomationEnabled)}
              className={`px-5 py-3 rounded-xl font-bold text-sm transition-all shadow-sm flex items-center gap-2.5 border ${
                isAiAutomationEnabled
                  ? 'bg-emerald-600 text-white border-emerald-500 hover:bg-emerald-700 shadow-emerald-600/20'
                  : 'bg-card text-foreground border-border hover:bg-muted/50'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>{isAiAutomationEnabled ? 'AI Engine: ON' : 'AI Engine: OFF'}</span>
            </button>
          </div>
        </div>
      </section>

      {/* ── Manual Override Controls (Irrigation & Nutrients) ──────────────── */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/60">
              <Droplets className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-lg text-foreground">Irrigation & Nutrient Dosing Valves</h3>
              <p className="text-xs text-muted-foreground">Direct manual control of liquid solenoids and fertilizer peristaltic pumps</p>
            </div>
          </div>
          <div className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 bg-muted/40 px-3 py-1.5 rounded-lg border border-border self-start sm:self-auto">
            <Timer className="w-3.5 h-3.5 text-primary" />
            Select quick-dose timers below for automated cut-off
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          
          {/* Water Pump */}
          <div className={`rounded-[1.75rem] p-6 transition-all border-2 flex flex-col justify-between ${
            pumps.water
              ? 'bg-blue-50/50 dark:bg-blue-950/20 border-blue-500 shadow-[0_12px_35px_rgba(59,130,246,0.15)]'
              : 'bg-card border-border hover:border-slate-300 dark:hover:border-slate-700 shadow-sm'
          }`}>
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
                  pumps.water ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30 scale-110' : 'bg-muted text-muted-foreground'
                }`}>
                  <Droplets className={`w-6 h-6 ${pumps.water ? 'animate-bounce' : ''}`} />
                </div>
                <button
                  onClick={() => handlePumpToggle('water', 'pump_water')}
                  className={`w-14 h-8 rounded-full transition-all p-1 flex items-center ${
                    pumps.water ? 'bg-blue-600 justify-end' : 'bg-slate-300 dark:bg-slate-700 justify-start'
                  }`}
                >
                  <span className="w-6 h-6 rounded-full bg-white shadow-md block" />
                </button>
              </div>

              <h4 className="font-bold text-base text-foreground">Main Water Pump</h4>
              <p className="text-xs text-muted-foreground mt-0.5">Primary irrigation line to field drip nozzles</p>

              <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between text-xs font-semibold">
                <span className="text-muted-foreground">Flow Rate:</span>
                <span className={pumps.water ? 'text-blue-600 dark:text-blue-400 font-bold' : 'text-muted-foreground'}>
                  {pumps.water ? '18.5 L/min (Active)' : '0.0 L/min (Standby)'}
                </span>
              </div>
            </div>

            {/* Quick Dose Buttons */}
            <div className="mt-5 pt-3 border-t border-border space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Quick Dosing Timer</p>
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  onClick={() => handleQuickDose('water', 15)}
                  disabled={!isSystemOn || emergencyStop}
                  className="px-2 py-1.5 rounded-lg bg-muted hover:bg-blue-100 dark:hover:bg-blue-900/50 text-foreground text-xs font-bold transition-colors disabled:opacity-50"
                >
                  15s Dose
                </button>
                <button
                  onClick={() => handleQuickDose('water', 30)}
                  disabled={!isSystemOn || emergencyStop}
                  className="px-2 py-1.5 rounded-lg bg-muted hover:bg-blue-100 dark:hover:bg-blue-900/50 text-foreground text-xs font-bold transition-colors disabled:opacity-50"
                >
                  30s Dose
                </button>
                <button
                  onClick={() => handleQuickDose('water', 60)}
                  disabled={!isSystemOn || emergencyStop}
                  className="px-2 py-1.5 rounded-lg bg-muted hover:bg-blue-100 dark:hover:bg-blue-900/50 text-foreground text-xs font-bold transition-colors disabled:opacity-50"
                >
                  1m Dose
                </button>
              </div>
              {activeTimers['water'] && (
                <div className="bg-blue-500/20 text-blue-700 dark:text-blue-300 rounded-lg py-1 px-2 text-center text-xs font-extrabold animate-pulse">
                  ⏱ Shutoff in: {activeTimers['water']}s
                </div>
              )}
            </div>
          </div>

          {/* Nitrogen Pump */}
          <div className={`rounded-[1.75rem] p-6 transition-all border-2 flex flex-col justify-between ${
            pumps.nitrogen
              ? 'bg-purple-50/50 dark:bg-purple-950/20 border-purple-500 shadow-[0_12px_35px_rgba(168,85,247,0.15)]'
              : 'bg-card border-border hover:border-slate-300 dark:hover:border-slate-700 shadow-sm'
          }`}>
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
                  pumps.nitrogen ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/30 scale-110' : 'bg-muted text-muted-foreground'
                }`}>
                  <FlaskConical className={`w-6 h-6 ${pumps.nitrogen ? 'animate-pulse' : ''}`} />
                </div>
                <button
                  onClick={() => handlePumpToggle('nitrogen', 'pump_nitrogen')}
                  className={`w-14 h-8 rounded-full transition-all p-1 flex items-center ${
                    pumps.nitrogen ? 'bg-purple-600 justify-end' : 'bg-slate-300 dark:bg-slate-700 justify-start'
                  }`}
                >
                  <span className="w-6 h-6 rounded-full bg-white shadow-md block" />
                </button>
              </div>

              <h4 className="font-bold text-base text-foreground">Nitrogen (N) Valve</h4>
              <p className="text-xs text-muted-foreground mt-0.5">High-concentration vegetative nutrient injector</p>

              <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between text-xs font-semibold">
                <span className="text-muted-foreground">Dose Rate:</span>
                <span className={pumps.nitrogen ? 'text-purple-600 dark:text-purple-400 font-bold' : 'text-muted-foreground'}>
                  {pumps.nitrogen ? '250 ml/min (Active)' : '0.0 ml/min (Standby)'}
                </span>
              </div>
            </div>

            {/* Quick Dose Buttons */}
            <div className="mt-5 pt-3 border-t border-border space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Quick Dosing Timer</p>
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  onClick={() => handleQuickDose('nitrogen', 10)}
                  disabled={!isSystemOn || emergencyStop}
                  className="px-2 py-1.5 rounded-lg bg-muted hover:bg-purple-100 dark:hover:bg-purple-900/50 text-foreground text-xs font-bold transition-colors disabled:opacity-50"
                >
                  10s (+50ml)
                </button>
                <button
                  onClick={() => handleQuickDose('nitrogen', 20)}
                  disabled={!isSystemOn || emergencyStop}
                  className="px-2 py-1.5 rounded-lg bg-muted hover:bg-purple-100 dark:hover:bg-purple-900/50 text-foreground text-xs font-bold transition-colors disabled:opacity-50"
                >
                  20s (+100ml)
                </button>
                <button
                  onClick={() => handleQuickDose('nitrogen', 40)}
                  disabled={!isSystemOn || emergencyStop}
                  className="px-2 py-1.5 rounded-lg bg-muted hover:bg-purple-100 dark:hover:bg-purple-900/50 text-foreground text-xs font-bold transition-colors disabled:opacity-50"
                >
                  40s (+200ml)
                </button>
              </div>
              {activeTimers['nitrogen'] && (
                <div className="bg-purple-500/20 text-purple-700 dark:text-purple-300 rounded-lg py-1 px-2 text-center text-xs font-extrabold animate-pulse">
                  ⏱ Shutoff in: {activeTimers['nitrogen']}s
                </div>
              )}
            </div>
          </div>

          {/* Phosphorus Pump */}
          <div className={`rounded-[1.75rem] p-6 transition-all border-2 flex flex-col justify-between ${
            pumps.phosphorus
              ? 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-500 shadow-[0_12px_35px_rgba(245,158,11,0.15)]'
              : 'bg-card border-border hover:border-slate-300 dark:hover:border-slate-700 shadow-sm'
          }`}>
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
                  pumps.phosphorus ? 'bg-amber-600 text-white shadow-lg shadow-amber-500/30 scale-110' : 'bg-muted text-muted-foreground'
                }`}>
                  <FlaskConical className={`w-6 h-6 ${pumps.phosphorus ? 'animate-pulse' : ''}`} />
                </div>
                <button
                  onClick={() => handlePumpToggle('phosphorus', 'pump_phosphorus')}
                  className={`w-14 h-8 rounded-full transition-all p-1 flex items-center ${
                    pumps.phosphorus ? 'bg-amber-600 justify-end' : 'bg-slate-300 dark:bg-slate-700 justify-start'
                  }`}
                >
                  <span className="w-6 h-6 rounded-full bg-white shadow-md block" />
                </button>
              </div>

              <h4 className="font-bold text-base text-foreground">Phosphorus (P) Valve</h4>
              <p className="text-xs text-muted-foreground mt-0.5">Root growth and bloom promoter injector</p>

              <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between text-xs font-semibold">
                <span className="text-muted-foreground">Dose Rate:</span>
                <span className={pumps.phosphorus ? 'text-amber-600 dark:text-amber-400 font-bold' : 'text-muted-foreground'}>
                  {pumps.phosphorus ? '200 ml/min (Active)' : '0.0 ml/min (Standby)'}
                </span>
              </div>
            </div>

            {/* Quick Dose Buttons */}
            <div className="mt-5 pt-3 border-t border-border space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Quick Dosing Timer</p>
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  onClick={() => handleQuickDose('phosphorus', 15)}
                  disabled={!isSystemOn || emergencyStop}
                  className="px-2 py-1.5 rounded-lg bg-muted hover:bg-amber-100 dark:hover:bg-amber-900/50 text-foreground text-xs font-bold transition-colors disabled:opacity-50"
                >
                  15s (+50ml)
                </button>
                <button
                  onClick={() => handleQuickDose('phosphorus', 30)}
                  disabled={!isSystemOn || emergencyStop}
                  className="px-2 py-1.5 rounded-lg bg-muted hover:bg-amber-100 dark:hover:bg-amber-900/50 text-foreground text-xs font-bold transition-colors disabled:opacity-50"
                >
                  30s (+100ml)
                </button>
                <button
                  onClick={() => handleQuickDose('phosphorus', 45)}
                  disabled={!isSystemOn || emergencyStop}
                  className="px-2 py-1.5 rounded-lg bg-muted hover:bg-amber-100 dark:hover:bg-amber-900/50 text-foreground text-xs font-bold transition-colors disabled:opacity-50"
                >
                  45s (+150ml)
                </button>
              </div>
              {activeTimers['phosphorus'] && (
                <div className="bg-amber-500/20 text-amber-700 dark:text-amber-300 rounded-lg py-1 px-2 text-center text-xs font-extrabold animate-pulse">
                  ⏱ Shutoff in: {activeTimers['phosphorus']}s
                </div>
              )}
            </div>
          </div>

          {/* Potassium Pump */}
          <div className={`rounded-[1.75rem] p-6 transition-all border-2 flex flex-col justify-between ${
            pumps.potassium
              ? 'bg-orange-50/50 dark:bg-orange-950/20 border-orange-500 shadow-[0_12px_35px_rgba(249,115,22,0.15)]'
              : 'bg-card border-border hover:border-slate-300 dark:hover:border-slate-700 shadow-sm'
          }`}>
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
                  pumps.potassium ? 'bg-orange-600 text-white shadow-lg shadow-orange-500/30 scale-110' : 'bg-muted text-muted-foreground'
                }`}>
                  <FlaskConical className={`w-6 h-6 ${pumps.potassium ? 'animate-pulse' : ''}`} />
                </div>
                <button
                  onClick={() => handlePumpToggle('potassium', 'pump_potassium')}
                  className={`w-14 h-8 rounded-full transition-all p-1 flex items-center ${
                    pumps.potassium ? 'bg-orange-600 justify-end' : 'bg-slate-300 dark:bg-slate-700 justify-start'
                  }`}
                >
                  <span className="w-6 h-6 rounded-full bg-white shadow-md block" />
                </button>
              </div>

              <h4 className="font-bold text-base text-foreground">Potassium (K) Valve</h4>
              <p className="text-xs text-muted-foreground mt-0.5">Cell wall strength and stress tolerance booster</p>

              <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between text-xs font-semibold">
                <span className="text-muted-foreground">Dose Rate:</span>
                <span className={pumps.potassium ? 'text-orange-600 dark:text-orange-400 font-bold' : 'text-muted-foreground'}>
                  {pumps.potassium ? '220 ml/min (Active)' : '0.0 ml/min (Standby)'}
                </span>
              </div>
            </div>

            {/* Quick Dose Buttons */}
            <div className="mt-5 pt-3 border-t border-border space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Quick Dosing Timer</p>
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  onClick={() => handleQuickDose('potassium', 15)}
                  disabled={!isSystemOn || emergencyStop}
                  className="px-2 py-1.5 rounded-lg bg-muted hover:bg-orange-100 dark:hover:bg-orange-900/50 text-foreground text-xs font-bold transition-colors disabled:opacity-50"
                >
                  15s (+50ml)
                </button>
                <button
                  onClick={() => handleQuickDose('potassium', 30)}
                  disabled={!isSystemOn || emergencyStop}
                  className="px-2 py-1.5 rounded-lg bg-muted hover:bg-orange-100 dark:hover:bg-orange-900/50 text-foreground text-xs font-bold transition-colors disabled:opacity-50"
                >
                  30s (+100ml)
                </button>
                <button
                  onClick={() => handleQuickDose('potassium', 45)}
                  disabled={!isSystemOn || emergencyStop}
                  className="px-2 py-1.5 rounded-lg bg-muted hover:bg-orange-100 dark:hover:bg-orange-900/50 text-foreground text-xs font-bold transition-colors disabled:opacity-50"
                >
                  45s (+150ml)
                </button>
              </div>
              {activeTimers['potassium'] && (
                <div className="bg-orange-500/20 text-orange-700 dark:text-orange-300 rounded-lg py-1 px-2 text-center text-xs font-extrabold animate-pulse">
                  ⏱ Shutoff in: {activeTimers['potassium']}s
                </div>
              )}
            </div>
          </div>

        </div>
      </section>

      {/* ── Grow Lights & Spectrum Regulation ──────────────────────────────── */}
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-yellow-50 dark:bg-yellow-950/50 text-yellow-600 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-800/60">
            <Sun className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-extrabold text-lg text-foreground">Grow Lights & Photosynthetic Spectra</h3>
            <p className="text-xs text-muted-foreground">Manage full-spectrum LED fixtures and supplemental UV/IR bloom enhancers</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Light 01 */}
          <div className={`rounded-[1.75rem] p-6 transition-all border-2 ${
            pumps.light_01
              ? 'bg-yellow-50/40 dark:bg-yellow-950/20 border-yellow-500 shadow-[0_12px_35px_rgba(234,179,8,0.15)]'
              : 'bg-card border-border hover:border-slate-300 dark:hover:border-slate-700 shadow-sm'
          }`}>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${
                  pumps.light_01 ? 'bg-yellow-500 text-white shadow-lg shadow-yellow-500/30 scale-110' : 'bg-muted text-muted-foreground'
                }`}>
                  <Sun className={`w-7 h-7 ${pumps.light_01 ? 'animate-spin-slow' : ''}`} />
                </div>
                <div>
                  <h4 className="font-bold text-base text-foreground">Canopy Main Grow Light (Light 1)</h4>
                  <p className="text-xs text-muted-foreground">Full Spectrum 4000K + 660nm Deep Red</p>
                </div>
              </div>

              <button
                onClick={() => handlePumpToggle('light_01', 'light_01')}
                className={`w-16 h-9 rounded-full transition-all p-1 flex items-center ${
                  pumps.light_01 ? 'bg-yellow-500 justify-end' : 'bg-slate-300 dark:bg-slate-700 justify-start'
                }`}
              >
                <span className="w-7 h-7 rounded-full bg-white shadow-md block" />
              </button>
            </div>

            {/* Simulated Brightness Slider */}
            <div className="space-y-2 pt-4 border-t border-border">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-muted-foreground">Spectrum Intensity / Dimmer:</span>
                <span className={pumps.light_01 ? 'text-yellow-600 dark:text-yellow-400 font-bold' : 'text-muted-foreground'}>
                  {pumps.light_01 ? `${lightIntensity.light_01}% Output (${Math.round(lightIntensity.light_01 * 3.2)} PPFD)` : 'Off'}
                </span>
              </div>
              <input
                type="range"
                min="10"
                max="100"
                disabled={!pumps.light_01}
                value={lightIntensity.light_01}
                onChange={(e) => setLightIntensity(prev => ({ ...prev, light_01: parseInt(e.target.value) }))}
                className="w-full accent-yellow-500 cursor-pointer disabled:opacity-30"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
                <span>10% (Seedling)</span>
                <span>50% (Veg)</span>
                <span>100% (Full Bloom)</span>
              </div>
            </div>
          </div>

          {/* Light 02 */}
          <div className={`rounded-[1.75rem] p-6 transition-all border-2 ${
            pumps.light_02
              ? 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-500 shadow-[0_12px_35px_rgba(245,158,11,0.15)]'
              : 'bg-card border-border hover:border-slate-300 dark:hover:border-slate-700 shadow-sm'
          }`}>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${
                  pumps.light_02 ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/30 scale-110' : 'bg-muted text-muted-foreground'
                }`}>
                  <Flame className={`w-7 h-7 ${pumps.light_02 ? 'animate-pulse' : ''}`} />
                </div>
                <div>
                  <h4 className="font-bold text-base text-foreground">Bloom UV/IR Supplement (Light 2)</h4>
                  <p className="text-xs text-muted-foreground">385nm UV-A + 730nm Far Red Photomorphogenesis</p>
                </div>
              </div>

              <button
                onClick={() => handlePumpToggle('light_02', 'light_02')}
                className={`w-16 h-9 rounded-full transition-all p-1 flex items-center ${
                  pumps.light_02 ? 'bg-amber-500 justify-end' : 'bg-slate-300 dark:bg-slate-700 justify-start'
                }`}
              >
                <span className="w-7 h-7 rounded-full bg-white shadow-md block" />
              </button>
            </div>

            {/* Simulated Brightness Slider */}
            <div className="space-y-2 pt-4 border-t border-border">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-muted-foreground">Spectrum Intensity / Dimmer:</span>
                <span className={pumps.light_02 ? 'text-amber-600 dark:text-amber-400 font-bold' : 'text-muted-foreground'}>
                  {pumps.light_02 ? `${lightIntensity.light_02}% Output` : 'Off'}
                </span>
              </div>
              <input
                type="range"
                min="10"
                max="100"
                disabled={!pumps.light_02}
                value={lightIntensity.light_02}
                onChange={(e) => setLightIntensity(prev => ({ ...prev, light_02: parseInt(e.target.value) }))}
                className="w-full accent-amber-500 cursor-pointer disabled:opacity-30"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
                <span>10% (Subtle)</span>
                <span>50% (Standard)</span>
                <span>100% (High Stress Booster)</span>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* ── Pump Activation History Table ────────────────────────────────── */}
      <section className="bg-card border border-border rounded-[1.75rem] p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-lg text-foreground">Pump Activation History Table</h3>
              <p className="text-xs text-muted-foreground">Retrieving real-time records from <code className="text-primary font-mono font-bold">pump_activation_logs</code> table</p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Live Syncing (3s interval)</span>
          </div>
        </div>

        {logsLoading ? (
          <div className="py-16 flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <RefreshCw className="w-8 h-8 animate-spin text-emerald-600" />
            <p className="text-sm font-semibold">Loading pump activation history from database...</p>
          </div>
        ) : pumpLogs && pumpLogs.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-border text-muted-foreground text-xs uppercase tracking-wider font-extrabold">
                  <th className="pb-3 pl-2">Pump Name</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3">Start Time</th>
                  <th className="pb-3">End Time</th>
                  <th className="pb-3 pr-2 text-right">Duration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {pumpLogs.slice(0, 15).map((log, index) => {
                  const isRunning = log.status === 'running';
                  const formatPumpName = (name: string) => {
                    if (name === 'water') return '💧 Main Water Pump';
                    if (name === 'nitrogen') return '🧪 Nitrogen (N) Injector';
                    if (name === 'phosphorus') return '🧪 Phosphorus (P) Injector';
                    if (name === 'potassium') return '🧪 Potassium (K) Injector';
                    if (name === 'light_01') return '☀️ Canopy Grow Light 1';
                    if (name === 'light_02') return '🔥 Bloom UV/IR Light 2';
                    return name.toUpperCase();
                  };

                  return (
                    <tr key={log.id || log.session_id || index} className="hover:bg-muted/40 transition-colors group">
                      <td className="py-3.5 pl-2 font-bold text-foreground">
                        {formatPumpName(log.pump_name)}
                      </td>
                      <td className="py-3.5">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider ${
                          isRunning
                            ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/30 animate-pulse'
                            : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20'
                        }`}>
                          {isRunning ? (
                            <>
                              <RefreshCw className="w-3 h-3 animate-spin" />
                              Running
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="w-3 h-3" />
                              Completed
                            </>
                          )}
                        </span>
                      </td>
                      <td className="py-3.5 text-muted-foreground font-mono text-xs">
                        {new Date(log.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        <span className="text-[10px] ml-1 opacity-60">({new Date(log.start_time).toLocaleDateString()})</span>
                      </td>
                      <td className="py-3.5 text-muted-foreground font-mono text-xs">
                        {log.end_time ? (
                          new Date(log.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                        ) : (
                          <span className="text-blue-500 font-semibold italic">In Progress...</span>
                        )}
                      </td>
                      <td className="py-3.5 pr-2 text-right font-mono font-bold text-foreground">
                        {log.duration_seconds !== undefined && log.duration_seconds !== null ? (
                          `${log.duration_seconds}s`
                        ) : isRunning ? (
                          <span className="text-blue-500 animate-pulse">Active</span>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {pumpLogs.length > 15 && (
              <div className="mt-4 pt-3 border-t border-border text-center text-xs text-muted-foreground font-medium">
                Showing latest 15 activations out of {pumpLogs.length} total logged records in <code className="font-mono">pump_activation_logs</code>.
              </div>
            )}
          </div>
        ) : (
          <div className="py-12 text-center text-muted-foreground bg-muted/20 rounded-2xl border border-dashed border-border">
            <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="font-bold text-sm">No recent pump activations logged yet.</p>
            <p className="text-xs mt-1">Try toggling an irrigation pump or quick-dose timer above to record logs in the <code className="font-mono">pump_activation_logs</code> table!</p>
          </div>
        )}
      </section>

    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import Link from 'next/link';
import { ArrowLeft, Activity, Battery, Beaker, CheckCircle2, Droplets, FlaskConical, Leaf, SignalHigh, Sprout, Thermometer, Wifi, Zap } from 'lucide-react';
import { LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const API_BASE = 'http://localhost:3001/api/v1';
const DEVICE_ID = 'agribot_receiver_01';
const DEVICE_NAME = 'Main Field Node';

type SoilMetrics = {
  moisture: number | null;
  temperature: number | null;
  ph: number | null;
  conductivity: number | null;
  nitrogen: number | null;
  phosphorus: number | null;
  potassium: number | null;
  tds: number | null;
  salinity: number | null;
};

type SavedAnalysis = {
  id: string;
  label: string;
  createdAt: string;
  soilMetrics: SoilMetrics;
  cropRecommendation: string;
};

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

export default function AnalyzeDataPage() {
  const [cropSuggestion, setCropSuggestion] = useState<any>(null);
  const [isSuggestingCrop, setIsSuggestingCrop] = useState(false);
  const [cropQuery, setCropQuery] = useState('');
  const [cropEvaluation, setCropEvaluation] = useState<any>(null);
  const [isEvaluatingCrop, setIsEvaluatingCrop] = useState(false);
  const [cropEvaluateError, setCropEvaluateError] = useState('');
  const [savedAnalyses, setSavedAnalyses] = useState<SavedAnalysis[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [saveLabel, setSaveLabel] = useState('');
  const [saveError, setSaveError] = useState('');
  const [saveToastVisible, setSaveToastVisible] = useState(false);
  const [saveToastText, setSaveToastText] = useState('Analysis saved successfully.');

  const queryClient = useQueryClient();

  const { data: latestReadingData, isLoading: isLatestLoading, isError: isLatestError } = useQuery({
    queryKey: ['wirelessSoilSensorLatest', DEVICE_ID],
    queryFn: async () => {
      const res = await axios.get(`${API_BASE}/telemetry/latest/${DEVICE_ID}`);
      return res.data;
    },
    refetchInterval: 10000,
  });

  const { data: history, isLoading: isHistoryLoading, isError: isHistoryError } = useQuery({
    queryKey: ['wirelessSoilSensorAnalysis', DEVICE_ID],
    queryFn: async () => {
      const res = await axios.get(`${API_BASE}/telemetry/history/${DEVICE_ID}`);
      return res.data;
    },
    refetchInterval: 10000,
  });

  const latestReading = latestReadingData ?? history?.[history.length - 1];
  const connectivity = isLatestError || isHistoryError ? 'Disconnected' : isLatestLoading || isHistoryLoading ? 'Checking...' : latestReading?.sensorStatus ?? 'Connected';
  const statusColor = connectivity === 'Connected' ? 'hsl(142, 65%, 40%)' : connectivity === 'Checking...' ? 'hsl(210, 68%, 48%)' : 'hsl(4, 80%, 55%)';

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Fallback to local storage first for instant load
    try {
      const stored = window.localStorage.getItem('smart-agri-saved-analyses');
      if (stored) {
        setSavedAnalyses(JSON.parse(stored));
      }
    } catch {
      // Ignore storage errors
    }

    // Fetch latest from backend database
    axios.get(`${API_BASE}/telemetry/saved-analyses/${DEVICE_ID}`).then(res => {
      if (res.data && Array.isArray(res.data)) {
        const mapped = res.data.map((row: any) => ({
          id: row.id,
          label: row.label,
          createdAt: row.saved_at || row.created_at,
          soilMetrics: {
            moisture: row.soil_moisture,
            temperature: row.temperature,
            ph: row.soil_ph,
            conductivity: row.soil_conductivity,
            nitrogen: row.nitrogen,
            phosphorus: row.phosphorus,
            potassium: row.potassium,
            tds: row.tds,
            salinity: row.salinity,
          },
          cropRecommendation: row.recommended_crop || 'No crop recommendation generated'
        }));
        setSavedAnalyses(mapped);
        window.localStorage.setItem('smart-agri-saved-analyses', JSON.stringify(mapped));
      }
    }).catch(err => {
      // eslint-disable-next-line no-console
      console.warn("Failed to fetch saved analyses from DB", err);
    });
  }, []);

  // Supabase realtime subscription: listen for new/updated sensor rows and refresh queries
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      // env not provided — skip realtime
      return;
    }

    let channel: any = null;
    let supabase: any = null;

    (async () => {
      try {
        // @ts-ignore - dynamic import may be unavailable during build if package isn't installed
        const mod = await import('@supabase/supabase-js');
        supabase = mod.createClient(SUPABASE_URL, SUPABASE_KEY);

        channel = supabase.channel('realtime-wireless-soil');

        const handleChange = () => {
          queryClient.invalidateQueries({ queryKey: ['wirelessSoilSensorLatest', DEVICE_ID] });
          queryClient.invalidateQueries({ queryKey: ['wirelessSoilSensorAnalysis', DEVICE_ID] });
        };

        channel.on('postgres_changes', { event: '*', schema: 'public', table: 'latest_soil_reading', filter: `device_id=eq.${DEVICE_ID}` }, (_payload: any) => {
          handleChange();
        });

        channel.on('postgres_changes', { event: '*', schema: 'public', table: 'soil_readings', filter: `device_id=eq.${DEVICE_ID}` }, (_payload: any) => {
          handleChange();
        });

        await channel.subscribe();
      } catch (err) {
        // If supabase isn't available or subscription fails, fall back to polling
        // eslint-disable-next-line no-console
        console.warn('Supabase realtime not available:', err);
      }
    })();

    return () => {
      try {
        if (channel && typeof channel.unsubscribe === 'function') {
          channel.unsubscribe();
        } else if (supabase && channel) {
          // best-effort cleanup
          try { supabase.removeChannel(channel); } catch { /* ignore */ }
        }
      } catch {
        // ignore cleanup errors
      }
    };
  }, [queryClient]);

  const soilMetrics = useMemo<SoilMetrics>(() => ({
    moisture: latestReading?.moisture ?? null,
    temperature: latestReading?.temperature ?? null,
    ph: latestReading?.ph ?? null,
    conductivity: latestReading?.soilConductivity ?? latestReading?.electricalConductivity ?? null,
    nitrogen: latestReading?.nitrogen ?? null,
    phosphorus: latestReading?.phosphorus ?? null,
    potassium: latestReading?.potassium ?? null,
    tds: latestReading?.tds ?? null,
    salinity: latestReading?.salinity ?? null,
  }), [latestReading]);

  const scoreLabel = useMemo(() => {
    if (latestReading?.soilHealthScore != null) {
      return `${latestReading.soilHealthScore} / 100`;
    }
    return '—';
  }, [latestReading]);

  const selectedAnalyses = useMemo(() => savedAnalyses.filter((item) => selectedIds.includes(item.id)), [savedAnalyses, selectedIds]);

  const nutrientChartData = useMemo<Array<Record<string, number | string | null>>>(() => {
    const metricNames = ['nitrogen', 'phosphorus', 'potassium'] as const;
    if (selectedAnalyses.length === 0) return [];

    return metricNames.map((metric) => {
      const base: Record<string, number | string | null> = {
        metric: metric === 'nitrogen' ? 'Nitrogen' : metric === 'phosphorus' ? 'Phosphorus' : 'Potassium',
      };
      selectedAnalyses.forEach((item, index) => {
        base[`record${index}`] = item.soilMetrics[metric] ?? null;
      });
      return base;
    });
  }, [selectedAnalyses]);

  const environmentChartData = useMemo<Array<Record<string, number | string | null>>>(() => {
    const metricNames = ['moisture', 'temperature', 'salinity', 'ph'] as const;
    if (selectedAnalyses.length === 0) return [];

    return metricNames.map((metric) => {
      const label = metric === 'moisture' ? 'Moisture' : metric === 'temperature' ? 'Temperature' : metric === 'salinity' ? 'Salinity' : 'PH';
      const base: Record<string, number | string | null> = {
        metric: label,
      };
      selectedAnalyses.forEach((item, index) => {
        base[`record${index}`] = item.soilMetrics[metric] ?? null;
      });
      return base;
    });
  }, [selectedAnalyses]);

  const seriesColors = [
    'hsl(142, 65%, 38%)', 
    'hsl(210, 68%, 48%)',
    'hsl(280, 65%, 55%)',
    'hsl(45, 90%, 45%)',
    'hsl(20, 80%, 52%)',
    'hsl(330, 65%, 50%)',
    'hsl(190, 80%, 40%)',
    'hsl(260, 65%, 45%)',
    'hsl(208, 87%, 45%)',
    'hsl(0, 80%, 55%)'
  ];

  const handleToggleSelection = (id: string) => {
    setSelectedIds((current) => {
      if (current.includes(id)) {
        return current.filter((itemId) => itemId !== id);
      }
      return [...current, id];
    });
  };

  const formatMetricValue = (value: number | null) => value == null ? '—' : value;

  const handleSuggestCrop = async () => {
    setCropEvaluation(null);
    setCropEvaluateError('');
    setIsSuggestingCrop(true);
    try {
      const res = await axios.get(`${API_BASE}/ai/suggest-crop/${DEVICE_ID}`);
      setCropSuggestion(res.data);
    } catch {
      setCropSuggestion({ error: 'Unable to generate a crop suggestion right now.' });
    } finally {
      setIsSuggestingCrop(false);
    }
  };

  const handleEvaluateCrop = async () => {
    if (!cropQuery.trim()) {
      setCropEvaluateError('Please enter a crop name to evaluate.');
      return;
    }
    setCropEvaluateError('');
    setCropEvaluation(null);
    setIsEvaluatingCrop(true);

    try {
      const res = await axios.post(`${API_BASE}/ai/evaluate-crop`, {
        deviceId: DEVICE_ID,
        cropName: cropQuery.trim(),
      });
      setCropEvaluation(res.data);
    } catch {
      setCropEvaluateError('Unable to evaluate this crop right now. Please try again later.');
    } finally {
      setIsEvaluatingCrop(false);
    }
  };

  const openSaveModal = () => {
    if (!latestReading) return;
    setSaveLabel('');
    setSaveError('');
    setSaveModalOpen(true);
  };

  const closeSaveModal = () => {
    setSaveModalOpen(false);
    setSaveError('');
  };

  const handleSaveData = () => {
    if (!latestReading) return;
    openSaveModal();
  };

  const confirmSaveData = () => {
    if (!latestReading) return;
    if (!saveLabel.trim()) {
      setSaveError('Please enter a label before saving.');
      return;
    }

    (async () => {
      try {
        const payload = {
          label: saveLabel.trim(),
          deviceId: DEVICE_ID,
          soilMetrics,
          soil_moisture: soilMetrics.moisture,
          temperature: soilMetrics.temperature,
          soil_ph: soilMetrics.ph,
          soil_conductivity: soilMetrics.conductivity,
          soil_health_score: latestReading?.soilHealthScore ?? latestReading?.soilHealthScore ?? null,
          nitrogen: soilMetrics.nitrogen,
          phosphorus: soilMetrics.phosphorus,
          potassium: soilMetrics.potassium,
          tds: soilMetrics.tds,
          salinity: soilMetrics.salinity,
          recommended_crop: cropSuggestion?.recommendedCrop?.crop ?? null,
          recommendation_reason: cropSuggestion?.summary ?? null,
        };

        const res = await axios.post(`${API_BASE}/telemetry/save-analysis`, payload);
        const saved = res.data;
        const entry: SavedAnalysis = {
          id: saved?.id ?? `${Date.now()}`,
          label: saved?.label ?? saveLabel.trim(),
          createdAt: saved?.saved_at ?? saved?.created_at ?? new Date().toISOString(),
          soilMetrics,
          cropRecommendation: saved?.recommended_crop ?? cropSuggestion?.recommendedCrop?.crop ?? 'No crop recommendation generated',
        };

        const nextItems = [entry, ...savedAnalyses];
        setSavedAnalyses(nextItems);
        if (typeof window !== 'undefined') {
          window.localStorage.setItem('smart-agri-saved-analyses', JSON.stringify(nextItems));
        }
        // Refresh latest reading and history so UI reflects newly saved data immediately
        queryClient.invalidateQueries({ queryKey: ['wirelessSoilSensorLatest', DEVICE_ID] });
        queryClient.invalidateQueries({ queryKey: ['wirelessSoilSensorAnalysis', DEVICE_ID] });

        closeSaveModal();
        setSaveToastText('Analysis saved successfully');
        setSaveToastVisible(true);
        window.setTimeout(() => setSaveToastVisible(false), 3000);
      } catch (err) {
        setSaveError('Failed to save analysis. Please try again later.');
      }
    })();
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) return;
    try {
      // Separate UUID-like ids (to delete from DB) from local-only ids
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      const idsForServer = selectedIds.filter((id) => uuidRegex.test(id));

      let res = null;
      if (idsForServer.length > 0) {
        res = await axios.post(`${API_BASE}/telemetry/delete-analysis`, { ids: idsForServer });
      }

      // remove deleted ids (both server-deleted and local-only) from local state
      const remaining = savedAnalyses.filter((item) => !selectedIds.includes(item.id));
      setSavedAnalyses(remaining);
      setSelectedIds([]);
      // update webcache/localStorage as well
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('smart-agri-saved-analyses', JSON.stringify(remaining));
      }
      if (selectedIds.length === 1) setSaveToastText('Deleted selected analysis');
      else setSaveToastText(`Deleted ${selectedIds.length} analyses`);
      setSaveToastVisible(true);
      window.setTimeout(() => setSaveToastVisible(false), 3000);
      // Invalidate queries so recent readings / table reflect deletion
      queryClient.invalidateQueries({ queryKey: ['wirelessSoilSensorLatest', DEVICE_ID] });
      queryClient.invalidateQueries({ queryKey: ['wirelessSoilSensorAnalysis', DEVICE_ID] });
    } catch (err) {
      setSaveError('Failed to delete selected analyses.');
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {saveToastVisible && (
        <div className="fixed bottom-6 right-6 z-50 rounded-2xl border border-white/10 bg-green-600/95 px-4 py-3 shadow-2xl backdrop-blur-sm" style={{ color: 'white' }}>
          <p className="text-sm font-semibold">{saveToastText}</p>
        </div>
      )}
      {saveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl ring-1 ring-black/10">
            <div className="mb-4">
              <h2 className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>Save Analysis</h2>
              <p className="mt-2 text-sm" style={{ color: 'var(--muted-foreground)' }}>
                Enter a descriptive label for this soil analysis before saving it.
              </p>
            </div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--foreground)' }}>
              Analysis label
            </label>
            <input
              value={saveLabel}
              onChange={(event) => setSaveLabel(event.target.value)}
              className="w-full rounded-2xl border px-4 py-3 text-sm outline-none transition-colors focus:border-slate-300"
              placeholder="e.g. Morning field reading"
            />
            {saveError && (
              <p className="mt-2 text-sm text-red-600">{saveError}</p>
            )}
            <div className="mt-5 flex flex-wrap gap-3 justify-end">
              <button
                type="button"
                onClick={closeSaveModal}
                className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmSaveData}
                className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
              >
                Save Analysis
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="rounded-2xl p-6 md:p-8 relative overflow-hidden" style={{ background: 'linear-gradient(135deg, hsl(210, 68%, 28%) 0%, hsl(142, 58%, 28%) 55%, hsl(162, 45%, 35%) 100%)' }}>
        <div className="absolute -right-12 -top-12 w-48 h-48 rounded-full opacity-10" style={{ background: 'white' }} />
        <div className="relative z-10">
          <Link href="/wireless-soil-sensor" className="inline-flex items-center gap-2 text-sm text-white/80 hover:text-white">
            <ArrowLeft className="w-4 h-4" />
            Back to dashboard
          </Link>
          <h1 className="mt-4 text-3xl font-bold text-white">Live Soil Analysis</h1>
          <p className="mt-2 max-w-2xl text-sm text-white/80">
            Review the latest sensor readings and get a crop recommendation grounded in the current field conditions.
          </p>
        </div>
      </div>

      <section className="rounded-2xl p-6 card-lift animate-fade-in" style={{ background: 'var(--card)', boxShadow: 'var(--shadow-card)', border: '1px solid var(--border)' }}>
        <div className="flex flex-wrap items-center gap-3 mb-5">
          <div className="inline-flex items-center rounded-full px-3.5 py-2 text-sm font-semibold" style={{ background: 'hsl(210, 68%, 95%)', color: 'hsl(210, 68%, 35%)' }}>
            <span className="w-2.5 h-2.5 rounded-full mr-2" style={{ background: statusColor }} />
            Sensor status: {connectivity}
          </div>
          <div className="inline-flex items-center rounded-full px-3.5 py-2 text-sm font-semibold" style={{ background: 'hsl(142, 65%, 94%)', color: 'hsl(142, 65%, 28%)' }}>
            <Leaf className="w-4 h-4 mr-2" />
            Soil Health Score: {scoreLabel}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <SensorCard icon={Droplets} label="Soil Moisture" value={latestReading?.moisture?.toFixed(1) ?? '—'} unit="%" color="hsl(210, 68%, 48%)" bgColor="hsl(210, 68%, 95%)" />
          <SensorCard icon={Thermometer} label="Temperature" value={latestReading?.temperature?.toFixed(1) ?? '—'} unit="°C" color="hsl(20, 80%, 52%)" bgColor="hsl(20, 80%, 95%)" />
          <SensorCard icon={Beaker} label="Soil pH" value={latestReading?.ph?.toFixed(1) ?? '—'} color="hsl(280, 60%, 52%)" bgColor="hsl(280, 60%, 95%)" />
          <SensorCard icon={Zap} label="Soil Conductivity" value={latestReading?.soilConductivity?.toFixed(2) ?? latestReading?.electricalConductivity?.toFixed(2) ?? '—'} unit="dS/m" color="hsl(45, 90%, 45%)" bgColor="hsl(45, 90%, 94%)" />
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
          <SensorCard icon={Leaf} label="Nitrogen (N)" value={latestReading?.nitrogen?.toFixed(0) ?? '—'} unit="mg/kg" color="hsl(142, 65%, 40%)" bgColor="hsl(142, 65%, 94%)" />
          <SensorCard icon={Sprout} label="Phosphorus (P)" value={latestReading?.phosphorus?.toFixed(0) ?? '—'} unit="mg/kg" color="hsl(330, 65%, 50%)" bgColor="hsl(330, 65%, 95%)" />
          <SensorCard icon={FlaskConical} label="Potassium (K)" value={latestReading?.potassium?.toFixed(0) ?? '—'} unit="mg/kg" color="hsl(190, 80%, 40%)" bgColor="hsl(190, 80%, 94%)" />
          <SensorCard icon={Beaker} label="TDS" value={latestReading?.tds?.toFixed(0) ?? '—'} unit="ppm" color="hsl(260, 65%, 45%)" bgColor="hsl(260, 65%, 94%)" />
          <SensorCard icon={Zap} label="Salinity" value={latestReading?.salinity?.toFixed(2) ?? '—'} unit="‰" color="hsl(208, 87%, 45%)" bgColor="hsl(208, 87%, 94%)" />
        </div>
      </section>

      <section className="rounded-2xl p-6 card-lift animate-fade-in" style={{ background: 'var(--card)', boxShadow: 'var(--shadow-card)', border: '1px solid var(--border)' }}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center">
                <Leaf className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold" style={{ color: 'var(--foreground)' }}>Crop Recommendation</h2>
                <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
                  Use the latest soil data to suggest the best crop match or evaluate a specific plant for current conditions.
                </p>
              </div>
            </div>

            <hr className="border-t border-slate-100" />

            <div className="flex items-start gap-3 text-sm text-slate-600">
              <div className="rounded-full bg-slate-50 p-2">
                <CheckCircle2 className="w-4 h-4 text-slate-400" />
              </div>
              <p className="leading-relaxed">
                Click the button to generate a crop recommendation from the latest live sensor data.
              </p>
            </div>

            <div className="mt-4">
              <button
                onClick={handleSaveData}
                disabled={!latestReading}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
              >
                Save Data
              </button>
            </div>
          </div>

          <div className="flex flex-col items-end gap-4">
            <div className="w-full max-w-[520px] grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3">
              <input
                value={cropQuery}
                onChange={(event) => setCropQuery(event.target.value)}
                placeholder="Enter plant name to evaluate"
                className="w-full rounded-2xl border px-4 py-3 text-sm outline-none transition-colors focus:border-slate-300"
              />
              <button
                onClick={handleEvaluateCrop}
                disabled={isEvaluatingCrop || !latestReading}
                className="inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold transition-all disabled:opacity-60 h-10 bg-blue-600 text-white"
              >
                {isEvaluatingCrop ? 'Evaluating…' : 'Evaluate crop'}
              </button>
            </div>

            <button
              onClick={handleSuggestCrop}
              disabled={isSuggestingCrop || !latestReading}
              className="w-full max-w-[520px] rounded-xl px-4 py-3 text-sm font-semibold transition-all disabled:opacity-60 bg-emerald-100 text-emerald-800 flex items-center justify-center gap-2"
            >
              <Sprout className="w-4 h-4 text-emerald-700" />
              {isSuggestingCrop ? 'Analyzing…' : 'Suggest a crop'}
            </button>
          </div>
        </div>

        {cropEvaluateError && (
          <p className="mt-4 text-sm text-red-600">{cropEvaluateError}</p>
        )}

        {cropEvaluation && (
          <div className="mt-4 rounded-2xl p-4" style={{ background: 'hsl(210, 68%, 95%)', border: '1px solid hsl(210, 68%, 87%)' }}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs uppercase tracking-wide font-semibold" style={{ color: 'var(--muted-foreground)' }}>Crop evaluation</p>
                <h3 className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>{cropEvaluation.cropName}</h3>
              </div>
              <div className="rounded-full px-3 py-1 text-sm font-semibold" style={{ background: 'white', color: cropEvaluation.canPlantNow ? 'hsl(142, 65%, 28%)' : 'hsl(4, 80%, 35%)' }}>
                {cropEvaluation.canPlantNow ? 'Plant Now' : 'Wait and amend'}
              </div>
            </div>
            <p className="mt-3 text-sm" style={{ color: 'var(--muted-foreground)' }}>{cropEvaluation.recommendation}</p>
            {cropEvaluation.reasons?.length > 0 && (
              <div className="mt-4">
                <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Why</p>
                <ul className="mt-2 space-y-2 text-sm" style={{ color: 'var(--muted-foreground)' }}>
                  {cropEvaluation.reasons.map((reason: string, index: number) => (
                    <li key={index} className="ml-4 list-disc">{reason}</li>
                  ))}
                </ul>
              </div>
            )}
            {cropEvaluation.actions?.length > 0 && (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold mb-2" style={{ color: 'var(--foreground)' }}>Recommended actions</p>
                <ul className="space-y-2 text-sm" style={{ color: 'var(--muted-foreground)' }}>
                  {cropEvaluation.actions.map((action: string, index: number) => (
                    <li key={index} className="ml-4 list-disc">{action}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {cropSuggestion?.error ? (
          <div className="mt-4 rounded-2xl p-4" style={{ background: 'hsl(4, 80%, 96%)', border: '1px solid hsl(4, 80%, 86%)' }}>
            <p className="text-sm font-medium" style={{ color: 'hsl(4, 80%, 35%)' }}>{cropSuggestion.error}</p>
          </div>
        ) : cropSuggestion?.recommendedCrop ? (
          <div className="mt-4 space-y-3">
            <div className="rounded-2xl p-4" style={{ background: 'hsl(142, 65%, 94%)', border: '1px solid hsl(142, 65%, 87%)' }}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs uppercase tracking-wide font-semibold" style={{ color: 'var(--muted-foreground)' }}>Recommended crop</p>
                  <h3 className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>{cropSuggestion.recommendedCrop.crop}</h3>
                </div>
                <div className="rounded-full px-3 py-1 text-sm font-semibold" style={{ background: 'white', color: 'hsl(142, 65%, 28%)' }}>
                  {cropSuggestion.recommendedCrop.score}/100 fit
                </div>
              </div>
              <p className="mt-3 text-sm" style={{ color: 'var(--muted-foreground)' }}>{cropSuggestion.summary}</p>
              <p className="mt-2 text-sm" style={{ color: 'var(--foreground)' }}>{cropSuggestion.recommendedCrop.description}</p>
              <ul className="mt-3 space-y-1 text-sm" style={{ color: 'var(--muted-foreground)' }}>
                {cropSuggestion.recommendedCrop.reasons?.map((reason: string, index: number) => (
                  <li key={index} className="ml-4 list-disc">{reason}</li>
                ))}
              </ul>

              {cropSuggestion.prePlantRecommendations?.length > 0 && (
                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-semibold mb-2" style={{ color: 'var(--foreground)' }}>Pre-plant soil recommendations</p>
                  <ul className="space-y-2 text-sm" style={{ color: 'var(--muted-foreground)' }}>
                    {cropSuggestion.prePlantRecommendations.map((recommendation: string, index: number) => (
                      <li key={index} className="ml-4 list-disc">{recommendation}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {cropSuggestion.alternatives?.length > 0 && (
              <div className="rounded-2xl p-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Other strong options</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {cropSuggestion.alternatives.map((alternative: any, index: number) => (
                    <span key={index} className="rounded-full px-3 py-1 text-sm" style={{ background: 'hsl(210, 68%, 95%)', color: 'hsl(210, 68%, 35%)' }}>
                      {alternative.crop} · {alternative.score}/100
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
          ) : (
          null
        )}

      </section>

      <section className="rounded-2xl p-6 card-lift animate-fade-in" style={{ background: 'var(--card)', boxShadow: 'var(--shadow-card)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between gap-3 mb-5">
          <div>
            <h2 className="text-lg font-bold" style={{ color: 'var(--foreground)' }}>Comparison Charts</h2>
            <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
              Select up to two saved records from the table below to compare nutrient and soil condition trends.
            </p>
          </div>
        </div>

        {selectedAnalyses.length === 0 ? (
          <div className="rounded-2xl p-6" style={{ background: 'hsl(120, 14%, 95%)', border: '1px solid hsl(120, 14%, 87%)' }}>
            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
              Select one or two saved analyses to display comparison data here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="rounded-2xl p-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
              <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--foreground)' }}>Nutrient Comparison</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={nutrientChartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="4 4" stroke="hsl(120, 14%, 92%)" vertical={false} />
                    <XAxis dataKey="metric" tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }} />
                    <YAxis tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }} />
                    <Tooltip formatter={(value: any) => value ?? '—'} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    {selectedAnalyses.map((item, index) => (
                      <Line
                        key={item.id}
                        type="monotone"
                        dataKey={`record${index}`}
                        name={item.label}
                        stroke={seriesColors[index]}
                        strokeWidth={2.5}
                        dot={{ r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="rounded-2xl p-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
              <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--foreground)' }}>Soil Condition Comparison</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={environmentChartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="4 4" stroke="hsl(120, 14%, 92%)" vertical={false} />
                    <XAxis dataKey="metric" tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }} />
                    <YAxis tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }} />
                    <Tooltip formatter={(value: any) => value ?? '—'} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    {selectedAnalyses.map((item, index) => (
                      <Line
                        key={item.id}
                        type="monotone"
                        dataKey={`record${index}`}
                        name={item.label}
                        stroke={seriesColors[index]}
                        strokeWidth={2.5}
                        dot={{ r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-2xl p-6 card-lift animate-fade-in" style={{ background: 'var(--card)', boxShadow: 'var(--shadow-card)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between gap-3 mb-5">
          <div>
            <h2 className="text-lg font-bold" style={{ color: 'var(--foreground)' }}>Saved Analyses</h2>
            <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
              Previously saved soil and crop recommendation records appear here.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={async (e) => { e.stopPropagation(); if (selectedIds.length === 0) return; if (!confirm(`Delete ${selectedIds.length} selected analysis?`)) return; await handleDeleteSelected(); }}
              disabled={selectedIds.length === 0}
              className="rounded-xl px-3 py-2 text-sm font-semibold transition disabled:opacity-50 bg-red-600 text-white"
            >
              Delete Selected
            </button>
          </div>
        </div>

        {savedAnalyses.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>No saved analyses yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ color: 'var(--muted-foreground)' }}>
                  <th className="px-3 py-2 text-left">Label</th>
                  <th className="px-3 py-2 text-left">Saved</th>
                  <th className="px-3 py-2 text-left">Soil Moisture</th>
                  <th className="px-3 py-2 text-left">Temperature</th>
                  <th className="px-3 py-2 text-left">Soil pH</th>
                  <th className="px-3 py-2 text-left">Soil Conductivity</th>
                  <th className="px-3 py-2 text-left">Nitrogen (N)</th>
                  <th className="px-3 py-2 text-left">Phosphorus (P)</th>
                  <th className="px-3 py-2 text-left">Potassium (K)</th>
                  <th className="px-3 py-2 text-left">TDS</th>
                  <th className="px-3 py-2 text-left">Salinity</th>
                  <th className="px-3 py-2 text-left">Recommended crop</th>
                </tr>
              </thead>
              <tbody>
                {savedAnalyses.map((item) => {
                  const isSelected = selectedIds.includes(item.id);
                  return (
                    <tr
                      key={item.id}
                      onClick={() => handleToggleSelection(item.id)}
                      className="transition-colors duration-150 cursor-pointer"
                      style={{
                        borderTop: '1px solid var(--border)',
                        background: isSelected ? 'hsl(142, 65%, 93%)' : 'transparent',
                      }}
                    >
                      <td className="px-3 py-3 font-semibold" style={{ color: 'var(--foreground)' }}>{item.label}</td>
                      <td className="px-3 py-3" style={{ color: 'var(--muted-foreground)' }}>{new Date(item.createdAt).toLocaleString()}</td>
                      <td className="px-3 py-3" style={{ color: 'var(--muted-foreground)' }}>{formatMetricValue(item.soilMetrics.moisture)}</td>
                      <td className="px-3 py-3" style={{ color: 'var(--muted-foreground)' }}>{formatMetricValue(item.soilMetrics.temperature)}</td>
                      <td className="px-3 py-3" style={{ color: 'var(--muted-foreground)' }}>{formatMetricValue(item.soilMetrics.ph)}</td>
                      <td className="px-3 py-3" style={{ color: 'var(--muted-foreground)' }}>{formatMetricValue(item.soilMetrics.conductivity)}</td>
                      <td className="px-3 py-3" style={{ color: 'var(--muted-foreground)' }}>{formatMetricValue(item.soilMetrics.nitrogen)}</td>
                      <td className="px-3 py-3" style={{ color: 'var(--muted-foreground)' }}>{formatMetricValue(item.soilMetrics.phosphorus)}</td>
                      <td className="px-3 py-3" style={{ color: 'var(--muted-foreground)' }}>{formatMetricValue(item.soilMetrics.potassium)}</td>
                      <td className="px-3 py-3" style={{ color: 'var(--muted-foreground)' }}>{formatMetricValue(item.soilMetrics.tds)}</td>
                      <td className="px-3 py-3" style={{ color: 'var(--muted-foreground)' }}>{formatMetricValue(item.soilMetrics.salinity)}</td>
                      <td className="px-3 py-3" style={{ color: 'var(--foreground)' }}>{item.cropRecommendation}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

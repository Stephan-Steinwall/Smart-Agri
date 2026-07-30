"use client";

import { useEffect, useMemo, useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import Link from 'next/link';
import { ArrowLeft, Activity, Battery, Beaker, CheckCircle2, ChevronDown, Droplets, FlaskConical, Leaf, SignalHigh, Sprout, Thermometer, Wifi, Zap } from 'lucide-react';
import { LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { SUPPORTED_CROPS } from '@/lib/constants';

const DEVICE_ID = 'agribot_receiver_01';
const DEVICE_NAME = 'Main Field Node';

// Configuration Constants for Sensor Unit Conversion & Moisture Calibration
// NOTE: A direct sensor electrical conductivity (EC) reading may not be equivalent to laboratory saturated paste extract ECe.
export const EC_SENSOR_UNIT: "uS/cm" | "mS/cm" | "dS/m" = (process.env.NEXT_PUBLIC_EC_SENSOR_UNIT as any) || "dS/m";
export const SOIL_FIELD_CAPACITY: number | null = process.env.NEXT_PUBLIC_SOIL_FIELD_CAPACITY ? Number(process.env.NEXT_PUBLIC_SOIL_FIELD_CAPACITY) : null;
export const SOIL_WILTING_POINT: number | null = process.env.NEXT_PUBLIC_SOIL_WILTING_POINT ? Number(process.env.NEXT_PUBLIC_SOIL_WILTING_POINT) : null;

export function convertEcToDsm(rawEc: number, unit: "uS/cm" | "mS/cm" | "dS/m" = EC_SENSOR_UNIT): number {
  if (unit === "uS/cm") {
    return rawEc / 1000;
  }
  // mS/cm and dS/m have the exact same numerical value (1 mS/cm = 1 dS/m)
  return rawEc;
}

export function calculatePlantAvailableWater(rawMoisture: number): { paw: number; isCalibrated: boolean } {
  if (SOIL_FIELD_CAPACITY == null || SOIL_WILTING_POINT == null || SOIL_FIELD_CAPACITY <= SOIL_WILTING_POINT) {
    // If calibration is not available, clamp raw moisture to 0-100 and mark as uncalibrated demonstration
    return { paw: Math.max(0, Math.min(100, rawMoisture)), isCalibrated: false };
  }
  const paw = 100 * ((rawMoisture - SOIL_WILTING_POINT) / (SOIL_FIELD_CAPACITY - SOIL_WILTING_POINT));
  return { paw: Math.max(0, Math.min(100, paw)), isCalibrated: true };
}

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
  cropLabel?: string;
  createdAt: string;
  soilMetrics: SoilMetrics;
  cropRecommendation: string;
};

function SensorCard({ icon: Icon, label, value, unit, color, bgColor }: { icon: React.ElementType; label: string; value: string | number; unit?: string; color: string; bgColor: string; }) {
  return (
    <div className="rounded-[1.5rem] p-5 flex items-center gap-4 transition-all hover:-translate-y-1 hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)] bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-[0_8px_30px_rgb(0,0,0,0.04)] animate-fade-in min-w-0 overflow-hidden">
      <div className="w-12 h-12 rounded-[1rem] flex items-center justify-center flex-shrink-0" style={{ background: bgColor }}>
        <Icon className="w-6 h-6" style={{ color }} />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-0.5 break-words">{label}</p>
        <p className="text-lg font-bold text-slate-900 dark:text-white tracking-tight break-words">
          {value}
          {unit ? <span className="text-sm font-medium ml-1 text-slate-400">{unit}</span> : null}
        </p>
      </div>
    </div>
  );
}

const PLANT_OPTIONS: string[] = [...SUPPORTED_CROPS];

export interface CropOption {
  id: string;
  name: string;
  scientific: string;
  icon: string;
  category: string;
  color: string;
  badgeBg: string;
  description: string;
}

export const CROP_OPTIONS_DATA: CropOption[] = [
  { id: 'Tomato', name: 'Tomato', scientific: 'Solanum lycopersicum', icon: '🍅', category: 'Vegetable', color: 'text-red-600 dark:text-red-400', badgeBg: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-300 dark:border-red-800', description: 'Optimal pH 6.0–6.8; moderate salinity tolerance' },
  { id: 'Brinjal', name: 'Brinjal / Eggplant', scientific: 'Solanum melongena', icon: '🍆', category: 'Vegetable', color: 'text-purple-600 dark:text-purple-400', badgeBg: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800', description: 'Warm-season crop; resilient to heat and humidity' },
  { id: 'Chilli', name: 'Chilli Pepper', scientific: 'Capsicum annuum', icon: '🌶️', category: 'Spice', color: 'text-orange-600 dark:text-orange-400', badgeBg: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/50 dark:text-orange-300 dark:border-orange-800', description: 'Requires well-drained loamy soil; sensitive to waterlogging' },
  { id: 'Maize', name: 'Maize / Corn', scientific: 'Zea mays', icon: '🌽', category: 'Cereal', color: 'text-amber-600 dark:text-amber-400', badgeBg: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800', description: 'High nitrogen and moisture demand during vegetative stage' },
  { id: 'Mango', name: 'Mango', scientific: 'Mangifera indica', icon: '🥭', category: 'Fruit Tree', color: 'text-yellow-600 dark:text-yellow-400', badgeBg: 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950/50 dark:text-yellow-300 dark:border-yellow-800', description: 'Deep-rooted perennial; thrives in sandy loam with good drainage' },
  { id: 'Onion', name: 'Onion', scientific: 'Allium cepa', icon: '🧅', category: 'Bulb', color: 'text-emerald-600 dark:text-emerald-400', badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800', description: 'Sensitive to high salinity and extreme acidity; needs steady water' },
  { id: 'Rice', name: 'Rice', scientific: 'Oryza sativa', icon: '🌾', category: 'Cereal', color: 'text-teal-600 dark:text-teal-400', badgeBg: 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/50 dark:text-teal-300 dark:border-teal-800', description: 'High water requirement; thrives in heavy clay and flooded soils' },
];

function ModernCropSelector({
  value,
  onChange,
  placeholder = "Select crop to evaluate...",
  className = "",
}: {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedCrop = useMemo(() => {
    return CROP_OPTIONS_DATA.find((c) => c.id === value) || null;
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className={`relative w-full text-left ${isOpen ? 'z-50' : 'z-0'} ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between gap-3 px-3.5 py-2 rounded-xl border transition-all duration-200 outline-none cursor-pointer h-[46px] shadow-sm select-none ${
          isOpen
            ? "border-blue-500 ring-2 ring-blue-500/20 bg-white dark:bg-slate-900"
            : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700"
        }`}
      >
        {selectedCrop ? (
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <span className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-base shrink-0 shadow-inner">
              {selectedCrop.icon}
            </span>
            <div className="flex items-center gap-2 min-w-0 truncate">
              <span className="font-bold text-sm text-slate-800 dark:text-slate-100 truncate">
                {selectedCrop.name}
              </span>
              <span className="text-xs text-slate-400 italic hidden sm:inline truncate">
                ({selectedCrop.scientific})
              </span>
            </div>
            <span className={`ml-auto text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border shrink-0 ${selectedCrop.badgeBg}`}>
              {selectedCrop.category}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500 text-sm font-medium">
            <Leaf className="w-4 h-4 text-emerald-500 shrink-0 animate-pulse" />
            <span>{placeholder}</span>
          </div>
        )}
        <ChevronDown
          className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${
            isOpen ? "rotate-180 text-blue-500" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.25)] overflow-hidden animate-in fade-in-0 zoom-in-95 duration-150 max-h-[380px] flex flex-col">
          <div className="px-4 py-2.5 bg-slate-50/80 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800/80 shrink-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Agronomic Target Crop
            </p>
            <p className="text-[11px] text-slate-400 dark:text-slate-500">
              Select plant profile for ML soil evaluation
            </p>
          </div>
          <div className="overflow-y-auto p-1.5 space-y-1 divide-y divide-transparent">
            {CROP_OPTIONS_DATA.map((crop) => {
              const isSelected = value === crop.id;
              return (
                <button
                  key={crop.id}
                  type="button"
                  onClick={() => {
                    onChange(crop.id);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left p-2.5 rounded-xl transition-all duration-150 flex items-start gap-3 group cursor-pointer ${
                    isSelected
                      ? "bg-blue-50/80 dark:bg-blue-950/50 border-l-4 border-blue-600 shadow-sm"
                      : "hover:bg-slate-50 dark:hover:bg-slate-800/80 border-l-4 border-transparent"
                  }`}
                >
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200/70 dark:from-slate-800 dark:to-slate-700 flex items-center justify-center text-xl shrink-0 shadow-sm group-hover:scale-105 transition-transform duration-200">
                    {crop.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                          {crop.name}
                        </span>
                        <span className="text-[11px] italic text-slate-400 truncate hidden sm:inline">
                          {crop.scientific}
                        </span>
                      </div>
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border shrink-0 ${crop.badgeBg}`}>
                        {crop.category}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-1">
                      {crop.description}
                    </p>
                  </div>
                  {isSelected && (
                    <div className="self-center pl-1">
                      <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AnalyzeDataPage() {
  const [sampleLocation, setSampleLocation] = useState('');
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
  const [saveCropLabel, setSaveCropLabel] = useState('');
  const [saveError, setSaveError] = useState('');
  const [saveToastVisible, setSaveToastVisible] = useState(false);
  const [saveToastText, setSaveToastText] = useState('Analysis saved successfully.');

  const queryClient = useQueryClient();

  const { data: latestReadingData, isLoading: isLatestLoading, isError: isLatestError } = useQuery({
    queryKey: ['wirelessSoilSensorLatest', DEVICE_ID],
    queryFn: async () => {
      const res = await apiClient.get(`/telemetry/latest/${DEVICE_ID}`);
      return res.data;
    },
    refetchInterval: 10000,
  });

  const { data: history, isLoading: isHistoryLoading, isError: isHistoryError } = useQuery({
    queryKey: ['wirelessSoilSensorAnalysis', DEVICE_ID],
    queryFn: async () => {
      const res = await apiClient.get(`/telemetry/history/${DEVICE_ID}`);
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
    apiClient.get(`/telemetry/saved-analyses/${DEVICE_ID}`).then(res => {
      if (res.data && Array.isArray(res.data)) {
        const mapped = res.data.map((row: any) => ({
          id: row.id,
          label: row.soil_sample_label || row.label || 'Unnamed Analysis',
          cropLabel: row.crop_label || null,
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
      const res = await apiClient.get(`/ai/suggest-crop/${DEVICE_ID}`);
      setCropSuggestion(res.data);
    } catch {
      setCropSuggestion({ error: 'Unable to generate a crop suggestion right now.' });
    } finally {
      setIsSuggestingCrop(false);
    }
  };

  const handleEvaluateCrop = async () => {
    if (!cropQuery.trim()) {
      setCropEvaluateError('Please select a crop to evaluate.');
      return;
    }
    if (!latestReading) {
      setCropEvaluateError('No portable sensor reading available to evaluate.');
      return;
    }
    if (latestReading.sensorStatus && latestReading.sensorStatus !== 'Connected') {
      setCropEvaluateError('Portable sensor is not Connected. Please connect sensor before evaluating.');
      return;
    }
    if (latestReading.hc12PacketReceived === false || latestReading.hc12_packet_received === false) {
      setCropEvaluateError('No HC12 packet received from portable sensor.');
      return;
    }
    if (latestReading.time) {
      const readingDate = new Date(latestReading.time).getTime();
      const now = Date.now();
      const diffMinutes = (now - readingDate) / (1000 * 60);
      if (diffMinutes > 5) {
        setCropEvaluateError(`Portable sensor reading is outdated (${Math.round(diffMinutes)} minutes old). Reading must be within 5 minutes.`);
        return;
      }
    }

    const phVal = latestReading.ph ?? 7.0;
    if (phVal < 0 || phVal > 14) {
      setCropEvaluateError('Invalid soil pH reading (must be between 0 and 14).');
      return;
    }

    const moistureVal = latestReading.moisture ?? 0;
    if (moistureVal < 0 || moistureVal > 100) {
      setCropEvaluateError('Invalid soil moisture reading (must be between 0 and 100%).');
      return;
    }

    const targetCrop = cropQuery.trim();
    if (!PLANT_OPTIONS.includes(targetCrop)) {
      setCropEvaluateError('This crop is not yet supported by the current recommendation model.');
      return;
    }

    setCropEvaluateError('');
    setCropEvaluation(null);
    setIsEvaluatingCrop(true);

    try {
      const pawRes = calculatePlantAvailableWater(moistureVal);

      const res = await apiClient.post('/ai/evaluate-crop', {
        deviceId: DEVICE_ID,
        cropName: cropQuery.trim(),
      });

      // A failed evaluation still comes back as 200 OK with an `error` field
      // (e.g. the ML model service is unreachable) -- surface it as an error
      // instead of silently rendering a blank "Wait and amend" card.
      if (res.data?.error) {
        setCropEvaluateError(res.data.error);
        return;
      }

      setCropEvaluation({
        ...res.data,
        isCalibrated: pawRes.isCalibrated,
        rawMoisture: moistureVal,
        pawPercent: pawRes.paw,
      });
    } catch (err: any) {
      const errMsg = err?.response?.data?.detail || err?.response?.data?.error || err?.message || 'Unable to evaluate this crop right now. Please try again later.';
      setCropEvaluateError(errMsg);
    } finally {
      setIsEvaluatingCrop(false);
    }
  };

  const openSaveModal = () => {
    if (!latestReading) return;
    setSaveLabel(sampleLocation || '');
    setSaveCropLabel(cropQuery.trim() || 'Tomato');
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
    if (!saveLabel.trim() && !sampleLocation.trim()) {
      setSaveError('Please enter a location or label before saving.');
      return;
    }

    (async () => {
      try {
        const finalLabel = saveLabel.trim() || sampleLocation.trim();
        const payload = {
          soil_sample_label: finalLabel,
          label: finalLabel,
          label_status: 'pending',
          reading_at: latestReading?.time ? new Date(latestReading.time).toISOString() : new Date().toISOString(),
          crop_label: saveCropLabel.trim() || cropQuery.trim() || null,
          deviceId: DEVICE_ID,
          soilMetrics,
          soil_moisture: soilMetrics.moisture,
          temperature: soilMetrics.temperature,
          soil_ph: soilMetrics.ph,
          soil_conductivity: soilMetrics.conductivity,
          soil_health_score: latestReading?.soilHealthScore ?? null,
          nitrogen: soilMetrics.nitrogen,
          phosphorus: soilMetrics.phosphorus,
          potassium: soilMetrics.potassium,
          tds: soilMetrics.tds,
          salinity: soilMetrics.salinity,
          recommended_crop: null,
          recommendation_reason: null,
          prediction_confidence: null,
          model_version: null,
        };

        const res = await apiClient.post('/telemetry/save-analysis', payload);
        const saved = res.data;
        const entry: SavedAnalysis = {
          id: saved?.id ?? `${Date.now()}`,
          label: saved?.soil_sample_label ?? saved?.label ?? finalLabel,
          cropLabel: saved?.crop_label ?? (saveCropLabel.trim() || cropQuery.trim() || undefined),
          createdAt: saved?.saved_at ?? saved?.created_at ?? new Date().toISOString(),
          soilMetrics,
          cropRecommendation: saved?.recommended_crop ?? 'Pending evaluation',
        };

        const nextItems = [entry, ...savedAnalyses];
        setSavedAnalyses(nextItems);
        if (typeof window !== 'undefined') {
          window.localStorage.setItem('smart-agri-saved-analyses', JSON.stringify(nextItems));
        }
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

  const handleEvaluateSavedRow = async (item: SavedAnalysis, e: React.MouseEvent) => {
    e.stopPropagation();
    const targetCrop = item.cropLabel || cropQuery.trim() || 'Tomato';
    if (!PLANT_OPTIONS.includes(targetCrop)) {
      alert('This crop is not yet supported by the current recommendation model.');
      return;
    }

    try {
      const phVal = item.soilMetrics.ph ?? 7.0;
      const moistureVal = item.soilMetrics.moisture ?? 50.0;
      const ecVal = item.soilMetrics.conductivity ?? 1.0;
      const tempVal = item.soilMetrics.temperature ?? 25.0;
      const pawRes = calculatePlantAvailableWater(moistureVal);

      const res = await apiClient.post('/ai/evaluate-crop', {
        deviceId: DEVICE_ID,
        cropName: targetCrop,
        soilMetrics: {
          ph: phVal,
          moisture: moistureVal,
          conductivity: ecVal,
          temperature: tempVal,
        },
      });

      const evalData = res.data;

      if (evalData?.error) {
        alert(`Unable to evaluate "${item.label}": ${evalData.error}`);
        return;
      }

      // Update that specific row in public."Wireless sensor Soil Analysis data"
      await apiClient.post('/telemetry/update-analysis-evaluation', {
        id: item.id,
        recommended_crop: evalData.recommended_crop,
        recommendation_reason: evalData.decision_message,
        prediction_confidence: evalData.recommended_crop_reference_score,
        model_version: evalData.model_version,
      });

      // Update local state
      setSavedAnalyses((prev) =>
        prev.map((r) =>
          r.id === item.id
            ? { ...r, cropRecommendation: `${evalData.recommended_crop} (Score: ${evalData.recommended_crop_reference_score}/100)` }
            : r
        )
      );

      setCropEvaluation({
        ...evalData,
        isCalibrated: pawRes.isCalibrated,
        rawMoisture: moistureVal,
        pawPercent: pawRes.paw,
      });

      queryClient.invalidateQueries({ queryKey: ['wirelessSoilSensorAnalysis', DEVICE_ID] });
      alert(`Successfully evaluated saved record "${item.label}"! Recommended Crop: ${evalData.recommended_crop}`);
    } catch (err: any) {
      const errMsg = err?.response?.data?.detail || err?.message || 'Failed to evaluate saved record.';
      alert(`Error evaluating saved record: ${errMsg}`);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) return;
    try {
      // Separate UUID-like ids (to delete from DB) from local-only ids
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      const idsForServer = selectedIds.filter((id) => uuidRegex.test(id));

      let res = null;
      if (idsForServer.length > 0) {
        res = await apiClient.post('/telemetry/delete-analysis', { ids: idsForServer });
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
            <label className="block text-sm font-medium mt-4 mb-2" style={{ color: 'var(--foreground)' }}>
              Crop label (for ML evaluation)
            </label>
            <ModernCropSelector
              value={saveCropLabel}
              onChange={(val) => setSaveCropLabel(val)}
              placeholder="Select crop label..."
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
      <div className="rounded-[1.5rem] p-6 md:p-8 relative overflow-hidden" style={{ background: 'linear-gradient(135deg, hsl(210, 68%, 28%) 0%, hsl(142, 58%, 28%) 55%, hsl(162, 45%, 35%) 100%)' }}>
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

      <section className="rounded-[1.5rem] p-6 animate-fade-in transition-all hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)] bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative z-40">
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

      <section className="rounded-[1.5rem] p-6 animate-fade-in transition-all hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)] bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative z-30">
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
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60 shadow-sm"
              >
                Save Soil Data
              </button>
            </div>
          </div>

          <div className="flex flex-col items-end gap-3 w-full">
            <div className="w-full max-w-[520px] flex flex-col sm:flex-row items-center gap-3">
              <div className="relative w-full min-w-0 flex-1">
                <input
                  type="text"
                  value={sampleLocation}
                  onChange={(e) => setSampleLocation(e.target.value)}
                  placeholder="Soil Sample Location (e.g. North Field - Sector A)"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-100 h-[46px] shadow-sm"
                />
              </div>
            </div>

            <div className="w-full max-w-[520px] flex flex-col sm:flex-row items-center gap-3">
              <div className="relative w-full min-w-0 flex-1">
                <ModernCropSelector
                  value={cropQuery}
                  onChange={(val) => setCropQuery(val)}
                  placeholder="Select crop to evaluate..."
                />
              </div>
              <button
                onClick={handleEvaluateCrop}
                disabled={isEvaluatingCrop || !latestReading || !cropQuery.trim()}
                className="inline-flex items-center justify-center rounded-xl px-6 text-sm font-semibold transition-all disabled:opacity-60 h-[46px] bg-blue-600 hover:bg-blue-700 text-white shadow-sm shrink-0"
              >
                {isEvaluatingCrop ? 'Evaluating…' : 'Evaluate Soil'}
              </button>
            </div>

            <button
              onClick={handleSuggestCrop}
              disabled={isSuggestingCrop || !latestReading}
              className="w-full max-w-[520px] rounded-xl px-4 text-sm font-semibold transition-all disabled:opacity-60 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 flex items-center justify-center gap-2 h-[46px] shadow-sm"
            >
              <Sprout className="w-4 h-4 text-emerald-700" />
              {isSuggestingCrop ? 'Analyzing…' : 'Suggest a crop'}
            </button>
          </div>
        </div>

        {cropEvaluateError && (
          <p className="mt-4 text-sm font-semibold text-red-600 bg-red-50 p-3.5 rounded-xl border border-red-200">{cropEvaluateError}</p>
        )}

        {cropEvaluation && cropEvaluation.selected_crop ? (
          <div className="mt-6 rounded-2xl p-5 shadow-sm" style={{ background: 'hsl(210, 68%, 96%)', border: '1px solid hsl(210, 68%, 85%)' }}>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/60 pb-3 mb-3">
              <div>
                <p className="text-xs uppercase tracking-wider font-bold text-slate-500 mb-0.5">Farmer Selected Crop</p>
                <h3 className="text-2xl font-black text-slate-900">{cropEvaluation.selected_crop}</h3>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase tracking-wider font-bold text-slate-500 mb-0.5">Reference Model Score</p>
                <span className="inline-block rounded-full px-3.5 py-1 text-sm font-bold bg-white shadow-sm border border-slate-200 text-slate-800">
                  {cropEvaluation.selected_crop_reference_score} / 100
                </span>
              </div>
            </div>

            <div className="mb-4">
              <p className="text-xs uppercase tracking-wider font-bold text-slate-500 mb-1">Reference Model Recommendation</p>
              <div className="inline-block rounded-lg px-3 py-1.5 text-sm font-bold mb-2 shadow-sm" style={{
                background: cropEvaluation.selected_crop_reference_score >= 60 ? 'hsl(142, 65%, 28%)' : cropEvaluation.selected_crop_reference_score >= 35 ? 'hsl(45, 90%, 35%)' : 'hsl(4, 80%, 35%)',
                color: 'white'
              }}>
                {cropEvaluation.decision}
              </div>
              <p className="text-sm font-medium text-slate-700 leading-relaxed">{cropEvaluation.decision_message}</p>
            </div>

            <div className="rounded-xl bg-white border border-slate-200/80 p-4 mb-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs uppercase tracking-wider font-bold text-slate-500">Best Recommended Crop</p>
                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-200">
                  Top Fit
                </span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-lg font-bold text-slate-900">{cropEvaluation.recommended_crop}</span>
                <span className="text-sm font-bold text-slate-600">Score: {cropEvaluation.recommended_crop_reference_score} / 100</span>
              </div>
            </div>

            {cropEvaluation.top_recommendations?.length > 0 && (
              <div className="mb-4">
                <p className="text-xs uppercase tracking-wider font-bold text-slate-500 mb-2">Top Three Crop Recommendations</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {cropEvaluation.top_recommendations.map((item: any, idx: number) => (
                    <div key={idx} className="rounded-xl bg-white p-3 border border-slate-200/80 flex items-center justify-between shadow-xs">
                      <span className="font-bold text-sm text-slate-800">#{idx + 1} {item.crop}</span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600">{item.reference_score}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(cropEvaluation.reasons?.length > 0 || cropEvaluation.actions?.length > 0) && (
              <div className="mb-4 rounded-xl bg-white border border-slate-200/80 p-4 shadow-sm">
                <p className="text-xs uppercase tracking-wider font-bold text-slate-500 mb-2">AI Explanation</p>
                {cropEvaluation.reasons?.length > 0 && (
                  <ul className="space-y-1.5 text-sm text-slate-700">
                    {cropEvaluation.reasons.map((reason: string, index: number) => (
                      <li key={index} className="ml-4 list-disc">{reason}</li>
                    ))}
                  </ul>
                )}
                {cropEvaluation.actions?.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-100">
                    <p className="text-xs uppercase tracking-wider font-bold text-slate-500 mb-1.5">Recommended Actions</p>
                    <ul className="space-y-1.5 text-sm text-slate-700">
                      {cropEvaluation.actions.map((action: string, index: number) => (
                        <li key={index} className="ml-4 list-disc">{action}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {!cropEvaluation.isCalibrated && (
              <div className="mb-4 rounded-xl bg-amber-50 border border-amber-200 p-3.5 text-xs text-amber-800">
                <p className="font-bold mb-0.5">⚠️ Uncalibrated Moisture Demonstration</p>
                <p>Soil moisture calibration values (field capacity / wilting point) are not configured in environment settings. The raw moisture reading ({cropEvaluation.rawMoisture}%) was treated directly as plant available water ({cropEvaluation.pawPercent}%) for demonstration purposes.</p>
              </div>
            )}

            <div className="rounded-xl bg-slate-100 border border-slate-200/80 p-3.5 text-xs text-slate-600 space-y-1.5">
              <p className="font-bold text-amber-700">⚠️ {cropEvaluation.warning}</p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-medium text-slate-500 pt-1 border-t border-slate-200/60">
                <span>Model Version: <strong className="text-slate-700">{cropEvaluation.model_version}</strong></span>
                <span>Training Origin: <strong className="text-slate-700">{cropEvaluation.training_origin}</strong></span>
                <span>EC Sensor Unit: <strong className="text-slate-700">{EC_SENSOR_UNIT}</strong></span>
              </div>
            </div>
          </div>
        ) : cropEvaluation && (
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

      <section className="rounded-[1.5rem] p-6 animate-fade-in transition-all hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)] bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative z-20">
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

      <section className="rounded-[1.5rem] p-6 animate-fade-in transition-all hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)] bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative z-10">
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
                  <th className="px-3 py-2 text-left">Crop Label</th>
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
                  <th className="px-3 py-2 text-left">Actions</th>
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
                      <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                        <select
                          value={item.cropLabel || ''}
                          onChange={(e) => {
                            const newCrop = e.target.value;
                            setSavedAnalyses((prev) =>
                              prev.map((r) =>
                                r.id === item.id ? { ...r, cropLabel: newCrop } : r
                              )
                            );
                          }}
                          className="rounded-lg border border-slate-200 bg-white dark:bg-slate-800 px-2 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 outline-none focus:border-blue-500 shadow-sm cursor-pointer"
                        >
                          <option value="">🌱 Select crop...</option>
                          {CROP_OPTIONS_DATA.map((crop) => (
                            <option key={crop.id} value={crop.id}>{crop.icon} {crop.name}</option>
                          ))}
                        </select>
                      </td>
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
                      <td className="px-3 py-3">
                        <button
                          type="button"
                          onClick={(e) => handleEvaluateSavedRow(item, e)}
                          className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 shadow-sm"
                        >
                          Evaluate Row
                        </button>
                      </td>
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

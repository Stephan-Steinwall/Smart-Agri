'use client';

import React, { useEffect, useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { apiClient } from '@/lib/api';
import { CROP_OPTIONS_DATA } from '@/app/wireless-soil-sensor/analyze/page';
import { Map, Droplets, Thermometer, FlaskConical, Search, Trash2, Sprout, Database, Download, Crosshair, Wrench, RefreshCcw, MapPin, Layers } from 'lucide-react';

// Disable SSR for Leaflet map since it requires the window object
const FarmMapClient = dynamic(() => import('@/components/FarmMapClient'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-[60vh] w-full items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm text-slate-500 font-medium">Initializing Map Engine...</p>
      </div>
    </div>
  ),
});

const DEVICE_ID = 'agribot_receiver_01';

function formatMetricValue(value: any) {
  return value == null ? '—' : value;
}

interface SavedAnalysis {
  id: string;
  label: string;
  cropLabel: string | null;
  createdAt: string;
  soilMetrics: {
    moisture: number | string;
    temperature: number | string;
    ph: number | string;
    conductivity: number | string;
    nitrogen: number | string;
    phosphorus: number | string;
    potassium: number | string;
    tds: number | string;
    salinity: number | string;
  };
  cropRecommendation: string;
}

export default function FarmMapPage() {
  // State for saved analyses
  const [savedAnalyses, setSavedAnalyses] = useState<SavedAnalysis[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [activeAction, setActiveAction] = useState('Drone Orthomosaic Active');
  const [mapLayer, setMapLayer] = useState<'drone' | 'osm'>('drone');

  // Load saved analyses on mount
  useEffect(() => {
    // Load from localStorage first
    try {
      const stored = window.localStorage.getItem('smart-agri-saved-analyses');
      if (stored) setSavedAnalyses(JSON.parse(stored));
    } catch {}
    // Then fetch from backend
    apiClient.get(`/telemetry/saved-analyses/${DEVICE_ID}`)
      .then(res => {
        if (Array.isArray(res.data)) {
          const mapped = res.data.map(row => ({
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
            cropRecommendation: row.recommended_crop || 'Pending evaluation',
          }));
          setSavedAnalyses(mapped);
          window.localStorage.setItem('smart-agri-saved-analyses', JSON.stringify(mapped));
        }
      })
      .catch(err => console.warn('Failed to fetch saved analyses', err));
  }, []);

  const handleToggleSelection = (id: string) => {
    setSelectedIds(current => current.includes(id) ? current.filter(i => i !== id) : [...current, id]);
  };

  const handleDeleteSelected = () => {
    if (selectedIds.length === 0) return;
    setDeletePassword('');
    setDeleteError('');
    setDeleteModalOpen(true);
  };

  const confirmDeleteSelected = async () => {
    setIsDeleting(true);
    setDeleteError('');
    let userEmail = 'admin@smartagri.io';
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('userAccount');
      if (stored) {
        try { userEmail = JSON.parse(stored).email || JSON.parse(stored).username || userEmail; } catch {}
      }
    }
    try {
      const authRes = await apiClient.post('/telemetry/auth/verify-system-control', {
        emailOrUsername: userEmail,
        password: deletePassword,
      });
      if (!authRes.data?.success) {
        setDeleteError(authRes.data?.message || 'Invalid System Control security password.');
        setIsDeleting(false);
        return;
      }
    } catch (err: any) {
      setDeleteError(err?.response?.data?.message || 'Failed to verify password.');
      setIsDeleting(false);
      return;
    }
    // Delete from server for UUID ids
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const idsForServer = selectedIds.filter(id => uuidRegex.test(id));
    try {
      if (idsForServer.length > 0) await apiClient.post('/telemetry/delete-analysis', { ids: idsForServer });
      const remaining = savedAnalyses.filter(item => !selectedIds.includes(item.id));
      setSavedAnalyses(remaining);
      setSelectedIds([]);
      window.localStorage.setItem('smart-agri-saved-analyses', JSON.stringify(remaining));
    } catch {
      setDeleteError('Failed to delete selected analyses.');
    } finally {
      setIsDeleting(false);
      setDeleteModalOpen(false);
    }
  };

  const handleEvaluateSavedRow = async (item: SavedAnalysis, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await apiClient.post('/ai/evaluate-crop', {
        deviceId: DEVICE_ID,
        cropName: item.cropLabel || 'Tomato',
        soilMetrics: {
          ph: item.soilMetrics.ph ?? 7.0,
          moisture: item.soilMetrics.moisture ?? 50,
          conductivity: item.soilMetrics.conductivity ?? 1.0,
          temperature: item.soilMetrics.temperature ?? 25,
        },
      });
      const evalData = res.data;
      if (evalData?.error) {
        alert(`Error evaluating row: ${evalData.error}`);
        return;
      }
      setSavedAnalyses(prev => prev.map(r => r.id === item.id ? { ...r, cropRecommendation: `${evalData.recommended_crop} (Score: ${evalData.recommended_crop_reference_score}/100)` } : r));
    } catch (err) {
      console.error('Evaluation failed', err);
    }
  };

  const handleCalibrateSensors = async () => {
    setActiveAction('Calibrate Sensors Active');
    try {
      const res = await apiClient.get(`/telemetry/latest/${DEVICE_ID}`);
      const latest = res.data;
      if (latest) {
        console.log('Calibration data:', latest);
      }
    } catch (err) {
      console.error('Calibration sync failed', err);
    }
  };

  const filteredAnalyses = useMemo(() => {
    if (!searchQuery.trim()) return savedAnalyses;
    const lowerQuery = searchQuery.toLowerCase();
    return savedAnalyses.filter(item => 
      item.label.toLowerCase().includes(lowerQuery) || 
      (item.cropLabel && item.cropLabel.toLowerCase().includes(lowerQuery)) ||
      (item.cropRecommendation && item.cropRecommendation.toLowerCase().includes(lowerQuery))
    );
  }, [savedAnalyses, searchQuery]);

  const kpis = useMemo(() => {
    if (savedAnalyses.length === 0) return { avgMoisture: '0.0', avgPh: 0, topCrop: 'N/A' };
    let totalMoisture = 0;
    let totalPh = 0;
    const cropCounts: Record<string, number> = {};

    savedAnalyses.forEach(item => {
      totalMoisture += Number(item.soilMetrics.moisture) || 0;
      totalPh += Number(item.soilMetrics.ph) || 0;
      const crop = item.cropLabel || 'Unknown';
      cropCounts[crop] = (cropCounts[crop] || 0) + 1;
    });

    const topCrop = Object.keys(cropCounts).reduce((a, b) => cropCounts[a] > cropCounts[b] ? a : b, 'None');
    
    return {
      avgMoisture: (totalMoisture / savedAnalyses.length).toFixed(1),
      avgPh: Number((totalPh / savedAnalyses.length).toFixed(1)),
      topCrop: topCrop
    };
  }, [savedAnalyses]);

  return (
    <div className="min-h-full flex flex-col p-4 md:p-8 animate-fade-in w-full max-w-[1600px] mx-auto gap-8">
      {/* Top Dashboard Card */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col gap-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative">
          <div className="flex items-center gap-3 relative z-10">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center shadow-md shadow-blue-500/20 border border-white/20">
              <Map className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-br from-slate-900 to-slate-600 dark:from-white dark:to-slate-300 tracking-tight">
                Farm Soil Map
              </h1>
              <p className="text-slate-500 dark:text-slate-400 font-medium text-xs md:text-sm mt-0.5">
                High-resolution drone orthomosaic integrated with live soil telemetry
              </p>
          </div>
        </div>
        <div className="flex items-center gap-3 relative z-10">
          <div className="relative group cursor-default">
            <div className="absolute inset-0 bg-emerald-500/20 blur-xl rounded-full group-hover:bg-emerald-500/30 transition-all duration-300"></div>
            <span className="relative px-4 py-2.5 rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md text-emerald-600 dark:text-emerald-400 text-xs font-bold uppercase tracking-widest border border-emerald-200/50 dark:border-emerald-500/30 flex items-center gap-2.5 shadow-sm transition-transform hover:scale-105 duration-300">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
              {activeAction}
            </span>
          </div>
        </div>
      </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="relative overflow-hidden bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-100/50 dark:border-slate-700/50 transition-all hover:shadow-sm hover:-translate-y-0.5 duration-300 group">
            <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-5 transition-opacity duration-500">
              <Database className="w-12 h-12 transform translate-x-2 -translate-y-2" />
            </div>
            <div className="flex items-center gap-2.5 mb-2 relative z-10">
              <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-900/40 border border-blue-200 dark:border-blue-800 flex items-center justify-center text-blue-600 dark:text-blue-400">
                <Database className="w-3.5 h-3.5" />
              </div>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Samples</p>
            </div>
            <p className="text-2xl font-bold text-slate-800 dark:text-white tracking-tight relative z-10">{savedAnalyses.length}</p>
          </div>
        
          <div className="relative overflow-hidden bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-100/50 dark:border-slate-700/50 transition-all hover:shadow-sm hover:-translate-y-0.5 duration-300 group">
            <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-5 transition-opacity duration-500">
              <Droplets className="w-12 h-12 transform translate-x-2 -translate-y-2" />
            </div>
            <div className="flex items-center gap-2.5 mb-2 relative z-10">
              <div className="w-7 h-7 rounded-lg bg-cyan-100 dark:bg-cyan-900/40 border border-cyan-200 dark:border-cyan-800 flex items-center justify-center text-cyan-600 dark:text-cyan-400">
                <Droplets className="w-3.5 h-3.5" />
              </div>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Avg Moisture</p>
            </div>
            <p className="text-2xl font-bold text-slate-800 dark:text-white tracking-tight relative z-10">{kpis.avgMoisture}<span className="text-sm text-slate-400 ml-0.5">%</span></p>
          </div>

          <div className="relative overflow-hidden bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-100/50 dark:border-slate-700/50 transition-all hover:shadow-sm hover:-translate-y-0.5 duration-300 group">
            <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-5 transition-opacity duration-500">
              <FlaskConical className="w-12 h-12 transform translate-x-2 -translate-y-2" />
            </div>
            <div className="flex items-center gap-2.5 mb-2 relative z-10">
              <div className="w-7 h-7 rounded-lg bg-purple-100 dark:bg-purple-900/40 border border-purple-200 dark:border-purple-800 flex items-center justify-center text-purple-600 dark:text-purple-400">
                <FlaskConical className="w-3.5 h-3.5" />
              </div>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Avg pH Level</p>
            </div>
            <div className="flex items-center gap-2 relative z-10">
              <p className="text-2xl font-bold text-slate-800 dark:text-white tracking-tight leading-none">{kpis.avgPh}</p>
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-widest border ${kpis.avgPh >= 6.0 && kpis.avgPh <= 7.5 ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-orange-100 text-orange-700 border-orange-200'}`}>
                {kpis.avgPh >= 6.0 && kpis.avgPh <= 7.5 ? 'Optimal' : 'Needs Check'}
              </span>
            </div>
          </div>

          <div className="relative overflow-hidden bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-100/50 dark:border-slate-700/50 transition-all hover:shadow-sm hover:-translate-y-0.5 duration-300 group">
            <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-5 transition-opacity duration-500">
              <Sprout className="w-12 h-12 transform translate-x-2 -translate-y-2" />
            </div>
            <div className="flex items-center gap-2.5 mb-2 relative z-10">
              <div className="w-7 h-7 rounded-lg bg-green-100 dark:bg-green-900/40 border border-green-200 dark:border-green-800 flex items-center justify-center text-green-600 dark:text-green-400">
                <Sprout className="w-3.5 h-3.5" />
              </div>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Top Crop</p>
            </div>
            <p className="text-xl font-bold text-slate-800 dark:text-white tracking-tight truncate relative z-10">{kpis.topCrop}</p>
          </div>
        </div>
      </div>

      
      {/* Map Container */}
      <div className="flex-1 w-full min-h-[60vh] relative z-0 flex flex-col bg-slate-100 dark:bg-slate-900 rounded-3xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:shadow-[0_8px_40px_rgb(0,0,0,0.08)]">
        <FarmMapClient mapLayer={mapLayer} />
        <div className="absolute bottom-6 left-6 z-[400] bg-white/60 dark:bg-slate-900/60 backdrop-blur-md px-4 py-2 rounded-2xl shadow-lg border border-white/40 dark:border-slate-700/50 pointer-events-none">
          <p className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-widest opacity-80">Interactive Map View</p>
        </div>
      </div>
      
      {/* New Widgets Row */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-5 flex items-center gap-2">
          <Wrench className="w-5 h-5 text-indigo-500" />
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button 
            onClick={() => {
              setActiveAction(mapLayer === 'drone' ? 'OpenStreetMap Active' : 'Drone Orthomosaic Active');
              setMapLayer(prev => prev === 'drone' ? 'osm' : 'drone');
            }}
            className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 hover:bg-indigo-50 dark:bg-slate-800/50 dark:hover:bg-indigo-900/30 border border-slate-100 dark:border-slate-700 hover:border-indigo-200 dark:hover:border-indigo-800 transition-all group text-left"
          >
            <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 shadow-sm border border-slate-100 dark:border-slate-700 flex items-center justify-center text-slate-500 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800 dark:text-white group-hover:text-indigo-700 dark:group-hover:text-indigo-300 transition-colors">Toggle Map View</p>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">Switch satellite / map</p>
            </div>
          </button>
          <button 
            onClick={handleCalibrateSensors}
            className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 hover:bg-emerald-50 dark:bg-slate-800/50 dark:hover:bg-emerald-900/30 border border-slate-100 dark:border-slate-700 hover:border-emerald-200 dark:hover:border-emerald-800 transition-all group text-left"
          >
            <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 shadow-sm border border-slate-100 dark:border-slate-700 flex items-center justify-center text-slate-500 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
              <Crosshair className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800 dark:text-white group-hover:text-emerald-700 dark:group-hover:text-emerald-300 transition-colors">Calibrate Sensors</p>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">Sync with nodes</p>
            </div>
          </button>
          <button 
            onClick={() => setActiveAction('Load Sample Locations Active')}
            className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 hover:bg-blue-50 dark:bg-slate-800/50 dark:hover:bg-blue-900/30 border border-slate-100 dark:border-slate-700 hover:border-blue-200 dark:hover:border-blue-800 transition-all group text-left"
          >
            <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 shadow-sm border border-slate-100 dark:border-slate-700 flex items-center justify-center text-slate-500 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800 dark:text-white group-hover:text-blue-700 dark:group-hover:text-blue-300 transition-colors">Load Sample Locations</p>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">View history on map</p>
            </div>
          </button>
        </div>
      </div>
      
      {/* Advanced Saved Analyses Section */}
      <section className="rounded-3xl p-6 md:p-8 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm relative z-10 transition hover:shadow-md duration-300">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Database className="w-5 h-5 text-blue-500" />
              Analysis Records
            </h2>
            <p className="text-sm mt-1.5 text-slate-500 dark:text-slate-400">
              Manage and review your saved soil metrics and ML crop recommendations.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
            <div className="relative group">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
              <input
                type="text"
                placeholder="Search records..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full sm:w-64 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
              />
            </div>
            <button
              onClick={handleDeleteSelected}
              disabled={selectedIds.length === 0}
              className="flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20"
            >
              <Trash2 className="w-4 h-4" />
              Delete ({selectedIds.length})
            </button>
          </div>
        </div>

        {savedAnalyses.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 bg-slate-50 dark:bg-slate-950/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
            <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4 text-slate-400">
              <Database className="w-8 h-8" />
            </div>
            <p className="text-lg font-bold text-slate-700 dark:text-slate-300">No records found</p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-sm text-center">Your saved soil analyses and crop recommendations will appear here.</p>
          </div>
        ) : filteredAnalyses.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 bg-slate-50 dark:bg-slate-950/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
            <p className="text-slate-500 font-medium">No records match your search query.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-100 dark:border-slate-800 max-h-[500px] overflow-y-auto custom-scrollbar relative">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-500 dark:text-slate-400 uppercase bg-slate-50/90 dark:bg-slate-900/90 backdrop-blur-md sticky top-0 z-20">
                <tr>
                  <th className="px-4 py-4 font-bold border-b border-slate-200 dark:border-slate-800">Label</th>
                  <th className="px-4 py-4 font-bold border-b border-slate-200 dark:border-slate-800">Target Crop</th>
                  <th className="px-4 py-4 font-bold border-b border-slate-200 dark:border-slate-800">Date Saved</th>
                  <th className="px-4 py-4 font-bold border-b border-slate-200 dark:border-slate-800">Moisture</th>
                  <th className="px-4 py-4 font-bold border-b border-slate-200 dark:border-slate-800">pH Level</th>
                  <th className="px-4 py-4 font-bold border-b border-slate-200 dark:border-slate-800">NPK</th>
                  <th className="px-4 py-4 font-bold border-b border-slate-200 dark:border-slate-800">Recommendation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredAnalyses.map(item => {
                  const isSelected = selectedIds.includes(item.id);
                  const phVal = Number(item.soilMetrics.ph);
                  const isPhOptimal = phVal >= 6.0 && phVal <= 7.5;
                  
                  return (
                    <tr
                      key={item.id}
                      onClick={() => handleToggleSelection(item.id)}
                      className={`transition-all duration-200 cursor-pointer group ${isSelected ? 'bg-blue-50/50 dark:bg-blue-900/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
                    >
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors shrink-0 ${isSelected ? 'bg-blue-500 border-blue-500' : 'border-slate-300 dark:border-slate-600 group-hover:border-blue-400'}`}>
                            {isSelected && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"/></svg>}
                          </div>
                          <span className="font-bold text-slate-800 dark:text-slate-200 truncate">{item.label}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs border border-slate-200 dark:border-slate-700 whitespace-nowrap">
                          {(() => {
                            const crop = CROP_OPTIONS_DATA.find(c => c.id === item.cropLabel);
                            return crop ? <>{crop.icon} <span className="ml-1">{crop.name}</span></> : (item.cropLabel || 'None');
                          })()}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-slate-500 dark:text-slate-400 text-xs font-medium whitespace-nowrap">
                        {new Date(item.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                        <span className="block opacity-75">{new Date(item.createdAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</span>
                      </td>
                      <td className="px-4 py-4">
                        <span className="font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap">{formatMetricValue(item.soilMetrics.moisture)}%</span>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border whitespace-nowrap ${isPhOptimal ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20' : 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-500/10 dark:text-orange-400 dark:border-orange-500/20'}`}>
                          {formatMetricValue(item.soilMetrics.ph)}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-xs">
                        <div className="flex items-center gap-2 whitespace-nowrap">
                          <div className="flex flex-col text-slate-400 font-bold"><span className="text-[9px] uppercase leading-none">N</span> <span className="text-slate-700 dark:text-slate-300">{formatMetricValue(item.soilMetrics.nitrogen)}</span></div>
                          <div className="w-px h-6 bg-slate-200 dark:bg-slate-700"></div>
                          <div className="flex flex-col text-slate-400 font-bold"><span className="text-[9px] uppercase leading-none">P</span> <span className="text-slate-700 dark:text-slate-300">{formatMetricValue(item.soilMetrics.phosphorus)}</span></div>
                          <div className="w-px h-6 bg-slate-200 dark:bg-slate-700"></div>
                          <div className="flex flex-col text-slate-400 font-bold"><span className="text-[9px] uppercase leading-none">K</span> <span className="text-slate-700 dark:text-slate-300">{formatMetricValue(item.soilMetrics.potassium)}</span></div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className="font-semibold text-slate-700 dark:text-slate-200 line-clamp-2 leading-tight">
                          {item.cropRecommendation}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Delete Confirmation Modal */}
      {deleteModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200 px-4">
          <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-8 max-w-md w-full shadow-2xl border border-slate-100 dark:border-slate-800 scale-in-center">
            <div className="w-12 h-12 rounded-2xl bg-red-50 dark:bg-red-500/10 flex items-center justify-center text-red-500 mb-5">
              <Trash2 className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Delete {selectedIds.length} Record{selectedIds.length > 1 ? 's' : ''}?</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
              This action requires authorization. Please enter the System Control security password to confirm deletion.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Security Password</label>
                <input
                  type="password"
                  value={deletePassword}
                  onChange={e => setDeletePassword(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && deletePassword && !isDeleting) confirmDeleteSelected(); }}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-4 py-3 text-sm focus:border-red-500 focus:ring-2 focus:ring-red-500/20 outline-none transition-all"
                  placeholder="Enter password..."
                  autoFocus
                />
                {deleteError && <p className="text-red-500 text-xs font-semibold mt-2 animate-in slide-in-from-top-1">{deleteError}</p>}
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 mt-8">
              <button
                onClick={() => setDeleteModalOpen(false)}
                disabled={isDeleting}
                className="px-5 py-2.5 rounded-xl text-sm font-bold transition hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteSelected}
                disabled={!deletePassword || isDeleting}
                className="px-5 py-2.5 rounded-xl text-sm font-bold transition bg-red-500 hover:bg-red-600 text-white disabled:opacity-50 shadow-md shadow-red-500/20 flex items-center gap-2"
              >
                {isDeleting ? (
                  <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                ) : null}
                {isDeleting ? 'Deleting...' : 'Authorize Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import React from 'react';
import dynamic from 'next/dynamic';

// Disable SSR for Leaflet map since it requires the window object
const FarmMapClient = dynamic(() => import('@/components/FarmMapClient'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-[500px] w-full items-center justify-center bg-slate-50 dark:bg-slate-900 rounded-[1.5rem] border border-slate-200 dark:border-slate-800">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm text-slate-500 font-medium">Initializing Map Engine...</p>
      </div>
    </div>
  ),
});

export default function FarmMapPage() {
  return (
    <div className="h-full flex flex-col p-6 animate-fade-in w-full max-w-[1600px] mx-auto gap-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Farm Soil Map</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">High-resolution drone orthomosaic with soil sample telemetry</p>
        </div>
      </div>
      
      <div className="flex-1 w-full min-h-[60vh] rounded-[1.5rem] shadow-sm bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 relative z-0">
        <FarmMapClient />
      </div>
    </div>
  );
}

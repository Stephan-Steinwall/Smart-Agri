// src/components/WeatherWidget.tsx
"use client";

import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { Cloud, Sun, CloudRain, Wind, Thermometer, CloudSnow, CloudLightning, Loader2, MapPin } from 'lucide-react';

// Default coordinates (e.g., Central Valley, CA)
const LATITUDE = 36.73;
const LONGITUDE = -119.78;

// Maps WMO Weather codes to Lucide icons
const getWeatherIcon = (code: number, isDay: number) => {
  if (code === 0) return isDay ? <Sun className="w-7 h-7 text-yellow-300 drop-shadow-md" /> : <Cloud className="w-7 h-7 text-gray-300 drop-shadow-md" />;
  if (code >= 1 && code <= 3) return <Cloud className="w-7 h-7 text-gray-200 drop-shadow-md" />;
  if (code >= 51 && code <= 67) return <CloudRain className="w-7 h-7 text-blue-300 drop-shadow-md" />;
  if (code >= 71 && code <= 77) return <CloudSnow className="w-7 h-7 text-white drop-shadow-md" />;
  if (code >= 95 && code <= 99) return <CloudLightning className="w-7 h-7 text-yellow-400 drop-shadow-md" />;
  return <Cloud className="w-7 h-7 text-gray-200 drop-shadow-md" />; // Fallback
};

// Maps WMO Weather codes to Text
const getWeatherText = (code: number) => {
  if (code === 0) return "Clear Sky";
  if (code === 1) return "Mostly Clear";
  if (code === 2) return "Partly Cloudy";
  if (code === 3) return "Overcast";
  if (code >= 45 && code <= 48) return "Fog";
  if (code >= 51 && code <= 55) return "Drizzle";
  if (code >= 61 && code <= 67) return "Rain";
  if (code >= 71 && code <= 77) return "Snow";
  if (code >= 80 && code <= 82) return "Rain Showers";
  if (code >= 95 && code <= 99) return "Thunderstorm";
  return "Cloudy";
};

export default function WeatherWidget() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['currentWeather', LATITUDE, LONGITUDE],
    queryFn: async () => {
      const res = await axios.get(
        `https://api.open-meteo.com/v1/forecast?latitude=${LATITUDE}&longitude=${LONGITUDE}&current_weather=true`
      );
      return res.data.current_weather;
    },
    refetchInterval: 300000, // Refresh every 5 minutes
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 opacity-70 bg-black/20 rounded-xl px-4 py-3 backdrop-blur-sm border border-white/10 min-w-[200px] justify-center">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm font-medium">Fetching weather...</span>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="text-sm opacity-70 bg-black/20 rounded-xl px-4 py-3 backdrop-blur-sm border border-white/10">
        Weather data unavailable
      </div>
    );
  }

  const { temperature, windspeed, weathercode, is_day } = data;

  return (
    <div className="flex items-center gap-5 bg-black/20 rounded-xl px-5 py-3 backdrop-blur-sm border border-white/10 shadow-lg hover:bg-black/30 transition-colors cursor-default">
      <div className="flex items-center gap-3">
        {getWeatherIcon(weathercode, is_day)}
        <div className="flex flex-col">
          <p className="text-xl font-bold leading-none tracking-tight">{temperature}°C</p>
          <p className="text-[11px] font-medium uppercase tracking-wider opacity-90 mt-1">{getWeatherText(weathercode)}</p>
        </div>
      </div>

      <div className="w-px h-10 bg-white/20"></div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2 text-xs opacity-90 font-medium">
          <Wind className="w-3.5 h-3.5" />
          <span>{windspeed} km/h wind</span>
        </div>
        <div className="flex items-center gap-2 text-xs opacity-90 font-medium">
          <MapPin className="w-3.5 h-3.5" />
          <span>Central Valley</span>
        </div>
      </div>
    </div>
  );
}

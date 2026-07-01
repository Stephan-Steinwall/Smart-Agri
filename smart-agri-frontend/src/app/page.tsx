"use client";

import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Droplets, Thermometer, FlaskConical, Wifi, WifiOff } from 'lucide-react';

const API_BASE = 'http://localhost:3001/api/v1';

export default function Dashboard() {

  // Step 1: Fetch all devices to dynamically get the first sensor node UUID
  const { data: devices, isLoading: devicesLoading, isError: devicesError } = useQuery({
    queryKey: ['devices'],
    queryFn: async () => {
      const res = await axios.get(`${API_BASE}/devices`);
      return res.data;
    },
    retry: 2,
  });

  // Pick the first device UUID from the list (or fallback to null)
  const deviceId = devices?.[0]?.id ?? null;

  // Step 2: Fetch historical telemetry once we have a device ID
  const { data: history, isLoading: historyLoading, isError: historyError } = useQuery({
    queryKey: ['telemetryHistory', deviceId],
    queryFn: async () => {
      const res = await axios.get(`${API_BASE}/telemetry/history/${deviceId}`);
      return res.data;
    },
    enabled: !!deviceId, // Only runs when we actually have a device ID
    retry: 2,
  });

  const isLoading = devicesLoading || historyLoading;
  const isError = devicesError || historyError;
  const latest = history?.[history.length - 1];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground animate-pulse">Loading Agronomy Data...</p>
        </div>
      </div>
    );
  }

  if (isError || !deviceId) {
    return (
      <div className="flex items-center justify-center h-full">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-3">
            <WifiOff className="w-12 h-12 text-destructive mx-auto" />
            <h2 className="text-lg font-semibold text-foreground">Cannot Connect to Backend</h2>
            <p className="text-sm text-muted-foreground">
              Ensure the backend is running on <code className="bg-muted px-1 rounded">http://localhost:3001</code> and the database is seeded.
            </p>
            {!deviceId && !devicesError && (
              <p className="text-xs text-amber-500">No devices found in the database. Run the seeder first.</p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Connection Status */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Wifi className="w-3 h-3 text-green-500" />
        <span>Live · Device <code className="bg-muted px-1 rounded text-[10px]">{deviceId}</code></span>
      </div>

      {/* Top Value Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Soil Moisture</CardTitle>
            <Droplets className="w-4 h-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{latest?.moisture?.toFixed(1) ?? '--'}%</div>
            <p className="text-xs text-muted-foreground mt-1">Status: {latest?.moisture > 50 ? 'Optimal' : 'Low — check irrigation'}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Temperature</CardTitle>
            <Thermometer className="w-4 h-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{latest?.temperature?.toFixed(1) ?? '--'}°C</div>
            <p className="text-xs text-muted-foreground mt-1">Status: {latest?.temperature < 30 ? 'Normal' : 'High'}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Nitrogen Level</CardTitle>
            <FlaskConical className="w-4 h-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{latest?.nitrogen?.toFixed(1) ?? '--'} ppm</div>
            <p className="text-xs text-muted-foreground mt-1">{latest?.nitrogen > 40 ? 'Healthy' : 'Depleting slowly'}</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Chart */}
      <Card className="col-span-4">
        <CardHeader>
          <CardTitle>Moisture &amp; Temperature Trends (Last 50 Readings)</CardTitle>
        </CardHeader>
        <CardContent className="h-[400px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={history} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis
                dataKey="time"
                tickFormatter={(time) => new Date(time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
              />
              <YAxis yAxisId="left" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis yAxisId="right" orientation="right" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <Tooltip
                contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                labelFormatter={(label) => new Date(label).toLocaleString()}
              />
              <Line yAxisId="left" type="monotone" dataKey="moisture" stroke="#3b82f6" strokeWidth={3} dot={false} name="Moisture (%)" />
              <Line yAxisId="right" type="monotone" dataKey="temperature" stroke="#f97316" strokeWidth={2} dot={false} name="Temp (°C)" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
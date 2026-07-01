"use client";

import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Droplets, Thermometer, FlaskConical } from 'lucide-react';

// The Mock Device ID we generated in the seeder
const MOCK_DEVICE_ID = 'AA:BB:CC:DD:EE:02'; // Update this if your DB generated a UUID instead of MAC for the ID, check your DB!
// Actually, in our seeder, the ID is a UUID. 
// For this test to work instantly, let's fetch the first device's data from a real query, but for now, you might need to check your database for the exact UUID of the node. 
// Assuming you grab a UUID from your database, replace it below.

export default function Dashboard() {

  // Fetch Historical Data
  const { data: history, isLoading } = useQuery({
    queryKey: ['telemetryHistory'],
    queryFn: async () => {
      // NOTE: You must replace 'YOUR-DEVICE-UUID' with the actual UUID from your PostgreSQL "devices" table
      // You can find it by looking at your console logs from the seeder, or checking pgAdmin/DBeaver.
      const res = await axios.get(`http://localhost:3001/api/v1/telemetry/history/76582540-74ee-41a5-bbb1-f5d1a281b562`);
      return res.data;
    }
  });

  if (isLoading) return <div className="p-8 text-muted-foreground animate-pulse">Loading Agronomy Data...</div>;

  return (
    <div className="space-y-6">
      {/* Top Value Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Soil Moisture</CardTitle>
            <Droplets className="w-4 h-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{history?.[history.length - 1]?.moisture ?? '--'}%</div>
            <p className="text-xs text-muted-foreground mt-1">Status: Optimal</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Temperature</CardTitle>
            <Thermometer className="w-4 h-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{history?.[history.length - 1]?.temperature ?? '--'}°C</div>
            <p className="text-xs text-muted-foreground mt-1">Status: Normal</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Nitrogen Level</CardTitle>
            <FlaskConical className="w-4 h-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{history?.[history.length - 1]?.nitrogen ?? '--'} ppm</div>
            <p className="text-xs text-muted-foreground mt-1">Depleting slowly</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Chart */}
      <Card className="col-span-4">
        <CardHeader>
          <CardTitle>Moisture & Temperature Trends (Last 12 Hours)</CardTitle>
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
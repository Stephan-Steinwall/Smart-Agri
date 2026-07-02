"use client";

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Switch } from '@/components/ui/switch';
import {
  Power, Activity, Zap, WifiOff, Loader2,
  Clock, ArrowRight, Settings2
} from 'lucide-react';
import { useFarmStore } from '@/store/useFarmStore';

const API_BASE = 'http://localhost:3001/api/v1';

// ── Reusable "empty / error" state ────────────────────────────────────────
function EmptyState({
  icon: Icon, iconColor, iconBg, title, description
}: {
  icon: React.ElementType; iconColor: string; iconBg: string;
  title: string; description: string;
}) {
  return (
    <div className="flex items-center justify-center h-full min-h-[300px]">
      <div
        className="max-w-sm w-full rounded-2xl p-8 text-center animate-fade-in"
        style={{ background: 'var(--card)', boxShadow: 'var(--shadow-card)', border: '1px solid var(--border)' }}
      >
        <div
          className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
          style={{ background: iconBg }}
        >
          <Icon className="w-7 h-7" style={{ color: iconColor }} />
        </div>
        <h2 className="text-base font-bold mb-1.5" style={{ color: 'var(--foreground)' }}>{title}</h2>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>{description}</p>
      </div>
    </div>
  );
}

// ── Device card ────────────────────────────────────────────────────────────
function DeviceCard({
  device,
  onToggle,
  isPending
}: {
  device: any;
  onToggle: (id: string, on: boolean) => void;
  isPending: boolean;
}) {
  const isOn = device.isOn;
  const isAiMode = device.mode === 'AI_AUTO';

  return (
    <div
      className="rounded-2xl p-5 card-lift animate-fade-in transition-all duration-300"
      style={{
        background: 'var(--card)',
        border: isOn ? '1.5px solid hsl(142, 65%, 70%)' : '1px solid var(--border)',
        boxShadow: isOn
          ? '0 0 0 3px hsl(142, 65%, 92%), var(--shadow-card)'
          : 'var(--shadow-card)',
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-bold text-sm" style={{ color: 'var(--foreground)' }}>{device.name}</h3>
          <div className="flex items-center gap-1.5 mt-1">
            <Zap className="w-3 h-3" style={{ color: isAiMode ? 'hsl(280, 60%, 55%)' : 'var(--muted-foreground)' }} />
            <span
              className="text-[10px] font-semibold uppercase tracking-wider"
              style={{ color: isAiMode ? 'hsl(280, 60%, 50%)' : 'var(--muted-foreground)' }}
            >
              {device.mode?.replace('_', ' ')}
            </span>
          </div>
        </div>

        {/* Status icon */}
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{
            background: isOn ? 'hsl(142, 65%, 93%)' : 'var(--muted)',
          }}
        >
          <Power
            className="w-4 h-4"
            style={{ color: isOn ? 'hsl(142, 65%, 35%)' : 'var(--muted-foreground)' }}
          />
        </div>
      </div>

      {/* Status + Switch */}
      <div className="flex items-center justify-between">
        <div>
          <span
            className="text-xs font-semibold uppercase tracking-wide"
            style={{ color: 'var(--muted-foreground)' }}
          >
            Status:{' '}
          </span>
          <span
            className="text-xs font-bold"
            style={{ color: isOn ? 'hsl(142, 65%, 32%)' : 'var(--muted-foreground)' }}
          >
            {isOn ? '● RUNNING' : '○ OFF'}
          </span>
        </div>

        <Switch
          checked={isOn}
          disabled={isPending}
          onCheckedChange={(checked) => onToggle(device.id, checked)}
          className="data-[state=checked]:bg-green-600"
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function AutomationDashboard() {
  const queryClient = useQueryClient();
  const { activeFieldId, activeFieldName } = useFarmStore();

  const { data: devices, isLoading, isError } = useQuery({
    queryKey: ['automation', activeFieldId],
    queryFn: async () => {
      const res = await axios.get(`${API_BASE}/automation/field/${activeFieldId}`);
      return res.data;
    },
    enabled: !!activeFieldId,
    retry: 2,
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ deviceId, turnOn }: { deviceId: string; turnOn: boolean }) => {
      const res = await axios.post(`${API_BASE}/automation/toggle`, { deviceId, turnOn });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automation', activeFieldId] });
    },
  });

  // All activity logs across devices, sorted newest first
  const allLogs = devices
    ?.flatMap((d: any) => (d.logs ?? []).map((l: any) => ({ ...l, deviceName: d.name })))
    .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()) ?? [];

  // ── Guard states ─────────────────────────────────────────────────────────
  if (!activeFieldId) {
    return (
      <EmptyState
        icon={Settings2}
        iconColor="var(--muted-foreground)"
        iconBg="var(--muted)"
        title="No Field Selected"
        description="Use the field selector in the header to choose an active field."
      />
    );
  }
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-4">
          <div
            className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center"
            style={{ background: 'hsl(142, 40%, 94%)' }}
          >
            <Loader2 className="w-7 h-7 animate-spin" style={{ color: 'var(--primary)' }} />
          </div>
          <p className="text-sm font-medium" style={{ color: 'var(--muted-foreground)' }}>
            Loading Automation Systems...
          </p>
        </div>
      </div>
    );
  }
  if (isError) {
    return (
      <EmptyState
        icon={WifiOff}
        iconColor="hsl(4, 80%, 52%)"
        iconBg="hsl(4, 80%, 96%)"
        title="Cannot Load Automation Data"
        description="Ensure the backend is running on http://localhost:3001 and the database is seeded."
      />
    );
  }

  // ── Main view ────────────────────────────────────────────────────────────
  return (
    <div className="space-y-8 animate-fade-in">

      {/* Page header */}
      <div>
        <h2 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>
          Automation Control
        </h2>
        <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
          Managing irrigation & fertigation for{' '}
          <span className="font-semibold" style={{ color: 'var(--foreground)' }}>{activeFieldName}</span>
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Device controllers ────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-5">
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: 'hsl(142, 40%, 94%)' }}
            >
              <Settings2 className="w-3.5 h-3.5" style={{ color: 'var(--primary)' }} />
            </div>
            <h3 className="font-bold text-sm" style={{ color: 'var(--foreground)' }}>
              Device Controllers
            </h3>
            <span
              className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full"
              style={{ background: 'hsl(142, 40%, 94%)', color: 'var(--primary)' }}
            >
              {devices?.length ?? 0} device{devices?.length !== 1 ? 's' : ''}
            </span>
          </div>

          {(!devices || devices.length === 0) ? (
            <div
              className="rounded-2xl p-10 text-center"
              style={{
                background: 'var(--card)',
                border: '1px dashed var(--border)',
                boxShadow: 'var(--shadow-card)',
              }}
            >
              <Power className="w-9 h-9 mx-auto mb-3 opacity-20" style={{ color: 'var(--foreground)' }} />
              <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                No automation devices found
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>
                Register automation devices for this field to control them here.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {devices.map((device: any) => (
                <DeviceCard
                  key={device.id}
                  device={device}
                  isPending={toggleMutation.isPending}
                  onToggle={(id, on) => toggleMutation.mutate({ deviceId: id, turnOn: on })}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── Activity log ──────────────────────────────────────────────── */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: 'hsl(210, 68%, 95%)' }}
            >
              <Activity className="w-3.5 h-3.5" style={{ color: 'hsl(210, 68%, 48%)' }} />
            </div>
            <h3 className="font-bold text-sm" style={{ color: 'var(--foreground)' }}>
              Activity Log
            </h3>
          </div>

          <div
            className="rounded-2xl overflow-hidden"
            style={{
              background: 'var(--card)',
              boxShadow: 'var(--shadow-card)',
              border: '1px solid var(--border)',
              maxHeight: '480px',
            }}
          >
            {allLogs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 gap-3">
                <Clock className="w-8 h-8 opacity-15" style={{ color: 'var(--foreground)' }} />
                <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>No recent activity</p>
              </div>
            ) : (
              <div className="overflow-y-auto" style={{ maxHeight: '480px' }}>
                {allLogs.map((log: any, i: number) => (
                  <div
                    key={log.id ?? i}
                    className="flex items-start gap-3 px-4 py-3.5 transition-colors duration-100"
                    style={{ borderBottom: '1px solid var(--border)' }}
                  >
                    {/* ON/OFF indicator */}
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{
                        background: log.action ? 'hsl(142, 65%, 93%)' : 'hsl(4, 80%, 96%)',
                      }}
                    >
                      <ArrowRight
                        className="w-3.5 h-3.5"
                        style={{ color: log.action ? 'hsl(142, 65%, 35%)' : 'hsl(4, 80%, 52%)' }}
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold truncate" style={{ color: 'var(--foreground)' }}>
                          {log.deviceName ?? 'Device'}
                        </span>
                        <span
                          className="text-[10px] font-bold uppercase flex-shrink-0"
                          style={{ color: log.action ? 'hsl(142, 65%, 32%)' : 'hsl(4, 80%, 52%)' }}
                        >
                          {log.action ? 'ON' : 'OFF'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-0.5">
                        <span className="text-[11px]" style={{ color: 'var(--muted-foreground)' }}>
                          {log.triggeredBy}
                        </span>
                        <span className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>
                          {new Date(log.timestamp).toLocaleTimeString([], {
                            hour: '2-digit', minute: '2-digit'
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
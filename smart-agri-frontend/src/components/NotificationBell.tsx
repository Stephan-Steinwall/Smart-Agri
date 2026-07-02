"use client";

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Bell, AlertTriangle, Info, AlertCircle, CheckCheck, BellOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';

type AlertSeverity = 'CRITICAL' | 'WARNING' | 'INFO';

interface Alert {
  id: string;
  message: string;
  severity: AlertSeverity;
  timestamp: string;
}

function getSeverityConfig(severity: AlertSeverity) {
  switch (severity) {
    case 'CRITICAL':
      return {
        icon: <AlertTriangle className="w-4 h-4 flex-shrink-0" style={{ color: 'hsl(4, 80%, 52%)' }} />,
        border: 'hsl(4, 80%, 52%)',
        bg: 'hsl(4, 80%, 98%)',
        label: 'Critical',
        labelColor: 'hsl(4, 80%, 45%)',
      };
    case 'WARNING':
      return {
        icon: <AlertCircle className="w-4 h-4 flex-shrink-0" style={{ color: 'hsl(38, 85%, 45%)' }} />,
        border: 'hsl(38, 85%, 50%)',
        bg: 'hsl(38, 85%, 98%)',
        label: 'Warning',
        labelColor: 'hsl(38, 80%, 38%)',
      };
    default:
      return {
        icon: <Info className="w-4 h-4 flex-shrink-0" style={{ color: 'hsl(210, 68%, 48%)' }} />,
        border: 'hsl(210, 68%, 52%)',
        bg: 'hsl(210, 68%, 98%)',
        label: 'Info',
        labelColor: 'hsl(210, 68%, 40%)',
      };
  }
}

export default function NotificationBell() {
  const queryClient = useQueryClient();

  const { data: alerts = [] } = useQuery<Alert[]>({
    queryKey: ['unreadAlerts'],
    queryFn: async () => {
      const res = await axios.get('http://localhost:3001/api/v1/alerts/unread');
      return res.data;
    },
    refetchInterval: 30_000,
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (id: string) => {
      await axios.patch(`http://localhost:3001/api/v1/alerts/${id}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unreadAlerts'] });
    },
  });

  const unreadCount = alerts.length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="relative flex items-center justify-center w-9 h-9 rounded-xl transition-colors duration-150 focus:outline-none"
          style={{ background: unreadCount > 0 ? 'hsl(4, 80%, 96%)' : 'transparent' }}
          onMouseEnter={e => {
            if (unreadCount === 0) (e.currentTarget as HTMLElement).style.background = 'var(--muted)';
          }}
          onMouseLeave={e => {
            if (unreadCount === 0) (e.currentTarget as HTMLElement).style.background = 'transparent';
          }}
          aria-label={`Notifications (${unreadCount} unread)`}
        >
          <Bell
            className="w-4.5 h-4.5"
            style={{ color: unreadCount > 0 ? 'hsl(4, 80%, 52%)' : 'var(--muted-foreground)', width: '18px', height: '18px' }}
          />
          {/* Animated ping badge */}
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center">
              <span
                className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60"
                style={{ background: 'hsl(4, 80%, 55%)' }}
              />
              <span
                className="relative inline-flex rounded-full h-4 w-4 items-center justify-center text-[9px] font-bold text-white"
                style={{ background: 'hsl(4, 80%, 52%)' }}
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            </span>
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="p-0 overflow-hidden rounded-2xl"
        style={{
          width: '320px',
          background: 'var(--card)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-hover)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3.5"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4" style={{ color: 'var(--foreground)' }} />
            <span className="font-bold text-sm" style={{ color: 'var(--foreground)' }}>
              System Alerts
            </span>
          </div>
          {unreadCount > 0 && (
            <span
              className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold"
              style={{ background: 'hsl(4, 80%, 95%)', color: 'hsl(4, 80%, 45%)' }}
            >
              {unreadCount} New
            </span>
          )}
        </div>

        {/* Alert list */}
        <ScrollArea className="h-[300px]">
          {unreadCount === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center"
                style={{ background: 'hsl(142, 40%, 94%)' }}
              >
                <BellOff className="w-5 h-5" style={{ color: 'var(--primary)' }} />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>All clear!</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                  No new system alerts.
                </p>
              </div>
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {alerts.map((alert) => {
                const cfg = getSeverityConfig(alert.severity);
                return (
                  <div
                    key={alert.id}
                    className="rounded-xl p-3 transition-colors duration-100"
                    style={{ background: cfg.bg, borderLeft: `3px solid ${cfg.border}` }}
                  >
                    <div className="flex items-start gap-2.5">
                      {cfg.icon}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <span
                            className="text-[10px] font-bold uppercase tracking-wider"
                            style={{ color: cfg.labelColor }}
                          >
                            {cfg.label}
                          </span>
                          <span className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>
                            {new Date(alert.timestamp).toLocaleTimeString([], {
                              hour: '2-digit', minute: '2-digit'
                            })}
                          </span>
                        </div>
                        <p className="text-xs leading-relaxed" style={{ color: 'var(--foreground)' }}>
                          {alert.message}
                        </p>
                      </div>
                    </div>

                    <button
                      className="flex items-center gap-1.5 mt-2.5 text-[11px] font-medium px-2.5 py-1 rounded-lg transition-colors duration-150 w-full justify-center"
                      style={{
                        background: 'transparent',
                        color: 'var(--muted-foreground)',
                        border: '1px solid var(--border)',
                      }}
                      onMouseEnter={e => {
                        (e.currentTarget as HTMLElement).style.background = 'hsl(142, 40%, 94%)';
                        (e.currentTarget as HTMLElement).style.color = 'hsl(142, 65%, 28%)';
                        (e.currentTarget as HTMLElement).style.borderColor = 'hsl(142, 40%, 82%)';
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLElement).style.background = 'transparent';
                        (e.currentTarget as HTMLElement).style.color = 'var(--muted-foreground)';
                        (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)';
                      }}
                      onClick={(e) => {
                        e.preventDefault();
                        markAsReadMutation.mutate(alert.id);
                      }}
                      disabled={markAsReadMutation.isPending}
                    >
                      <CheckCheck className="w-3 h-3" />
                      Acknowledge
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
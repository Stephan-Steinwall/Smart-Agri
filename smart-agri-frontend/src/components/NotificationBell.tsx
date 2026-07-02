"use client";

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Bell, AlertTriangle, Info, AlertCircle, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function NotificationBell() {
    const queryClient = useQueryClient();

    // 1. Fetch unread alerts every 30 seconds
    const { data: alerts = [] } = useQuery({
        queryKey: ['unreadAlerts'],
        queryFn: async () => {
            const res = await axios.get('http://localhost:3001/api/v1/alerts/unread');
            return res.data;
        },
        refetchInterval: 30000,
    });

    // 2. Mutation to mark an alert as read
    const markAsReadMutation = useMutation({
        mutationFn: async (id: string) => {
            await axios.patch(`http://localhost:3001/api/v1/alerts/${id}/read`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['unreadAlerts'] });
        },
    });

    // Helper to render the right icon based on severity
    const getIcon = (severity: string) => {
        switch (severity) {
            case 'CRITICAL': return <AlertTriangle className="text-destructive w-4 h-4 mt-0.5" />;
            case 'WARNING': return <AlertCircle className="text-orange-500 w-4 h-4 mt-0.5" />;
            default: return <Info className="text-blue-500 w-4 h-4 mt-0.5" />;
        }
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                    <Bell className="w-5 h-5 text-muted-foreground" />
                    {/* The Red Badge (Only shows if there are alerts) */}
                    {alerts.length > 0 && (
                        <span className="absolute top-1 right-2 flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-destructive"></span>
                        </span>
                    )}
                </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-80">
                <DropdownMenuLabel className="flex justify-between items-center">
                    System Alerts
                    <span className="bg-primary/10 text-primary text-xs px-2 py-1 rounded-full">
                        {alerts.length} New
                    </span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />

                <ScrollArea className="h-[300px]">
                    {alerts.length === 0 ? (
                        <div className="p-4 text-center text-sm text-muted-foreground">
                            All systems operational. No new alerts.
                        </div>
                    ) : (
                        alerts.map((alert: any) => (
                            <DropdownMenuItem key={alert.id} className="flex flex-col items-start p-3 cursor-default focus:bg-transparent">
                                <div className="flex gap-3 w-full">
                                    {getIcon(alert.severity)}
                                    <div className="flex-1 space-y-1">
                                        <p className="text-sm font-medium leading-none">{alert.message}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    </div>
                                </div>
                                {/* Acknowledge Button */}
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="mt-2 h-7 w-full text-xs text-muted-foreground hover:text-green-600 hover:bg-green-50"
                                    onClick={(e) => {
                                        e.preventDefault(); // Prevent dropdown from closing immediately
                                        markAsReadMutation.mutate(alert.id);
                                    }}
                                >
                                    <Check className="w-3 h-3 mr-2" /> Acknowledge
                                </Button>
                            </DropdownMenuItem>
                        ))
                    )}
                </ScrollArea>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
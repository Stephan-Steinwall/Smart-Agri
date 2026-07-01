"use client";

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Bot, Send, User, WifiOff, Loader2 } from 'lucide-react';

const API_BASE = 'http://localhost:3001/api/v1';

type Message = { role: 'user' | 'ai'; content: string };

export default function AiAssistant() {
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState<Message[]>([
        { role: 'ai', content: 'Hello! I am your SmartAgri Assistant. I am monitoring your sensors right now. How can I help you today?' }
    ]);
    const [isLoading, setIsLoading] = useState(false);

    // Dynamically fetch the first device UUID — same pattern as the main dashboard
    const { data: devices, isLoading: devicesLoading, isError: devicesError } = useQuery({
        queryKey: ['devices'],
        queryFn: async () => {
            const res = await axios.get(`${API_BASE}/devices`);
            return res.data;
        },
        retry: 2,
        staleTime: 5 * 60 * 1000, // Cache for 5 min — no need to re-fetch on every keystroke
    });

    const deviceId = devices?.[0]?.id ?? null;

    const sendMessage = async () => {
        if (!input.trim() || !deviceId) return;

        const userMessage: Message = { role: 'user', content: input };
        setMessages((prev) => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        try {
            const res = await axios.post(`${API_BASE}/ai/chat`, {
                query: userMessage.content,
                deviceId, // Real UUID resolved dynamically at runtime
            });

            setMessages((prev) => [...prev, { role: 'ai', content: res.data.answer }]);
        } catch (error) {
            setMessages((prev) => [...prev, { role: 'ai', content: 'Sorry, I am having trouble connecting to the sensor network.' }]);
        } finally {
            setIsLoading(false);
        }
    };

    // Loading state while resolving device ID
    if (devicesLoading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="text-center space-y-3">
                    <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
                    <p className="text-muted-foreground">Connecting to sensor network...</p>
                </div>
            </div>
        );
    }

    // Error / no device found state
    if (devicesError || !deviceId) {
        return (
            <div className="flex items-center justify-center h-full">
                <Card className="max-w-md w-full">
                    <CardContent className="pt-6 text-center space-y-3">
                        <WifiOff className="w-12 h-12 text-destructive mx-auto" />
                        <h2 className="text-lg font-semibold">Cannot Reach Sensor Network</h2>
                        <p className="text-sm text-muted-foreground">
                            Ensure the backend is running on{' '}
                            <code className="bg-muted px-1 rounded">http://localhost:3001</code> and the database has been seeded.
                        </p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto h-[80vh] flex flex-col">
            <Card className="flex-1 flex flex-col overflow-hidden border-2 border-primary/20">
                <CardHeader className="bg-primary/5 border-b border-border">
                    <CardTitle className="flex items-center justify-between text-primary">
                        <span className="flex items-center">
                            <Bot className="w-6 h-6 mr-3" />
                            Agronomy AI Assistant
                        </span>
                        <span className="text-xs font-normal text-muted-foreground">
                            Device: <code className="bg-muted px-1 rounded">{deviceId}</code>
                        </span>
                    </CardTitle>
                </CardHeader>

                {/* Chat History Area */}
                <CardContent className="flex-1 overflow-y-auto p-6 space-y-6">
                    {messages.map((msg, idx) => (
                        <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`flex max-w-[80%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-secondary text-secondary-foreground ml-3' : 'bg-primary text-primary-foreground mr-3'}`}>
                                    {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                                </div>
                                <div className={`p-4 rounded-xl ${msg.role === 'user' ? 'bg-secondary/50 text-secondary-foreground rounded-tr-none' : 'bg-muted text-foreground rounded-tl-none'}`}>
                                    {msg.content}
                                </div>
                            </div>
                        </div>
                    ))}
                    {isLoading && (
                        <div className="flex justify-start text-muted-foreground animate-pulse ml-12">
                            Analyzing soil data...
                        </div>
                    )}
                </CardContent>

                {/* Input Area */}
                <div className="p-4 bg-background border-t border-border flex items-center space-x-2">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                        placeholder="Ask about your soil health, NPK levels, or irrigation..."
                        className="flex-1 p-3 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                        disabled={isLoading}
                    />
                    <Button onClick={sendMessage} disabled={isLoading || !deviceId} className="px-6 h-12">
                        <Send className="w-5 h-5" />
                    </Button>
                </div>
            </Card>
        </div>
    );
}
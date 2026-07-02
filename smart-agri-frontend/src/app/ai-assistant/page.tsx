"use client";

import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { Bot, Send, User, WifiOff, Loader2, Sprout, BrainCircuit } from 'lucide-react';

const API_BASE = 'http://localhost:3001/api/v1';

type Message = { role: 'user' | 'ai'; content: string; ts: Date };

// ── Thinking animation ────────────────────────────────────────────────────
function ThinkingDots() {
  return (
    <div className="flex items-center gap-1.5 px-4 py-3">
      <span className="thinking-dot" />
      <span className="thinking-dot" />
      <span className="thinking-dot" />
    </div>
  );
}

export default function AiAssistant() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'ai',
      content: "Hello! I'm your SmartAgri AI Agronomist. I'm connected to your field sensors right now. Ask me about soil health, NPK levels, irrigation schedules, or crop recommendations.",
      ts: new Date(),
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: devices, isLoading: devicesLoading, isError: devicesError } = useQuery({
    queryKey: ['sensor-nodes'],
    queryFn: async () => {
      const res = await axios.get(`${API_BASE}/devices/sensor-nodes`);
      return res.data;
    },
    retry: 2,
    staleTime: 5 * 60 * 1000,
  });

  const deviceId = devices?.[0]?.id ?? null;

  // Auto-scroll on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const sendMessage = async () => {
    if (!input.trim() || !deviceId || isLoading) return;

    const userMsg: Message = { role: 'user', content: input, ts: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const res = await axios.post(`${API_BASE}/ai/chat`, {
        query: userMsg.content,
        deviceId,
      });
      setMessages((prev) => [
        ...prev,
        { role: 'ai', content: res.data.answer, ts: new Date() },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: 'ai',
          content: 'Sorry, I\'m having trouble reaching the sensor network right now. Please try again.',
          ts: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // ── Loading state ────────────────────────────────────────────────────────
  if (devicesLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-4">
          <div
            className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center"
            style={{ background: 'hsl(142, 40%, 94%)' }}
          >
            <Loader2 className="w-7 h-7 animate-spin" style={{ color: 'var(--primary)' }} />
          </div>
          <div>
            <p className="font-semibold" style={{ color: 'var(--foreground)' }}>Connecting to sensor network</p>
            <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>Establishing secure link...</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Error state ──────────────────────────────────────────────────────────
  if (devicesError || !deviceId) {
    return (
      <div className="flex items-center justify-center h-full">
        <div
          className="max-w-md w-full rounded-2xl p-8 text-center"
          style={{ background: 'var(--card)', boxShadow: 'var(--shadow-card)', border: '1px solid var(--border)' }}
        >
          <div
            className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
            style={{ background: 'hsl(4, 80%, 96%)' }}
          >
            <WifiOff className="w-7 h-7" style={{ color: 'hsl(4, 80%, 52%)' }} />
          </div>
          <h2 className="text-lg font-bold mb-2" style={{ color: 'var(--foreground)' }}>Cannot Reach Sensor Network</h2>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
            Ensure the backend is running on{' '}
            <code
              className="px-1.5 py-0.5 rounded-md text-xs"
              style={{ background: 'var(--muted)', color: 'var(--foreground)' }}
            >
              http://localhost:3001
            </code>{' '}
            and the database has been seeded with sensor data.
          </p>
        </div>
      </div>
    );
  }

  // ── Main chat UI ─────────────────────────────────────────────────────────
  return (
    <div className="max-w-3xl mx-auto h-[calc(100vh-8rem)] flex flex-col gap-0 animate-fade-in">

      {/* Chat header */}
      <div
        className="flex items-center justify-between px-6 py-4 rounded-t-2xl"
        style={{
          background: 'linear-gradient(135deg, hsl(142, 58%, 22%) 0%, hsl(162, 50%, 28%) 100%)',
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.15)' }}
          >
            <BrainCircuit className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-bold text-white text-sm">AI Agronomist</p>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-300 animate-pulse" />
              <span className="text-[11px] text-green-200">Connected to field sensors</span>
            </div>
          </div>
        </div>
        <div
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl"
          style={{ background: 'rgba(255,255,255,0.12)' }}
        >
          <Sprout className="w-3.5 h-3.5 text-green-200" />
          <span className="text-[11px] text-green-100 font-medium">SmartAgri AI</span>
        </div>
      </div>

      {/* Message area */}
      <div
        className="flex-1 overflow-y-auto px-5 py-5 space-y-4"
        style={{
          background: 'var(--card)',
          borderLeft: '1px solid var(--border)',
          borderRight: '1px solid var(--border)',
        }}
      >
        {messages.map((msg, idx) => {
          const isAi = msg.role === 'ai';
          return (
            <div
              key={idx}
              className={`flex ${isAi ? 'justify-start' : 'justify-end'} animate-fade-in`}
            >
              <div className={`flex items-end gap-2.5 max-w-[82%] ${isAi ? '' : 'flex-row-reverse'}`}>
                {/* Avatar */}
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mb-0.5"
                  style={{
                    background: isAi
                      ? 'linear-gradient(135deg, hsl(142, 58%, 26%), hsl(162, 50%, 32%))'
                      : 'hsl(210, 68%, 48%)',
                  }}
                >
                  {isAi
                    ? <Bot className="w-4 h-4 text-white" />
                    : <User className="w-4 h-4 text-white" />
                  }
                </div>

                {/* Bubble */}
                <div>
                  <div
                    className="px-4 py-3 rounded-2xl text-sm leading-relaxed"
                    style={{
                      background: isAi ? 'hsl(142, 30%, 96%)' : 'hsl(210, 68%, 48%)',
                      color: isAi ? 'var(--foreground)' : 'white',
                      borderRadius: isAi ? '4px 18px 18px 18px' : '18px 4px 18px 18px',
                      border: isAi ? '1px solid hsl(142, 30%, 88%)' : 'none',
                    }}
                  >
                    {msg.content}
                  </div>
                  <p
                    className={`text-[10px] mt-1 ${isAi ? 'text-left' : 'text-right'}`}
                    style={{ color: 'var(--muted-foreground)' }}
                  >
                    {msg.ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            </div>
          );
        })}

        {/* Thinking dots */}
        {isLoading && (
          <div className="flex justify-start animate-fade-in">
            <div className="flex items-end gap-2.5">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, hsl(142, 58%, 26%), hsl(162, 50%, 32%))' }}
              >
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div
                className="rounded-2xl"
                style={{
                  background: 'hsl(142, 30%, 96%)',
                  border: '1px solid hsl(142, 30%, 88%)',
                  borderRadius: '4px 18px 18px 18px',
                }}
              >
                <ThinkingDots />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div
        className="px-4 py-3 rounded-b-2xl flex items-center gap-3"
        style={{
          background: 'var(--card)',
          borderTop: '1px solid var(--border)',
          borderLeft: '1px solid var(--border)',
          borderRight: '1px solid var(--border)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
          placeholder="Ask about soil health, NPK levels, irrigation..."
          disabled={isLoading}
          className="flex-1 text-sm px-4 py-3 rounded-xl focus:outline-none transition-colors"
          style={{
            background: 'var(--muted)',
            border: '1.5px solid transparent',
            color: 'var(--foreground)',
          }}
          onFocus={e => {
            (e.target as HTMLInputElement).style.borderColor = 'hsl(142, 65%, 70%)';
            (e.target as HTMLInputElement).style.background = 'var(--card)';
          }}
          onBlur={e => {
            (e.target as HTMLInputElement).style.borderColor = 'transparent';
            (e.target as HTMLInputElement).style.background = 'var(--muted)';
          }}
        />
        <button
          onClick={sendMessage}
          disabled={isLoading || !input.trim()}
          className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-150 focus:outline-none"
          style={{
            background: isLoading || !input.trim()
              ? 'var(--muted)'
              : 'linear-gradient(135deg, hsl(142, 58%, 28%), hsl(162, 50%, 35%))',
            color: isLoading || !input.trim() ? 'var(--muted-foreground)' : 'white',
            cursor: isLoading || !input.trim() ? 'not-allowed' : 'pointer',
          }}
          aria-label="Send message"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
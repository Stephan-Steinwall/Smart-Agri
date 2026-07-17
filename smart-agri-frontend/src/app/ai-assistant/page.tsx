// src/app/ai-assistant/page.tsx
"use client";

import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { Bot, Send, User, Sprout, BrainCircuit, MessageSquare, Plus } from 'lucide-react';

const API_BASE = 'http://localhost:3001/api/v1';
const DEVICE_ID = 'agribot_receiver_01';
const DEVICE_NAME = 'Main Field Node';

type Message = { role: 'user' | 'ai'; content: string; ts: Date };
type Session = { sessionId: string; title: string; lastMessageAt: string };

function ThinkingDots() {
  return (
    <div className="flex items-center gap-1.5 px-4 py-3">
      <span className="thinking-dot" />
      <span className="thinking-dot" />
      <span className="thinking-dot" />
    </div>
  );
}

function AiMessageContent({ content }: { content: string }) {
  const lines = content.split('\n');
  return (
    <div className="text-sm leading-relaxed space-y-1">
      {lines.map((line, i) => {
        if (line.trim() === '') return <br key={i} />;
        const isBullet = /^[\-\*•]\s/.test(line.trim());
        const isNumbered = /^\d+[\.\)]\s/.test(line.trim());
        if (isBullet || isNumbered) {
          return (
            <div key={i} className="flex gap-2 items-start">
              <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-current opacity-50" style={{ marginTop: '7px' }} />
              <span>{line.replace(/^[\-\*•]\s|^\d+[\.\)]\s/, '')}</span>
            </div>
          );
        }
        const parts = line.split(/(\*\*[^*]+\*\*)/g);
        return (
          <p key={i}>
            {parts.map((part, j) =>
              part.startsWith('**') && part.endsWith('**') ? <strong key={j}>{part.slice(2, -2)}</strong> : part
            )}
          </p>
        );
      })}
    </div>
  );
}

function generateSessionId() {
  return 'sess_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
}

export default function AiAssistant() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>('');
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadSessions = async () => {
    try {
      const res = await axios.get(`${API_BASE}/ai/sessions`);
      setSessions(res.data);
      // If we don't have an active session, set it to the latest one or generate a new one
      if (!activeSessionId) {
        if (res.data.length > 0) {
          setActiveSessionId(res.data[0].sessionId);
        } else {
          setActiveSessionId(generateSessionId());
        }
      }
    } catch (e) {
      console.error("Failed to load sessions", e);
      if (!activeSessionId) setActiveSessionId(generateSessionId());
    }
  };

  useEffect(() => {
    loadSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!activeSessionId) return;
    const fetchHistory = async () => {
      try {
        const res = await axios.get(`${API_BASE}/ai/history/${activeSessionId}`);
        if (res.data && res.data.length > 0) {
          const loadedMessages: Message[] = res.data.map((row: any) => ({
            role: row.role === 'assistant' ? 'ai' : 'user',
            content: row.content,
            ts: new Date(row.created_at)
          }));
          setMessages(loadedMessages);
        } else {
          setMessages([
            {
              role: 'ai',
              content: "Hello! I'm your SmartAgri AI Agronomist. Ask me about soil health, NPK levels, or crop recommendations.",
              ts: new Date(),
            }
          ]);
        }
      } catch (e) {
        console.error("Failed to load history", e);
      }
    };
    fetchHistory();
  }, [activeSessionId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const startNewChat = () => {
    setActiveSessionId(generateSessionId());
    setInput('');
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading || !activeSessionId) return;

    const userMsg: Message = { role: 'user', content: input, ts: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const res = await axios.post(`${API_BASE}/ai/chat`, {
        query: userMsg.content,
        deviceId: DEVICE_ID,
        sessionId: activeSessionId,
      });
      setMessages((prev) => [
        ...prev,
        { role: 'ai', content: res.data.answer ?? 'No response received.', ts: new Date() },
      ]);
      loadSessions(); // Refresh list to update title
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'ai', content: "Sorry, I'm having trouble right now. Please try again.", ts: new Date() },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto h-[calc(100vh-8rem)] flex gap-6 animate-fade-in">
      
      {/* ── Sidebar (Sessions List) ────────────────────────────────────────── */}
      <div 
        className="hidden md:flex flex-col w-72 rounded-2xl overflow-hidden flex-shrink-0"
        style={{ background: 'var(--card)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}
      >
        <div className="p-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <button
            onClick={startNewChat}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all card-lift"
            style={{ background: 'hsl(142, 65%, 94%)', color: 'hsl(142, 65%, 26%)' }}
          >
            <Plus className="w-4 h-4" />
            New Chat
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          <p className="text-xs font-bold uppercase px-3 py-2" style={{ color: 'var(--muted-foreground)' }}>
            Past Conversations
          </p>
          {sessions.map((session) => (
            <button
              key={session.sessionId}
              onClick={() => setActiveSessionId(session.sessionId)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors"
              style={{
                background: activeSessionId === session.sessionId ? 'var(--muted)' : 'transparent',
              }}
            >
              <MessageSquare className="w-4 h-4 flex-shrink-0" style={{ color: activeSessionId === session.sessionId ? 'var(--primary)' : 'var(--muted-foreground)' }} />
              <div className="flex-1 truncate">
                <p className="text-sm font-medium truncate" style={{ color: activeSessionId === session.sessionId ? 'var(--foreground)' : 'var(--muted-foreground)' }}>
                  {session.title}
                </p>
                <p className="text-[10px] opacity-70" style={{ color: 'var(--muted-foreground)' }}>
                  {new Date(session.lastMessageAt).toLocaleDateString()}
                </p>
              </div>
            </button>
          ))}
          {sessions.length === 0 && (
            <p className="text-xs text-center p-4" style={{ color: 'var(--muted-foreground)' }}>No past conversations found.</p>
          )}
        </div>
      </div>

      {/* ── Main Chat Area ────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0" style={{ border: '1px solid var(--border)', borderRadius: '1rem', background: 'var(--card)', boxShadow: 'var(--shadow-card)' }}>
        
        {/* Chat header */}
        <div
          className="flex items-center justify-between px-6 py-4 rounded-t-2xl flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, hsl(142, 58%, 22%) 0%, hsl(162, 50%, 28%) 100%)' }}
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
                <span className="text-[11px] text-green-200">Monitoring: {DEVICE_NAME}</span>
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
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          {messages.map((msg, idx) => {
            const isAi = msg.role === 'ai';
            return (
              <div key={idx} className={`flex ${isAi ? 'justify-start' : 'justify-end'} animate-fade-in`}>
                <div className={`flex items-end gap-2.5 max-w-[85%] lg:max-w-[75%] ${isAi ? '' : 'flex-row-reverse'}`}>
                  {/* Avatar */}
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mb-0.5"
                    style={{
                      background: isAi ? 'linear-gradient(135deg, hsl(142, 58%, 26%), hsl(162, 50%, 32%))' : 'hsl(210, 68%, 48%)',
                    }}
                  >
                    {isAi ? <Bot className="w-4 h-4 text-white" /> : <User className="w-4 h-4 text-white" />}
                  </div>

                  {/* Bubble */}
                  <div>
                    <div
                      className="px-4 py-3"
                      style={{
                        background: isAi ? 'hsl(142, 30%, 96%)' : 'hsl(210, 68%, 48%)',
                        color: isAi ? 'var(--foreground)' : 'white',
                        borderRadius: isAi ? '4px 18px 18px 18px' : '18px 4px 18px 18px',
                        border: isAi ? '1px solid hsl(142, 30%, 88%)' : 'none',
                      }}
                    >
                      {isAi ? <AiMessageContent content={msg.content} /> : <p className="text-sm leading-relaxed">{msg.content}</p>}
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
                <div style={{ background: 'hsl(142, 30%, 96%)', border: '1px solid hsl(142, 30%, 88%)', borderRadius: '4px 18px 18px 18px' }}>
                  <ThinkingDots />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div
          className="px-4 py-3 rounded-b-2xl flex items-center gap-3 flex-shrink-0"
          style={{ background: 'var(--card)', borderTop: '1px solid var(--border)' }}
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            placeholder={`Ask about ${DEVICE_NAME}...`}
            disabled={isLoading || !activeSessionId}
            className="flex-1 text-sm px-4 py-3 rounded-xl focus:outline-none transition-colors"
            style={{ background: 'var(--muted)', border: '1.5px solid transparent', color: 'var(--foreground)' }}
            onFocus={(e) => {
              (e.target as HTMLInputElement).style.borderColor = 'hsl(142, 65%, 70%)';
              (e.target as HTMLInputElement).style.background = 'var(--card)';
            }}
            onBlur={(e) => {
              (e.target as HTMLInputElement).style.borderColor = 'transparent';
              (e.target as HTMLInputElement).style.background = 'var(--muted)';
            }}
          />
          <button
            onClick={sendMessage}
            disabled={isLoading || !input.trim() || !activeSessionId}
            className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-150 focus:outline-none"
            style={{
              background: isLoading || !input.trim() || !activeSessionId ? 'var(--muted)' : 'linear-gradient(135deg, hsl(142, 58%, 28%), hsl(162, 50%, 35%))',
              color: isLoading || !input.trim() || !activeSessionId ? 'var(--muted-foreground)' : 'white',
              cursor: isLoading || !input.trim() || !activeSessionId ? 'not-allowed' : 'pointer',
            }}
            aria-label="Send message"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>

    </div>
  );
}
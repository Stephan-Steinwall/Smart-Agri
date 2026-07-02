"use client";

import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { BrainCircuit, AlertTriangle, CheckCircle2, TrendingUp, Leaf } from 'lucide-react';

// ── Skeleton loader ────────────────────────────────────────────────────────
function InsightSkeleton({ fieldName }: { fieldName: string }) {
  return (
    <div
      className="rounded-2xl overflow-hidden card-lift animate-fade-in"
      style={{ background: 'var(--card)', boxShadow: 'var(--shadow-card)', border: '1px solid var(--border)' }}
    >
      {/* Skeleton header strip */}
      <div className="h-1.5 skeleton" />
      <div className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="skeleton h-5 w-32 rounded-lg mb-1.5" />
            <div className="skeleton h-3.5 w-20 rounded-md" />
          </div>
          <div className="skeleton h-6 w-20 rounded-full" />
        </div>

        <div className="mb-4">
          <div className="flex justify-between mb-1.5">
            <div className="skeleton h-3.5 w-24 rounded-md" />
            <div className="skeleton h-3.5 w-16 rounded-md" />
          </div>
          <div className="skeleton h-2.5 w-full rounded-full" />
        </div>

        <div className="skeleton h-20 w-full rounded-xl" />

        <div className="flex items-center gap-2 mt-4 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
          <BrainCircuit className="w-3.5 h-3.5 animate-pulse" style={{ color: 'var(--primary)' }} />
          <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
            Analyzing {fieldName}...
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Risk color mapping ─────────────────────────────────────────────────────
function getRiskConfig(riskLevel: string) {
  switch (riskLevel) {
    case 'High':
      return {
        bar: 'hsl(4, 80%, 55%)',
        barBg: 'hsl(4, 80%, 95%)',
        badge: { bg: 'hsl(4, 80%, 95%)', text: 'hsl(4, 80%, 42%)' },
        strip: 'linear-gradient(90deg, hsl(4, 80%, 55%), hsl(20, 85%, 52%))',
        icon: <AlertTriangle className="w-4 h-4 flex-shrink-0" style={{ color: 'hsl(4, 80%, 52%)' }} />,
        actionBg: 'hsl(4, 80%, 97%)',
        actionBorder: 'hsl(4, 80%, 88%)',
      };
    case 'Medium':
      return {
        bar: 'hsl(38, 92%, 50%)',
        barBg: 'hsl(38, 92%, 93%)',
        badge: { bg: 'hsl(38, 92%, 93%)', text: 'hsl(38, 80%, 35%)' },
        strip: 'linear-gradient(90deg, hsl(38, 92%, 50%), hsl(50, 88%, 48%))',
        icon: <AlertTriangle className="w-4 h-4 flex-shrink-0" style={{ color: 'hsl(38, 80%, 40%)' }} />,
        actionBg: 'hsl(38, 92%, 97%)',
        actionBorder: 'hsl(38, 80%, 86%)',
      };
    default:
      return {
        bar: 'hsl(142, 65%, 38%)',
        barBg: 'hsl(142, 65%, 94%)',
        badge: { bg: 'hsl(142, 65%, 93%)', text: 'hsl(142, 65%, 26%)' },
        strip: 'linear-gradient(90deg, hsl(142, 65%, 28%), hsl(162, 55%, 40%))',
        icon: <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: 'hsl(142, 65%, 35%)' }} />,
        actionBg: 'hsl(142, 40%, 97%)',
        actionBorder: 'hsl(142, 40%, 87%)',
      };
  }
}

// ── Main component ─────────────────────────────────────────────────────────
export default function AiInsightCard({ fieldId, fieldName }: { fieldId: string; fieldName: string }) {
  const { data: insight, isLoading, isError } = useQuery({
    queryKey: ['ai-insight', fieldId],
    queryFn: async () => {
      const res = await axios.get(`http://localhost:3001/api/v1/ai/insight/${fieldId}`);
      return res.data;
    },
    refetchInterval: 300_000,
  });

  if (isLoading) return <InsightSkeleton fieldName={fieldName} />;

  // Error state
  if (isError || insight?.error) {
    return (
      <div
        className="rounded-2xl overflow-hidden animate-fade-in"
        style={{ background: 'var(--card)', boxShadow: 'var(--shadow-card)', border: '1px solid var(--border)' }}
      >
        <div className="h-1.5" style={{ background: 'var(--border)' }} />
        <div className="p-5">
          <div className="flex items-center gap-2 mb-1">
            <Leaf className="w-4 h-4" style={{ color: 'var(--muted-foreground)' }} />
            <span className="font-semibold text-sm" style={{ color: 'var(--foreground)' }}>{fieldName}</span>
          </div>
          <p className="text-xs mt-3" style={{ color: 'var(--muted-foreground)' }}>
            Unable to generate AI insight. Ensure the backend is running and this field has sensor data.
          </p>
        </div>
      </div>
    );
  }

  const risk = getRiskConfig(insight.riskLevel);

  return (
    <div
      className="rounded-2xl overflow-hidden card-lift animate-fade-in"
      style={{ background: 'var(--card)', boxShadow: 'var(--shadow-card)', border: '1px solid var(--border)' }}
    >
      {/* Top colored accent strip */}
      <div className="h-1.5" style={{ background: risk.strip }} />

      <div className="p-5">
        {/* Header: title + badge */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h3 className="font-bold text-base leading-tight" style={{ color: 'var(--foreground)' }}>
              {fieldName}
            </h3>
            <div className="flex items-center gap-1.5 mt-1">
              <TrendingUp className="w-3 h-3" style={{ color: 'var(--muted-foreground)' }} />
              <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                {insight.status}
              </span>
            </div>
          </div>
          <span
            className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold flex-shrink-0"
            style={{ background: risk.badge.bg, color: risk.badge.text }}
          >
            {insight.riskLevel} Risk
          </span>
        </div>

        {/* Soil health score */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>Soil Health</span>
            <span className="text-sm font-bold" style={{ color: risk.bar }}>{insight.healthScore}%</span>
          </div>
          {/* Progress bar */}
          <div className="h-2.5 rounded-full overflow-hidden" style={{ background: risk.barBg }}>
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${insight.healthScore}%`, background: risk.bar }}
            />
          </div>
        </div>

        {/* Action recommendation block */}
        <div
          className="rounded-xl p-3.5"
          style={{ background: risk.actionBg, border: `1px solid ${risk.actionBorder}` }}
        >
          <div className="flex items-center gap-2 mb-1.5">
            {risk.icon}
            <span className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--foreground)' }}>
              {insight.primaryAction}
            </span>
          </div>
          <p className="text-xs leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
            {insight.detailedReason}
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-1.5 mt-4 pt-3.5" style={{ borderTop: '1px solid var(--border)' }}>
          <BrainCircuit className="w-3.5 h-3.5" style={{ color: 'var(--primary)' }} />
          <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--muted-foreground)' }}>
            AI Generated Insight
          </span>
        </div>
      </div>
    </div>
  );
}
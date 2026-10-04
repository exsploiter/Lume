'use client';

import { useState, useEffect } from 'react';
import {
  Users,
  Award,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  BarChart3,
  Layers,
  ArrowUpRight,
  Shield,
  Zap,
} from 'lucide-react';
import type { PeerBenchmarkResult, MetricBenchmark } from '@/types';

interface PeerBenchmarkCardProps {
  analysisId: string;
}

export function PeerBenchmarkCard({ analysisId }: PeerBenchmarkCardProps) {
  const [data, setData] = useState<PeerBenchmarkResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function fetchBenchmark() {
      try {
        setLoading(true);
        const res = await fetch(`/api/analysis/${analysisId}/benchmark`, { cache: 'no-store' });
        if (!res.ok) {
          throw new Error('Failed to load peer benchmark');
        }
        const json: PeerBenchmarkResult = await res.json();
        if (isMounted) {
          setData(json);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Error fetching benchmark');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    if (analysisId) {
      fetchBenchmark();
    }

    return () => {
      isMounted = false;
    };
  }, [analysisId]);

  if (loading) {
    return (
      <div className="glass-panel rounded-[24px] p-6 border border-[rgba(176,122,77,0.14)] bg-[#f5efe7]/45 animate-pulse flex items-center justify-center min-h-[220px]">
        <div className="flex items-center gap-3 text-slate-500 font-bold text-sm">
          <Users className="w-5 h-5 animate-spin text-[#9a6a43]" />
          <span>Computing peer cohort benchmarking and percentile standing...</span>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return null;
  }

  const overallColor =
    data.overallPercentile >= 75
      ? 'from-emerald-500/20 to-teal-500/10 border-emerald-300 text-emerald-800'
      : data.overallPercentile >= 50
      ? 'from-amber-500/20 to-orange-500/10 border-amber-300 text-amber-800'
      : 'from-rose-500/20 to-orange-500/10 border-rose-300 text-rose-800';

  return (
    <section className="glass-panel rounded-[24px] p-6 border border-[rgba(176,122,77,0.18)] bg-[#f5efe7]/50 shadow-sm space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#9a6a43]/10 flex items-center justify-center border border-[#9a6a43]/20 shrink-0">
            <Users className="w-5 h-5 text-[#9a6a43]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
                Peer Cohort Benchmarking
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#efe8de] text-slate-700 border border-[rgba(176,122,77,0.15)]">
                {data.sizeCohort}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-semibold mt-0.5">
              Anonymized comparative ranking against {data.cohortSize} repositories in the DebtRadar intelligence pool.
            </p>
          </div>
        </div>

        {/* Overall Percentile Pill */}
        <div className={`flex items-center gap-3 rounded-2xl border px-4 py-2.5 shadow-sm bg-gradient-to-r ${overallColor}`}>
          <div className="text-right">
            <div className="text-2xl font-black font-mono leading-none">
              {data.overallPercentile}
              <span className="text-xs font-bold ml-0.5">th</span>
            </div>
            <div className="text-[8px] font-black uppercase tracking-wider mt-1 opacity-80">
              Percentile Rank
            </div>
          </div>
          <div className="h-7 w-px bg-current opacity-20" />
          <div className="text-left">
            <div className="text-xs font-black uppercase tracking-wider leading-none">
              {data.overallTier}
            </div>
            <div className="text-[9px] font-semibold opacity-75 mt-1">
              Cohort Standing
            </div>
          </div>
        </div>
      </div>

      {/* Metric Breakdown Bars */}
      <div className="space-y-3 bg-[#fffdf9]/80 p-4 rounded-[20px] border border-[rgba(176,122,77,0.12)]">
        <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-1">
          <span>Metric Comparison vs Cohort</span>
          <div className="flex items-center gap-4 text-[10px] text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#9a6a43]" /> Repo Score
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-slate-300" /> Peer Median
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-400" /> Top 10%
            </span>
          </div>
        </div>

        <div className="grid gap-3">
          {data.metrics.map((metric) => (
            <BenchmarkRow key={metric.metric} metric={metric} />
          ))}
        </div>
      </div>

      {/* Insights & Recommendations */}
      <div className="grid gap-3 sm:grid-cols-2 text-xs">
        {/* Key Takeaways */}
        <div className="bg-white/70 p-4 rounded-xl border border-slate-200/60 space-y-2">
          <div className="flex items-center gap-1.5 font-bold text-slate-900">
            <Award className="w-4 h-4 text-[#9a6a43]" />
            <span>Benchmark Insights</span>
          </div>
          <ul className="space-y-1.5 text-slate-600 font-medium">
            {data.insights.map((ins, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                <span>{ins}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Actionable Recommendations */}
        <div className="bg-white/70 p-4 rounded-xl border border-slate-200/60 space-y-2">
          <div className="flex items-center gap-1.5 font-bold text-slate-900">
            <Zap className="w-4 h-4 text-amber-600" />
            <span>Target Recommendations</span>
          </div>
          <ul className="space-y-1.5 text-slate-600 font-medium">
            {data.recommendations.map((rec, i) => (
              <li key={i} className="flex items-start gap-2">
                <ArrowUpRight className="w-3.5 h-3.5 text-[#9a6a43] mt-0.5 shrink-0" />
                <span>{rec}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function BenchmarkRow({ metric }: { metric: MetricBenchmark }) {
  const isTopTier = metric.percentile >= 75;
  const isBottomTier = metric.percentile < 25;

  const badgeColor = isTopTier
    ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
    : isBottomTier
    ? 'bg-rose-100 text-rose-800 border-rose-200'
    : 'bg-slate-100 text-slate-700 border-slate-200';

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <span className="font-bold text-slate-800">{metric.metric}</span>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badgeColor}`}>
            {metric.tier} ({metric.percentile}th pct)
          </span>
        </div>
        <div className="font-mono text-xs font-black text-slate-900">
          {metric.targetValue}
          <span className="text-slate-400 font-normal text-[10px] ml-1">/ 100</span>
        </div>
      </div>

      {/* Progress Comparison Bar */}
      <div className="relative h-3 w-full rounded-full bg-slate-100 overflow-hidden border border-slate-200/60">
        {/* Median Marker */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-slate-400 z-10"
          style={{ left: `${metric.cohortMedian}%` }}
          title={`Cohort Median: ${metric.cohortMedian}`}
        />

        {/* Top 10% Marker */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-emerald-500 z-10"
          style={{ left: `${metric.cohortTop10}%` }}
          title={`Top 10%: ${metric.cohortTop10}`}
        />

        {/* Target Progress Bar */}
        <div
          className="h-full bg-gradient-to-r from-[#9a6a43] to-[#c2966e] rounded-full transition-all duration-500"
          style={{ width: `${Math.min(100, Math.max(2, metric.targetValue))}%` }}
        />
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Calendar,
  ShieldCheck,
  ShieldAlert,
  Flame,
  Activity,
  History,
  Info,
  ChevronRight,
} from 'lucide-react';
import type { HistoricalTrendResult, TrendDataPoint } from '@/types';

interface HistoricalTrendCardProps {
  analysisId: string;
}

export function HistoricalTrendCard({ analysisId }: HistoricalTrendCardProps) {
  const [data, setData] = useState<HistoricalTrendResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<TrendDataPoint | null>(null);
  const [activeMetric, setActiveMetric] = useState<'trust' | 'security' | 'exploitability'>('trust');

  useEffect(() => {
    let isMounted = true;
    async function fetchTrend() {
      try {
        setLoading(true);
        const res = await fetch(`/api/analysis/${analysisId}/trend`, { cache: 'no-store' });
        if (!res.ok) {
          throw new Error('Failed to load historical trend');
        }
        const json: HistoricalTrendResult = await res.json();
        if (isMounted) {
          setData(json);
          if (json.history.length > 0) {
            setSelectedPoint(json.history[json.history.length - 1]);
          }
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Error fetching trend');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    if (analysisId) {
      fetchTrend();
    }

    return () => {
      isMounted = false;
    };
  }, [analysisId]);

  if (loading) {
    return (
      <div className="glass-panel rounded-[24px] p-6 border border-[rgba(176,122,77,0.14)] bg-[#f5efe7]/45 animate-pulse flex items-center justify-center min-h-[220px]">
        <div className="flex items-center gap-3 text-slate-500 font-bold text-sm">
          <History className="w-5 h-5 animate-spin text-[#9a6a43]" />
          <span>Analyzing historical trend across scans...</span>
        </div>
      </div>
    );
  }

  if (error || !data || data.history.length === 0) {
    return null;
  }

  const isSingleScan = data.totalScans <= 1;
  const history = data.history;

  // Chart coordinate calculation
  const svgWidth = 560;
  const svgHeight = 160;
  const paddingX = 40;
  const paddingY = 25;

  const points = history.map((pt, idx) => {
    const x =
      history.length === 1
        ? svgWidth / 2
        : paddingX + (idx / (history.length - 1)) * (svgWidth - paddingX * 2);

    let val = pt.trustScore;
    if (activeMetric === 'security') val = pt.repoSecurityScore;
    if (activeMetric === 'exploitability') val = 100 - pt.repoExploitabilityScore;

    const y = svgHeight - paddingY - (val / 100) * (svgHeight - paddingY * 2);
    return { x, y, data: pt, val };
  });

  const polylinePoints = points.map((p) => `${p.x},${p.y}`).join(' ');
  const areaPoints = `${points[0].x},${svgHeight - paddingY} ${polylinePoints} ${points[points.length - 1].x},${svgHeight - paddingY}`;

  const trajectoryColor =
    data.trajectory === 'improving'
      ? 'text-emerald-600 bg-emerald-50 border-emerald-200'
      : data.trajectory === 'degrading'
      ? 'text-rose-600 bg-rose-50 border-rose-200'
      : 'text-amber-600 bg-amber-50 border-amber-200';

  const TrajectoryIcon =
    data.trajectory === 'improving'
      ? TrendingUp
      : data.trajectory === 'degrading'
      ? TrendingDown
      : Minus;

  return (
    <section className="glass-panel rounded-[24px] p-6 border border-[rgba(176,122,77,0.18)] bg-[#f5efe7]/50 shadow-sm space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#9a6a43]/10 flex items-center justify-center border border-[#9a6a43]/20 shrink-0">
            <History className="w-5 h-5 text-[#9a6a43]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
                Historical Trust & Risk Trend
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200/70 text-slate-700">
                {data.totalScans} {data.totalScans === 1 ? 'Scan' : 'Scans Recorded'}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-semibold mt-0.5">
              Longitudinal tracking of repository trust score, security posture, and vulnerability velocity.
            </p>
          </div>
        </div>

        {/* Trajectory Badge */}
        {!isSingleScan && (
          <div className={`inline-flex items-center gap-2 rounded-2xl border px-3.5 py-2 font-bold text-xs shadow-sm ${trajectoryColor}`}>
            <TrajectoryIcon className="w-4 h-4" />
            <span className="capitalize">{data.trajectory} Trajectory</span>
            <span className="text-xs font-mono font-black ml-1">
              {data.trustScoreDelta >= 0 ? `+${data.trustScoreDelta}` : data.trustScoreDelta} pts
            </span>
          </div>
        )}
      </div>

      {/* Delta Metric Pills */}
      {!isSingleScan && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <DeltaCard
            label="Trust Score"
            current={selectedPoint?.trustScore ?? history[history.length - 1].trustScore}
            delta={data.trustScoreDelta}
            unit="pts"
            positiveIsGood={true}
          />
          <DeltaCard
            label="Security Score"
            current={selectedPoint?.repoSecurityScore ?? history[history.length - 1].repoSecurityScore}
            delta={data.securityScoreDelta}
            unit="pts"
            positiveIsGood={true}
          />
          <DeltaCard
            label="Critical Vulns"
            current={selectedPoint?.criticalVulnerabilities ?? history[history.length - 1].criticalVulnerabilities}
            delta={data.criticalVulnDelta}
            unit=""
            positiveIsGood={false}
          />
          <DeltaCard
            label="Exploitability"
            current={selectedPoint?.repoExploitabilityScore ?? history[history.length - 1].repoExploitabilityScore}
            delta={data.exploitabilityDelta}
            unit="pts"
            positiveIsGood={false}
          />
        </div>
      )}

      {/* Metric Selector & Interactive Chart Container */}
      <div className="rounded-[20px] border border-[rgba(176,122,77,0.12)] bg-[#fffdf9]/80 p-4 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 bg-[#efe8de]/70 p-1 rounded-xl border border-[rgba(176,122,77,0.1)] text-xs font-bold">
            <button
              onClick={() => setActiveMetric('trust')}
              className={`px-3 py-1 rounded-lg transition-all ${
                activeMetric === 'trust'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Trust Score
            </button>
            <button
              onClick={() => setActiveMetric('security')}
              className={`px-3 py-1 rounded-lg transition-all ${
                activeMetric === 'security'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Security Score
            </button>
            <button
              onClick={() => setActiveMetric('exploitability')}
              className={`px-3 py-1 rounded-lg transition-all ${
                activeMetric === 'exploitability'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Exploitability Resistance
            </button>
          </div>

          {selectedPoint && (
            <div className="text-xs text-slate-600 font-semibold flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-[#9a6a43]" />
              <span>
                {new Date(selectedPoint.timestamp).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
              <span className="font-mono font-bold text-slate-900 ml-1">
                Score: {activeMetric === 'trust' ? selectedPoint.trustScore : activeMetric === 'security' ? selectedPoint.repoSecurityScore : Math.round((100 - selectedPoint.repoExploitabilityScore) * 10) / 10}/100
              </span>
            </div>
          )}
        </div>

        {/* SVG Chart */}
        <div className="w-full overflow-x-auto">
          <svg
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            className="w-full h-44 select-none overflow-visible"
          >
            <defs>
              <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#9a6a43" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#9a6a43" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Grid lines */}
            <line x1={paddingX} y1={paddingY} x2={svgWidth - paddingX} y2={paddingY} stroke="#e2e8f0" strokeDasharray="3 3" />
            <line x1={paddingX} y1={svgHeight / 2} x2={svgWidth - paddingX} y2={svgHeight / 2} stroke="#e2e8f0" strokeDasharray="3 3" />
            <line x1={paddingX} y1={svgHeight - paddingY} x2={svgWidth - paddingX} y2={svgHeight - paddingY} stroke="#cbd5e1" />

            {/* Y axis labels */}
            <text x={paddingX - 8} y={paddingY + 4} textAnchor="end" className="text-[9px] fill-slate-400 font-mono font-bold">100</text>
            <text x={paddingX - 8} y={svgHeight / 2 + 3} textAnchor="end" className="text-[9px] fill-slate-400 font-mono font-bold">50</text>
            <text x={paddingX - 8} y={svgHeight - paddingY + 3} textAnchor="end" className="text-[9px] fill-slate-400 font-mono font-bold">0</text>

            {/* Area and Line */}
            {points.length > 1 && (
              <>
                <polygon points={areaPoints} fill="url(#trendGradient)" />
                <polyline
                  fill="none"
                  stroke="#9a6a43"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={polylinePoints}
                />
              </>
            )}

            {/* Data points */}
            {points.map((p, idx) => {
              const isSelected = selectedPoint?.analysisId === p.data.analysisId;
              return (
                <g
                  key={p.data.analysisId + idx}
                  className="cursor-pointer group"
                  onClick={() => setSelectedPoint(p.data)}
                >
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={isSelected ? 6 : 4}
                    fill={isSelected ? '#9a6a43' : '#fff'}
                    stroke="#9a6a43"
                    strokeWidth={isSelected ? 2.5 : 2}
                    className="transition-all duration-200 group-hover:scale-125"
                  />
                  <text
                    x={p.x}
                    y={p.y - 10}
                    textAnchor="middle"
                    className={`text-[9px] font-mono font-bold transition-opacity ${
                      isSelected ? 'fill-slate-900 opacity-100' : 'fill-slate-500 opacity-0 group-hover:opacity-100'
                    }`}
                  >
                    {Math.round(p.val)}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Selected scan summary drawer */}
        {selectedPoint && (
          <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-xs text-slate-600 font-medium flex-wrap gap-2">
            <div>
              <span className="font-bold text-slate-800">Scan Details:</span> {selectedPoint.totalFiles} files, {selectedPoint.totalNodes} AST symbols analyzed.
            </div>
            <div className="flex items-center gap-3">
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                selectedPoint.recommendation === 'SAFE TO SHIP'
                  ? 'bg-emerald-100 text-emerald-800'
                  : selectedPoint.recommendation === 'NEEDS REVIEW'
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-rose-100 text-rose-800'
              }`}>
                {selectedPoint.recommendation}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Summary & Insights List */}
      <div className="space-y-2">
        <p className="text-xs font-bold text-slate-800 bg-[#efe8de]/40 p-3 rounded-xl border border-[rgba(176,122,77,0.1)]">
          {data.summary}
        </p>

        <div className="grid gap-1.5 sm:grid-cols-2 text-xs text-slate-600 font-medium">
          {data.insights.map((insight, i) => (
            <div key={i} className="flex items-start gap-2 bg-white/70 p-2.5 rounded-xl border border-slate-200/50">
              <div className="w-1.5 h-1.5 rounded-full bg-[#9a6a43] mt-1.5 shrink-0" />
              <span>{insight}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function DeltaCard({
  label,
  current,
  delta,
  unit,
  positiveIsGood,
}: {
  label: string;
  current: number;
  delta: number;
  unit: string;
  positiveIsGood: boolean;
}) {
  const isPositive = delta > 0;
  const isZero = delta === 0;
  const isGood = positiveIsGood ? isPositive : !isPositive;

  const colorClass = isZero
    ? 'text-slate-600'
    : isGood
    ? 'text-emerald-600'
    : 'text-rose-600';

  return (
    <div className="rounded-xl bg-white/80 border border-[rgba(176,122,77,0.1)] p-3 shadow-sm">
      <div className="text-[10px] uppercase font-extrabold tracking-wider text-slate-500">
        {label}
      </div>
      <div className="mt-1 flex items-baseline justify-between">
        <span className="text-lg font-black font-mono text-slate-900">
          {current}
          <span className="text-xs font-normal text-slate-500 ml-0.5">{unit}</span>
        </span>
        <span className={`text-xs font-mono font-extrabold ${colorClass}`}>
          {isZero ? '0' : isPositive ? `+${delta}` : delta}
        </span>
      </div>
    </div>
  );
}
